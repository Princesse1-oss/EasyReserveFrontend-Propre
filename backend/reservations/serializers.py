from rest_framework import serializers
from .models import Reservation
from trajets.models import Trajet

class ReservationSerializer(serializers.ModelSerializer):
    client_username = serializers.CharField(source='client.username', read_only=True)
    trajet_detail = serializers.SerializerMethodField(read_only=True)
    place_detail = serializers.SerializerMethodField(read_only=True)

    # ✅ Champs explicites pour la création
    trajet = serializers.PrimaryKeyRelatedField(queryset=Trajet.objects.all())
    nombre_places = serializers.IntegerField(min_value=1, max_value=999)
    passager_nom = serializers.CharField(required=False, allow_blank=True)
    passager_tel = serializers.CharField(required=False, allow_blank=True)
    statut = serializers.CharField(default='en_attente')

    class Meta:
        model = Reservation
        fields = [
            'id', 'client', 'client_username', 'trajet', 'trajet_detail',
            'place', 'place_detail', 'nombre_places', 'passager_nom', 
            'passager_tel', 'statut', 'date_reservation'
        ]
        # ✅ client est en read_only car injecté via serializer.save(client=user)
        read_only_fields = ['id', 'client', 'date_reservation', 'place', 'place_detail']

    def get_trajet_detail(self, obj):
        if not obj.trajet: return None
        return {
            'id': obj.trajet.id,
            'ville_depart': obj.trajet.ville_depart,
            'ville_arrivee': obj.trajet.ville_arrivee,
            'date_depart': obj.trajet.date_depart,
            'heure_depart': obj.trajet.heure_depart,
            'prix': float(obj.trajet.prix),
            'places_disponibles': obj.trajet.places_disponibles,
            'bus_details': {
                'type_bus': obj.trajet.bus.type_bus if obj.trajet.bus else None,
                'agence_nom': obj.trajet.bus.agence.nom if obj.trajet.bus and obj.trajet.bus.agence else None
            }
        }

    def get_place_detail(self, obj):
        return {'id': obj.place.id, 'numero_siege': obj.place.numero_siege} if obj.place else None

    def validate(self, data):
        trajet = data.get('trajet')
        nb = data.get('nombre_places', 1)
        if trajet:
            from django.utils import timezone
            if trajet.date_depart < timezone.now().date():
                raise serializers.ValidationError({'trajet': "Ce voyage est déjà passé."})
            if getattr(trajet, 'statut_depart', None) == 'parti':
                raise serializers.ValidationError({'trajet': "Ce trajet est déjà parti."})
            if trajet.places_disponibles < nb:
                raise serializers.ValidationError({'nombre_places': f"Seulement {trajet.places_disponibles} place(s) dispo."})
        return data

    def create(self, validated_data):
        return Reservation.objects.create(**validated_data)