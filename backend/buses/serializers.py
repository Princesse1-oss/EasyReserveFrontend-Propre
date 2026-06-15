from rest_framework import serializers
from .models import Bus

class BusSerializer(serializers.ModelSerializer):
    agence_nom = serializers.CharField(source='agence.nom', read_only=True)
    places_creees = serializers.IntegerField(source='places.count', read_only=True)

    class Meta:
        model = Bus
        fields = ['id', 'matricule', 'capacite', 'type_bus', 'agence', 'agence_nom', 'places_creees', 'is_active', 'date_creation']
        read_only_fields = ['id', 'places_creees', 'date_creation']

    def validate_capacite(self, value):
        if value <= 0 or value > 100:
            raise serializers.ValidationError("La capacité du bus doit être comprise entre 1 et 100 sièges.")
        return value
