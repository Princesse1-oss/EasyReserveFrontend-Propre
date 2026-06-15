from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.http import FileResponse
from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from django.shortcuts import get_object_or_404

from .models import Reservation
from .serializers import ReservationSerializer
from .utils import generate_ticket

from users.permissions import IsAdminUserCustom, IsGestionnaire, IsAdminOrGestionnaire
from users.models import User

from trajets.models import Trajet
from buses.models import Bus
from paiements.models import Paiement


class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer

    def get_permissions(self):
        if self.action in ['confirmer', 'statistiques', 'activites_gestionnaire']:
            return [IsAdminOrGestionnaire()]
        if self.action in ['list', 'retrieve', 'ticket', 'annuler']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        base_query = Reservation.objects.all().select_related(
            'client', 'trajet', 'trajet__bus', 'trajet__bus__agence'
        )

        if not user.is_authenticated:
            return Reservation.objects.none()

        # ✅ MODE ADMIN CONSULTANT UN GESTIONNAIRE SPÉCIFIQUE
        manager_id = self.request.query_params.get('manager_id')
        if manager_id and getattr(user, 'role', None) == 'ADMIN':
            gestionnaire = get_object_or_404(User, id=manager_id, role='GESTIONNAIRE')
            if gestionnaire.agence:
                return base_query.filter(trajet__bus__agence=gestionnaire.agence).order_by('-date_reservation')
            return Reservation.objects.none()

        if getattr(user, 'role', None) == 'CLIENT':
            return base_query.filter(client=user).order_by('-date_reservation')
        elif getattr(user, 'role', None) == 'ADMIN':
            return base_query.order_by('-date_reservation')
        elif getattr(user, 'role', None) == 'GESTIONNAIRE' and hasattr(user, 'agence'):
            return base_query.filter(trajet__bus__agence=user.agence).order_by('-date_reservation')

        return Reservation.objects.none()

    def perform_create(self, serializer):
        instance = serializer.save(client=self.request.user)
        if instance.trajet:
            instance.trajet.refresh_from_db()

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        reservation = self.get_object()
        user = request.user

        if getattr(user, 'role', None) == 'CLIENT' and reservation.client != user:
            return Response({'detail': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        if reservation.statut == 'annulee':
            return Response({'detail': 'Déjà annulée.'}, status=status.HTTP_400_BAD_REQUEST)

        departure_date = reservation.trajet.date_depart
        now = timezone.now().date()
        if departure_date < now:
            return Response(
                {'detail': 'Annulation impossible : voyage déjà passé.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reservation.statut = 'annulee'
        reservation.save()
        if reservation.trajet:
            reservation.trajet.refresh_from_db()

        return Response({'detail': 'Réservation annulée avec succès.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def confirmer(self, request, pk=None):
        reservation = self.get_object()
        if reservation.statut != 'en_attente':
            return Response({'detail': 'Statut invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        reservation.statut = 'confirmee'
        reservation.save()
        if reservation.trajet:
            reservation.trajet.refresh_from_db()
        return Response({'detail': 'Réservation confirmée.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def ticket(self, request, pk=None):
        reservation = self.get_object()
        user = request.user

        if getattr(user, 'role', None) == 'CLIENT' and reservation.client != user:
            return Response({'detail': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        if reservation.statut != 'confirmee':
            return Response(
                {'detail': 'La réservation doit être confirmée pour télécharger le billet.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pdf_buffer = generate_ticket(reservation)
            filename = f"Billet_{reservation.id}_{reservation.passager_nom or 'Client'}.pdf"
            return FileResponse(
                pdf_buffer,
                as_attachment=True,
                content_type='application/pdf',
                filename=filename
            )
        except Exception as e:
            print(f"Erreur génération billet: {e}")
            return Response(
                {'detail': 'Erreur lors de la génération du billet.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=['get'],
        url_path='activites-gestionnaire/(?P<gestionnaire_id>[^/.]+)'
    )
    def activites_gestionnaire(self, request, gestionnaire_id=None):
        """
        Permet à l'administrateur de consulter les statistiques
        complètes d'un gestionnaire.
        """
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response(
                {'detail': 'Accès refusé.'},
                status=status.HTTP_403_FORBIDDEN
            )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        gestionnaire = User.objects.filter(
            id=gestionnaire_id,
            role='GESTIONNAIRE'
        ).first()

        if not gestionnaire:
            return Response(
                {'detail': 'Gestionnaire introuvable.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not hasattr(gestionnaire, 'agence') or not gestionnaire.agence:
            return Response(
                {'detail': "Ce gestionnaire n'a pas d'agence assignée."},
                status=status.HTTP_404_NOT_FOUND
            )

        agence = gestionnaire.agence

        total_reservations = Reservation.objects.filter(
            trajet__bus__agence=agence
        ).count()

        total_billets = Reservation.objects.filter(
            trajet__bus__agence=agence,
            statut='confirmee'
        ).count()

        total_trajets = Trajet.objects.filter(bus__agence=agence).count()
        total_bus = Bus.objects.filter(agence=agence).count()

        chiffre_affaires = Paiement.objects.filter(
            reservation__trajet__bus__agence=agence,
            statut='valide'
        ).aggregate(total=Sum('montant'))['total'] or 0

        capacite_totale = Trajet.objects.filter(
            bus__agence=agence
        ).aggregate(total=Sum('bus__capacite'))['total'] or 0

        places_occupees = Reservation.objects.filter(
            trajet__bus__agence=agence,
            statut='confirmee'
        ).aggregate(total=Sum('nombre_places'))['total'] or 0

        taux_occupation = 0
        if capacite_totale > 0:
            taux_occupation = round((places_occupees / capacite_totale) * 100, 2)

        return Response({
            'gestionnaire': {
                'id': gestionnaire.id,
                'username': gestionnaire.username,
                'email': gestionnaire.email,
                'agence': agence.nom,
            },
            'statistiques': {
                'chiffre_affaires': chiffre_affaires,
                'total_reservations': total_reservations,
                'total_billets': total_billets,
                'total_trajets': total_trajets,
                'total_bus': total_bus,
                'taux_occupation': taux_occupation
            }
        })

    # ✅ CORRECTION : méthode correctement indentée dans la classe
    @action(detail=False, methods=['get'])
    def statistiques(self, request):
        user = self.request.user

        queryset = Reservation.objects.all()

        if (
            getattr(user, 'role', None) == 'GESTIONNAIRE'
            and hasattr(user, 'agence')
        ):
            queryset = queryset.filter(trajet__bus__agence=user.agence)

        confirmed_queryset = queryset.filter(statut='confirmee')
        total = confirmed_queryset.count()

        montant_reservation = ExpressionWrapper(
            F('nombre_places') * F('trajet__prix'),
            output_field=DecimalField(max_digits=12, decimal_places=2)
        )
        revenus_reservations = confirmed_queryset.aggregate(
            total_rev=Sum(montant_reservation)
        )['total_rev'] or 0

        paiements_queryset = Paiement.objects.filter(
            reservation__in=queryset,
            statut='valide'
        )
        revenus_paiements = paiements_queryset.aggregate(
            total_rev=Sum('montant')
        )['total_rev'] or 0

        revenus = revenus_paiements or revenus_reservations

        return Response({
            'total_reservations': queryset.count(),
            'total_confirmations': total,
            'en_attente': queryset.filter(statut='en_attente').count(),
            'annulees': queryset.filter(statut='annulee').count(),
            'revenus_generes': int(revenus)
        })
