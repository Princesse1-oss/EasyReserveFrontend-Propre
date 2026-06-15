from rest_framework import serializers
from .models import Chauffeur


class ChauffeurSerializer(serializers.ModelSerializer):
    bus_matricule = serializers.CharField(
        source='bus_assigne.matricule', read_only=True
    )
    statut_display = serializers.CharField(
        source='get_statut_display', read_only=True
    )

    class Meta:
        model = Chauffeur
        fields = [
            'id', 'nom', 'prenom', 'telephone', 'email',
            'numero_permis', 'statut', 'statut_display',
            'bus_assigne', 'bus_matricule',
            'date_embauche', 'date_creation',
        ]
        read_only_fields = ['id', 'date_creation']

    def validate_numero_permis(self, value):
        return value.strip().upper()

    def validate_telephone(self, value):
        cleaned = ''.join(filter(str.isdigit, value))
        if not (9 <= len(cleaned) <= 15):
            raise serializers.ValidationError(
                "Numéro de téléphone invalide (9 à 15 chiffres)."
            )
        return cleaned
