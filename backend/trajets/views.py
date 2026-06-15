from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters import rest_framework as filters
from rest_framework.filters import OrderingFilter, SearchFilter
from django.utils import timezone
from django.db.models import Count, Sum, Q
from django.shortcuts import get_object_or_404

from .models import Trajet
from .serializers import TrajetSerializer
from users.models import User  # ✅ Pour récupérer le gestionnaire ciblé
from users.permissions import IsAdminUserCustom, IsGestionnaire


class TrajetFilter(filters.FilterSet):
    prix_min = filters.NumberFilter(field_name="prix", lookup_expr='gte')
    prix_max = filters.NumberFilter(field_name="prix", lookup_expr='lte')
    
    class Meta:
        model = Trajet
        fields = {
            'ville_depart': ['iexact', 'icontains'],
            'ville_arrivee': ['iexact', 'icontains'],
            'date_depart': ['exact', 'gte', 'lte'],
        }


class TrajetViewSet(viewsets.ModelViewSet):
    serializer_class = TrajetSerializer
    filter_backends = [filters.DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TrajetFilter
    search_fields = ['ville_depart', 'ville_arrivee']
    ordering_fields = ['date_depart', 'heure_depart', 'prix']
    ordering = ['-date_depart', 'heure_depart']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        """
        ✅ FILTRAGE UNIVERSEL :
        - Supporte le mode "admin consultant un gestionnaire" via manager_id
        - Admin seul : voit TOUS les trajets
        - Admin + manager_id : voit les trajets de l'agence de CE gestionnaire
        - Gestionnaire : voit les trajets de SA propre agence
        - Client/Public : voit uniquement les trajets futurs
        """
        user = self.request.user
        role = getattr(user, 'role', None)
        base_qs = Trajet.objects.all().select_related('bus', 'bus__agence')

        # ✅ MODE ADMIN CONSULTANT UN GESTIONNAIRE SPÉCIFIQUE
        manager_id = self.kwargs.get('manager_id') or self.request.query_params.get('manager_id')
        
        if manager_id and role == 'ADMIN':
            # Récupérer le gestionnaire ciblé et filtrer par SON agence
            gestionnaire = get_object_or_404(User, id=manager_id, role='GESTIONNAIRE')
            if gestionnaire.agence:
                return base_qs.filter(bus__agence=gestionnaire.agence).order_by('-date_depart', 'heure_depart')
            return Trajet.objects.none()  # Gestionnaire sans agence = aucun trajet

        # ✅ ADMIN STANDARD : voit tout
        if role == 'ADMIN':
            return base_qs.order_by('-date_depart', 'heure_depart')
        
        # ✅ GESTIONNAIRE : voit uniquement les trajets de SA propre agence
        if role == 'GESTIONNAIRE' and hasattr(user, 'agence') and user.agence:
            return base_qs.filter(bus__agence=user.agence).order_by('-date_depart', 'heure_depart')
        
        # ✅ CLIENT/PUBLIC : uniquement les trajets futurs
        today = timezone.now().date()
        return base_qs.filter(date_depart__gte=today).order_by('date_depart', 'heure_depart')

    def perform_create(self, serializer):
        """
        ✅ CRÉATION SÉCURISÉE AVEC SUPPORT MODE ADMIN :
        - Si admin + manager_id : lie le trajet à l'agence du gestionnaire ciblé
        - Si gestionnaire : lie à SA propre agence
        - Vérifie que le bus appartient à la bonne agence
        """
        user = self.request.user
        bus_propose = serializer.validated_data.get('bus')
        
        # ✅ MODE ADMIN CONSULTANT : déterminer l'agence cible
        agence_cible = None
        manager_id = self.kwargs.get('manager_id') or self.request.query_params.get('manager_id')
        
        if manager_id and user.role == 'ADMIN':
            gestionnaire = get_object_or_404(User, id=manager_id, role='GESTIONNAIRE')
            agence_cible = gestionnaire.agence
        
        # ✅ MODE GESTIONNAIRE STANDARD
        elif user.role == 'GESTIONNAIRE' and hasattr(user, 'agence') and user.agence:
            agence_cible = user.agence
        
        # ✅ Vérification : le bus doit appartenir à l'agence cible
        if agence_cible and bus_propose and bus_propose.agence != agence_cible:
            raise PermissionDenied("Ce bus n'appartient pas à l'agence ciblée.")
        
        # L'agence du trajet est deduite du bus affecte.
        serializer.save()

    @action(detail=False, methods=['get'])
    def statistiques_remplissage(self, request):
        queryset = self.get_queryset().annotate(
            reservations_count=Count('reservations'),
            places_vendues=Sum('reservations__nombre_places')
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def confirmer_depart(self, request, pk=None):
        """
        Gestionnaire/Admin confirme le départ d'un trajet.
        Marque le trajet comme 'en_cours' et empêche de nouvelles réservations.
        """
        trajet = self.get_object()
        user = request.user

        # Seuls les gestionnaires et admins peuvent confirmer
        if getattr(user, 'role', None) not in ['GESTIONNAIRE', 'ADMIN']:
            return Response(
                {'detail': 'Seuls les gestionnaires et administrateurs peuvent confirmer un départ.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Vérifier que le trajet appartient à l'agence du gestionnaire
        if getattr(user, 'role', None) == 'GESTIONNAIRE':
            if not hasattr(user, 'agence') or not user.agence:
                return Response({'detail': 'Aucune agence associée.'}, status=status.HTTP_403_FORBIDDEN)
            if trajet.bus.agence != user.agence:
                return Response({'detail': 'Ce trajet ne fait pas partie de votre agence.'}, status=status.HTTP_403_FORBIDDEN)

        if trajet.statut_depart == 'parti':
            return Response({'detail': 'Ce trajet est déjà marqué comme parti.'}, status=status.HTTP_400_BAD_REQUEST)

        trajet.statut_depart = 'parti'
        trajet.save(update_fields=['statut_depart'])

        return Response({
            'detail': f'Départ confirmé pour {trajet.ville_depart} → {trajet.ville_arrivee} ({trajet.date_depart}).',
            'statut_depart': trajet.statut_depart
        }, status=status.HTTP_200_OK)
