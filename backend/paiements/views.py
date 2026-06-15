from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Sum, Count
from django.utils import timezone
import logging

from .models import Paiement
from .serializers import PaiementSerializer
from reservations.models import Reservation
from users.permissions import IsAdminUserCustom, IsGestionnaire

logger = logging.getLogger(__name__)

class PaiementViewSet(viewsets.ModelViewSet):
    """
    Gestion des paiements :
    - Client : Créer un paiement pour sa réservation, voir ses paiements
    - Gestionnaire/Admin : Valider les paiements, voir les stats
    """
    serializer_class = PaiementSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['methode', 'statut', 'reservation']
    search_fields = ['transaction_id', 'telephone_paiement']
    ordering_fields = ['date_paiement', 'montant']
    ordering = ['-date_paiement']

    def get_permissions(self):
        """Permissions selon l'action."""
        if self.action in ['valider_paiement', 'statistiques']:
            from users.permissions import IsAdminOrGestionnaire
            return [IsAdminOrGestionnaire()]
        # Création et lecture : authentifié uniquement
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        """Filtrage par rôle avec optimisation des requêtes."""
        import logging
        logger = logging.getLogger(__name__)
        
        user = self.request.user
        logger.info(f"get_queryset() appelé par utilisateur: {user.username}, rôle: {getattr(user, 'role', 'N/A')}")
        
        base_query = Paiement.objects.all().select_related(
            'reservation', 
            'reservation__client', 
            'reservation__trajet',
            'reservation__trajet__bus'
        )

        try:
            if getattr(user, 'role', None) == 'ADMIN':
                logger.info("Retourne tous les paiements (ADMIN)")
                return base_query
                
            if getattr(user, 'role', None) == 'GESTIONNAIRE':
                if hasattr(user, 'agence') and user.agence:
                    logger.info(f"Retourne paiements pour agence: {user.agence.nom}")
                    return base_query.filter(reservation__trajet__bus__agence=user.agence)
                else:
                    logger.warning("Gestionnaire sans agence")
                    return base_query.none()
                    
            # Client : voit uniquement SES paiements
            logger.info("Retourne paiements du client")
            return base_query.filter(reservation__client=user)
        except Exception as e:
            logger.error(f"Erreur dans get_queryset(): {str(e)}", exc_info=True)
            return base_query.none()

    def create(self, request, *args, **kwargs):
        """Création d'un paiement avec validation automatique pour le MVP."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reservation = serializer.validated_data['reservation']
        trajet = reservation.trajet

        paiement = serializer.save(
            statut='valide',  # MVP : validation auto (simulation)
            date_paiement=timezone.now()
        )

        # ✅ Mise à jour automatique de la réservation
        if reservation.statut != 'confirmee':
            reservation.statut = 'confirmee'
            reservation.save()
            logger.info(f"Réservation #{reservation.id} confirmée via paiement #{paiement.id}")

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def valider_paiement(self, request, pk=None):
        """Validation manuelle par un admin/gestionnaire (pour production)."""
        paiement = self.get_object()
        nouveau_statut = request.data.get('statut')

        if nouveau_statut not in ['valide', 'echoue', 'annule']:
            return Response(
                {'detail': "Statut invalide. Valeurs acceptées : 'valide', 'echoue', 'annule'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Éviter les modifications inutiles
        if paiement.statut == nouveau_statut:
            return Response(
                {'detail': f'Le paiement est déjà {paiement.get_statut_display()}.'},
                status=status.HTTP_200_OK
            )

        ancien_statut = paiement.statut
        paiement.statut = nouveau_statut
        paiement.save()
        
        logger.info(f"Paiement #{paiement.id} : {ancien_statut} → {nouveau_statut} par {request.user}")

        # ✅ Si validé : confirmer la réservation associée
        if nouveau_statut == 'valide' and paiement.reservation.statut != 'confirmee':
            reservation = paiement.reservation
            reservation.statut = 'confirmee'
            reservation.save()
            logger.info(f"Réservation #{reservation.id} confirmée via validation paiement")

        return Response(
            {'detail': f"Paiement marqué comme '{paiement.get_statut_display()}'."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        """Annulation d'un paiement par un client (si statut = 'en_attente')."""
        paiement = self.get_object()
        
        # Seul le propriétaire ou un admin peut annuler
        if request.user.role == 'CLIENT' and paiement.reservation.client != request.user:
            return Response({'detail': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        
        if paiement.statut != 'en_attente':
            return Response(
                {'detail': 'Seuls les paiements en attente peuvent être annulés.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        paiement.statut = 'annule'
        paiement.save()
        
        # Annuler la réservation associée pour libérer automatiquement les places
        reservation = paiement.reservation
        reservation.statut = 'annulee'
        reservation.save()
        
        logger.info(f"Paiement #{paiement.id} et Réservation #{reservation.id} annulés par {request.user}")
        
        return Response({'detail': 'Paiement annulé. Réservation annulée et places libérées.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def statistiques(self, request):
        """Statistiques financières par rôle."""
        user = self.request.user
        queryset = Paiement.objects.filter(statut='valide')

        if user.role == 'GESTIONNAIRE' and hasattr(user, 'agence'):
            queryset = queryset.filter(reservation__trajet__bus__agence=user.agence)
        elif user.role == 'CLIENT':
            # Un client ne voit pas les stats globales
            return Response({'detail': 'Accès réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

        total_recette = queryset.aggregate(total=Sum('montant'))['total'] or 0
        total_transactions = queryset.count()
        
        # Stats par méthode de paiement
        stats_methode = queryset.values('methode').annotate(
            count=Count('id'),
            total=Sum('montant')
        )

        # ✅ CODE CORRIGÉ
        premier_paiement = queryset.order_by('date_paiement').first()
        dernier_paiement = queryset.order_by('-date_paiement').first()

        return Response({
            'chiffre_affaires_total': total_recette,
            'nombre_transactions_reussies': total_transactions,
            'repartition_par_methode': list(stats_methode),
            'periode': {
                'debut': premier_paiement.date_paiement if premier_paiement else None,  # ✅ Python
                'fin': dernier_paiement.date_paiement if dernier_paiement else None,    # ✅ Python
            }
        })