from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from django.shortcuts import get_object_or_404

from .models import Bus
from .serializers import BusSerializer
from users.permissions import IsAdminUserCustom, IsGestionnaire, IsAdminOrGestionnaire
from users.models import User

class BusViewSet(viewsets.ModelViewSet):
    """
    Gestion des Bus :
    - Admin : Contrôle total sur tous les bus.
    - Gestionnaire : CRUD limité exclusivement aux bus de son agence.
    """
    serializer_class = BusSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['type_bus', 'agence']
    search_fields = ['matricule']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrGestionnaire()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        # ✅ MODE ADMIN CONSULTANT UN GESTIONNAIRE SPÉCIFIQUE
        manager_id = self.request.query_params.get('manager_id')
        if manager_id and getattr(user, 'role', None) == 'ADMIN':
            gestionnaire = get_object_or_404(User, id=manager_id, role='GESTIONNAIRE')
            if gestionnaire.agence:
                return Bus.objects.filter(agence=gestionnaire.agence).select_related('agence').order_by('matricule')
            return Bus.objects.none()

        # L'admin voit toute la flotte globale
        if getattr(user, 'role', None) == 'ADMIN':
            return Bus.objects.all().select_related('agence').order_by('matricule')
        
        # Le gestionnaire voit uniquement les bus de son agence rattachée
        if getattr(user, 'role', None) == 'GESTIONNAIRE' and hasattr(user, 'agence'):
            return Bus.objects.filter(agence=user.agence).select_related('agence').order_by('matricule')
        
        # Le client voit les bus disponibles pour info
        return Bus.objects.all().select_related('agence')

    def perform_create(self, serializer):
        user = self.request.user
        # ✅ MODE ADMIN CONSULTANT UN GESTIONNAIRE SPÉCIFIQUE
        manager_id = self.request.query_params.get('manager_id')
        if manager_id and getattr(user, 'role', None) == 'ADMIN':
            gestionnaire = get_object_or_404(User, id=manager_id, role='GESTIONNAIRE')
            if gestionnaire.agence:
                serializer.save(agence=gestionnaire.agence)
                return
        
        # Sécurité : Si c'est un gestionnaire, on le force à enregistrer le bus dans son agence uniquement
        if getattr(user, 'role', None) == 'GESTIONNAIRE' and hasattr(user, 'agence'):
            serializer.save(agence=user.agence)
        else:
            serializer.save()

