from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from .models import Agence
from .serializers import AgenceSerializer
from users.permissions import IsAdminUserCustom, IsGestionnaire

class AgenceViewSet(viewsets.ModelViewSet):
    """
    CRUD Agences :
    - Lecture : Tous les utilisateurs authentifiés.
    - Écriture : Uniquement les Administrateurs.
    """
    queryset = Agence.objects.all().select_related('gestionnaire').order_by('nom')
    serializer_class = AgenceSerializer
    
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['nom', 'adresse']

    def get_permissions(self):
        """Attribution dynamique des permissions selon l'action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUserCustom()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='ma-gerance', permission_classes=[IsGestionnaire])
    def ma_gerance(self, request):
        """Endpoint permettant à un Gestionnaire de voir/modifier son agence dédiée."""
        try:
            agence = request.user.agence
        except Agence.DoesNotExist:
            return Response(
                {"detail": "Aucune agence n'est associée à votre compte gestionnaire."},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            serializer = self.get_serializer(agence)
            return Response(serializer.data)
            
        elif request.method in ['PUT', 'PATCH']:
            # Empêcher le gestionnaire de changer de gestionnaire lui-même
            data = request.data.copy()
            data.pop('gestionnaire', None)
            
            serializer = self.get_serializer(agence, data=data, partial=(request.method == 'PATCH'))
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
