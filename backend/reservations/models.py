from django.db import models
from django.conf import settings
from trajets.models import Trajet
from places.models import Place

class Reservation(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('confirmee', 'Confirmée'),
        ('annulee', 'Annulée'),
    ]

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reservations_client',
        verbose_name="Client"
    )
    trajet = models.ForeignKey(
        Trajet,
        on_delete=models.CASCADE,  # ✅ Supprime automatiquement les réservations liées
        related_name='reservations_trajet',
        verbose_name="Trajet"
    )
    place = models.ForeignKey(
        Place,
        on_delete=models.SET_NULL,  # 🔧 SET_NULL recommandé pour garder l'historique si un siège est reconfiguré
        related_name='reservations_place',
        null=True,
        blank=True,
        verbose_name="Siège"
    )
    
    # ✅ Champs ajoutés avec verbose_name pour l'admin Django
    nombre_places = models.PositiveIntegerField(default=1, verbose_name="Nombre de places")
    passager_nom = models.CharField(max_length=150, default='', blank=True, verbose_name="Nom du passager")
    passager_tel = models.CharField(max_length=20, default='', blank=True, verbose_name="Téléphone")
    mode_paiement = models.CharField(max_length=20, default='', blank=True, verbose_name="Mode de paiement")

    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='en_attente',
        verbose_name="Statut"
    )
    date_reservation = models.DateTimeField(auto_now_add=True, verbose_name="Date de réservation")

    class Meta:
        # ✅ Remplace `unique_together` (déprécié) par la syntaxe moderne Django
        constraints = [
            models.UniqueConstraint(
                fields=['trajet', 'place'],
                name='unique_reservation_trajet_place'
            )
        ]
        ordering = ['-date_reservation']
        verbose_name = "Réservation"
        verbose_name_plural = "Réservations"

    def __str__(self):
        # ✅ Affiche le statut lisible au lieu du code brut
        return f"Réservation #{self.id} - {self.client.username} ({self.get_statut_display()})"

        