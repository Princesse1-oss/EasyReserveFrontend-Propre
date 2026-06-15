from django.db import models
from django.utils import timezone
from django.db.models import Sum  # ✅ IMPORT CRUCIAL
from buses.models import Bus

class Trajet(models.Model):
    STATUT_DEPART_CHOICES = [
        ('planifie', 'Planifié'),
        ('parti', 'Parti'),
        ('annule', 'Annulé'),
    ]

    ville_depart = models.CharField(max_length=100)
    ville_arrivee = models.CharField(max_length=100)
    date_depart = models.DateField()
    heure_depart = models.TimeField()
    prix = models.DecimalField(max_digits=10, decimal_places=2)

    bus = models.ForeignKey(
        Bus,
        on_delete=models.CASCADE,
        related_name='trajets_app'
    )

    statut_depart = models.CharField(
        max_length=20,
        choices=STATUT_DEPART_CHOICES,
        default='planifie',
        verbose_name='Statut du départ'
    )

    date_creation = models.DateTimeField(null=True, blank=True, auto_now_add=True)

    def __str__(self):
        return f"{self.ville_depart} -> {self.ville_arrivee} ({self.date_depart})"

    @property
    def places_disponibles(self):
        """
        Calcul correct : capacité bus - places réservées (en_attente + confirmee).
        Si le trajet est parti, aucune place disponible.
        """
        from reservations.models import Reservation

        if self.statut_depart == 'parti':
            return 0

        if not self.bus or not self.bus.capacite:
            return 0

        reserved = Reservation.objects.filter(
            trajet=self,
            statut__in=['en_attente', 'confirmee']
        ).aggregate(total=Sum('nombre_places'))['total']

        total_reserved = reserved if reserved else 0
        return max(0, self.bus.capacite - total_reserved)