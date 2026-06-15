from rest_framework import serializers
from django.db.models import Sum
from .models import Trajet
from buses.serializers import BusSerializer
from reservations.models import Reservation

class TrajetSerializer(serializers.ModelSerializer):
    bus_details = BusSerializer(source='bus', read_only=True)
    agence_nom = serializers.SerializerMethodField()
    places_disponibles = serializers.SerializerMethodField()

    class Meta:
        model = Trajet
        fields = [
            'id', 'ville_depart', 'ville_arrivee', 'date_depart',
            'heure_depart', 'prix', 'bus', 'bus_details',
            'agence_nom', 'places_disponibles', 'statut_depart'
        ]
        read_only_fields = ['id', 'places_disponibles', 'date_creation']

    def get_agence_nom(self, obj):
        if obj.bus and hasattr(obj.bus, 'agence') and obj.bus.agence:
            return obj.bus.agence.nom
        return "Non assignée"

    def get_places_disponibles(self, obj):
        return obj.places_disponibles

    def validate_date_depart(self, value):
        from django.utils import timezone
        if value < timezone.now().date():
            raise serializers.ValidationError("La date de départ ne peut pas être dans le passé.")
        return value

    def validate_prix(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le prix doit être supérieur à 0.")
        return value