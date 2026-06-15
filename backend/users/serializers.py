from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.core.mail import send_mail
from django.conf import settings
import secrets

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Accepte username ou email pour la connexion
        username_or_email = attrs.get('username')
        password = attrs.get('password')
        
        if not username_or_email or not password:
            raise serializers.ValidationError("Veuillez fournir le nom d'utilisateur/email et le mot de passe.")
        
        # Cherche l'utilisateur par username ou email
        try:
            user = User.objects.get(username=username_or_email)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email=username_or_email)
            except User.DoesNotExist:
                raise serializers.ValidationError("Identifiants incorrects.")
        
        # Vérifie le mot de passe
        if not user.check_password(password):
            raise serializers.ValidationError("Identifiants incorrects.")
        
        # Vérifie si le compte est actif
        if not user.is_active:
            raise serializers.ValidationError("Ce compte a été désactivé.")
        
        # Passe le username à la validation parent
        attrs['username'] = user.username
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['first_name'] = user.first_name or ''
        token['last_name'] = user.last_name or ''
        token['telephone'] = getattr(user, 'telephone', '') or ''
        token['role'] = str(getattr(user, 'role', 'CLIENT')).upper()
        token['is_active'] = user.is_active
        # Récupère l'agence via la relation inverse (agence liée au gestionnaire)
        agence_id = None
        if hasattr(user, 'agence') and user.agence:
            agence_id = user.agence.id
        token['agence_id'] = agence_id
        return token

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    telephone = serializers.CharField(required=False, allow_blank=True, default='')
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    
    # ✅ CORRECTION : Définir agence_id explicitement pour éviter le crash DRF
    agence_id = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 
            'telephone', 'role', 'password', 'date_joined', 
            'profile_picture', 'agence_id'  # ✅ Maintenant valide
        ]
        read_only_fields = ['id', 'date_joined', 'username', 'role', 'agence_id']

    def get_agence_id(self, obj):
        # ✅ Sécurité : retourne l'ID de l'agence seulement si l'utilisateur est gestionnaire
        # Utilise la relation inverse. Adaptez 'agence' si votre related_name est différent
        if hasattr(obj, 'agence') and obj.agence:
            return obj.agence.id
        return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        role = str(validated_data.get('role', 'CLIENT')).upper()
        validated_data['role'] = role
        
        user = User.objects.create_user(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        # ✅ Gestion explicite de l'image de profil
        profile_pic = validated_data.pop('profile_picture', None)
        if profile_pic is not None:
            instance.profile_picture = profile_pic
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

    def validate_role(self, value):
        choices = ['ADMIN', 'GESTIONNAIRE', 'CLIENT']
        value_upper = str(value).upper()
        if value_upper not in choices:
            raise serializers.ValidationError(f"Le rôle doit être l'un des suivants : {choices}")
        return value_upper
               
class AdminGestionnaireSerializer(serializers.ModelSerializer):
    # ✅ Force l'extraction du nom de l'agence même si la relation est indirecte
    agence_nom = serializers.SerializerMethodField()
    agence_id = serializers.IntegerField(source='agence.id', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_active', 'date_joined', 'agence_nom', 'agence_id'
        ]
        read_only_fields = ['id', 'date_joined']

    def get_agence_nom(self, obj):
        # ✅ Sécurité : vérifie si l'agence existe avant d'appeler .nom
        if hasattr(obj, 'agence') and obj.agence:
            return obj.agence.nom
        return "Non assignée"

# ✅ Serializer d'inscription avec email auto + gestion agence
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    role = serializers.CharField(required=False, default='CLIENT')
    telephone = serializers.CharField(required=False, allow_blank=True, default='')
    agence_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'password', 'first_name', 
            'last_name', 'telephone', 'role', 'agence_id'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        agence_id = validated_data.pop('agence_id', None)
        role = str(validated_data.get('role', 'CLIENT')).upper()
        validated_data['role'] = role

        # Génération auto du mot de passe si non fourni
        raw_password = validated_data.pop('password', None)
        if not raw_password:
            raw_password = secrets.token_urlsafe(12)

        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=raw_password,
            first_name=validated_data.get('first_name', ''),
            telephone=validated_data.get('telephone', ''),
            role=role
        )

        # Liaison agence si gestionnaire
        if agence_id and role == 'GESTIONNAIRE':
            try:
                from agences.models import Agence
                agence = Agence.objects.get(id=agence_id)
                agence.gestionnaire = user
                agence.save()
                print(f"Agence '{agence.nom}' liée au gestionnaire '{user.username}'")
            except Exception as e:
                print(f"Erreur liaison agence: {e}")

        # Envoi email de bienvenue (uniquement pour gestionnaires)
        if role == 'GESTIONNAIRE' and user.email:
            self._send_welcome_email(user, raw_password, agence_id)

        return user

    def _send_welcome_email(self, user, password, agence_id=None):
        """Envoie l'email de bienvenue avec identifiants"""
        agence_nom = "Non assignée"
        if agence_id:
            try:
                from agences.models import Agence
                agence_nom = Agence.objects.get(id=agence_id).nom
            except:
                pass

        subject = '[EasyReserve] Vos identifiants de connexion'
        message = f"""Bonjour {user.first_name or user.username},

✅ Votre compte gestionnaire EasyReserve a été créé avec succès.

🔐 Vos identifiants de connexion :
   • Username : {user.username}
   • Mot de passe : {password}

🏢 Agence rattachée : {agence_nom}

🔗 Accédez à votre espace : {getattr(settings, 'FRONTEND_URL', 'http://localhost:4200')}/login

⚠️ Pour votre sécurité, changez votre mot de passe après votre première connexion.

Cordialement,
L'équipe EasyReserve
"""
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            print(f"Email envoyé à {user.email}")
        except Exception as e:
            print(f"Échec envoi email: {e}")