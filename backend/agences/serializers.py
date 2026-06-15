from rest_framework import serializers
from .models import Agence
from django.contrib.auth import get_user_model

User = get_user_model()

class AgenceSerializer(serializers.ModelSerializer):
    gestionnaire_username = serializers.CharField(source='gestionnaire.username', read_only=True)

    class Meta:
        model = Agence
        fields = ['id', 'nom', 'adresse', 'telephone', 'email_contact', 'gestionnaire', 'gestionnaire_username', 'date_creation']
        read_only_fields = ['id', 'date_creation']

    def validate_gestionnaire(self, value):
        """Validation stricte pour s'assurer que l'utilisateur est bien un gestionnaire."""
        if value and value.role != 'GESTIONNAIRE':
            raise serializers.ValidationError("L'utilisateur sélectionné doit posséder le rôle GESTIONNAIRE.")
        return value
