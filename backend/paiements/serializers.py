from rest_framework import serializers
from django.utils import timezone
from .models import Paiement
from reservations.models import Reservation

class PaiementSerializer(serializers.ModelSerializer):
    # Champs en lecture seule pour l'affichage
    client_username = serializers.CharField(source='reservation.client.username', read_only=True)
    client_email = serializers.EmailField(source='reservation.client.email', read_only=True)
    trajet_info = serializers.SerializerMethodField(read_only=True)
    montant_total = serializers.DecimalField(source='montant', max_digits=10, decimal_places=0, read_only=True)

    class Meta:
        model = Paiement
        fields = [
            'id', 'reservation', 'montant', 'methode', 'statut', 
            'transaction_id', 'telephone_paiement', 'client_username',
            'client_email', 'trajet_info', 'montant_total', 'date_paiement'
        ]
        read_only_fields = ['id', 'date_paiement', 'statut']  # Statut géré par la vue
        extra_kwargs = {
            'reservation': {'required': True},
            'montant': {'required': True, 'min_value': 1},
            'methode': {'required': True},
            'telephone_paiement': {'required': False, 'allow_blank': True}
        }

    def get_trajet_info(self, obj):
        """Formatage lisible du trajet pour l'affichage."""
        trajet = obj.reservation.trajet if obj.reservation else None
        if not trajet:
            return 'Trajet inconnu'
        return f"{trajet.ville_depart} -> {trajet.ville_arrivee} ({trajet.date_depart})"

    def validate_reservation(self, value):
        """Vérifie que la réservation existe, appartient au client, et n'est pas déjà payée."""
        request = self.context.get('request')

        if not value:
            raise serializers.ValidationError("Réservation requise.")

        # Vérifier que la réservation appartient au client connecté
        if request and hasattr(request, 'user') and request.user.role == 'CLIENT':
            if value.client != request.user:
                raise serializers.ValidationError("Vous ne pouvez pas payer pour une réservation qui ne vous appartient pas.")

        # Vérifier que la réservation n'a pas déjà un paiement valide
        if value.paiements.filter(statut='valide').exists():
            raise serializers.ValidationError("Cette réservation a déjà été payée.")

        # Vérifier que la réservation est encore valide (pas annulée)
        if value.statut == 'annulee':
            raise serializers.ValidationError("Cette réservation est annulée.")

        # ✅ BLOCAGE : voyage déjà passé
        from django.utils import timezone
        if value.trajet.date_depart < timezone.now().date():
            raise serializers.ValidationError("Paiement impossible : ce voyage est déjà passé.")

        # ✅ BLOCAGE : trajet déjà parti
        if getattr(value.trajet, 'statut_depart', None) == 'parti':
            raise serializers.ValidationError("Paiement impossible : ce trajet est déjà parti.")

        return value

    def validate_montant(self, value):
        """Vérifie que le montant correspond au prix total du trajet (prix × nombre de places)."""
        # Cette validation est faite dans create() pour avoir accès à reservation
        return value

    def validate_telephone_paiement(self, value):
        """Nettoie et valide le format du téléphone pour Mobile Money."""
        if not value:
            return None
        # Supprime les espaces, tirets, et garde uniquement les chiffres
        cleaned = ''.join(filter(str.isdigit, value))
        if not (9 <= len(cleaned) <= 15):
            raise serializers.ValidationError("Numéro de téléphone invalide (9-15 chiffres).")
        return cleaned

    def validate(self, attrs):
        """Validation croisée : montant = prix_trajet × nombre_places."""
        reservation = attrs.get('reservation')
        montant = attrs.get('montant')
        
        if reservation and montant:
            prix_total_attendu = reservation.trajet.prix * reservation.nombre_places
            # Convert both to float for comparison to avoid Decimal vs int issues
            if float(montant) != float(prix_total_attendu):
                raise serializers.ValidationError({
                    'montant': f"Le montant doit être de {prix_total_attendu} FCFA ({reservation.trajet.prix} × {reservation.nombre_places} places)."
                })
        
        return attrs

    def create(self, validated_data):
        """Création du paiement avec timestamp automatique."""
        validated_data['date_paiement'] = timezone.now()
        # Le statut est géré par la vue (valide pour MVP, ou en_attente pour prod)
        return super().create(validated_data)