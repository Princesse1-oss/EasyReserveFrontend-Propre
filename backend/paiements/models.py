from django.db import models
from reservations.models import Reservation

class Paiement(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('valide', 'Validé'),
        ('echoue', 'Échoué'),
        ('annule', 'Annulé'),
    ]
    
    METHODE_CHOICES = [
        ('orange_money', 'Orange Money'),
        ('mtn_momo', 'MTN Mobile Money'),
        ('carte', 'Carte bancaire'),
        ('espece', 'Espèces'),
    ]

    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name='paiements')
    montant = models.PositiveIntegerField(help_text="Montant total en FCFA")
    methode = models.CharField(max_length=20, choices=METHODE_CHOICES)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    
    transaction_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID de transaction opérateur")
    telephone_paiement = models.CharField(max_length=20, blank=True, null=True, help_text="Numéro Mobile Money")
    
    date_paiement = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_paiement']
        verbose_name = 'Paiement'
        verbose_name_plural = 'Paiements'

    def __str__(self):
        return f"Paiement #{self.id} - {self.get_methode_display()} - {self.montant} FCFA"