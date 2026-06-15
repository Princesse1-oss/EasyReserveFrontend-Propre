from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Chauffeur
from .serializers import ChauffeurSerializer
from users.permissions import IsAdminUserCustom, IsGestionnaire, IsAdminOrGestionnaire


class ChauffeurViewSet(viewsets.ModelViewSet):
    """
    CRUD Chauffeurs :
    - Admin : accès global à tous les chauffeurs.
    - Gestionnaire : accès uniquement aux chauffeurs de son agence (via bus assigné).
    - Lecture seule pour les autres rôles authentifiés.
    """
    serializer_class = ChauffeurSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'bus_assigne']
    search_fields = ['nom', 'prenom', 'telephone', 'numero_permis']
    ordering_fields = ['nom', 'prenom', 'date_creation']
    ordering = ['nom', 'prenom']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrGestionnaire()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        base_qs = Chauffeur.objects.all().select_related('bus_assigne', 'bus_assigne__agence')

        # Admin voit tous les chauffeurs
        if getattr(user, 'role', None) == 'ADMIN':
            return base_qs

        # Gestionnaire voit les chauffeurs des bus de son agence
        if getattr(user, 'role', None) == 'GESTIONNAIRE' and hasattr(user, 'agence') and user.agence:
            return base_qs.filter(bus_assigne__agence=user.agence)

        # Client/autre : lecture de base
        return base_qs
