from rest_framework import serializers
from .models import Place

class PlaceSerializer(serializers.ModelSerializer):
    bus_matricule = serializers.CharField(source='bus.matricule', read_only=True)

    class Meta:
        model = Place
        fields = ['id', 'numero_siege', 'bus', 'bus_matricule', 'disponible']
