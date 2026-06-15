from django.db import models
from buses.models import Bus


class Chauffeur(models.Model):
    STATUT_CHOICES = [
        ('actif', 'Actif'),
        ('inactif', 'Inactif'),
        ('conge', 'En congé'),
    ]

    nom = models.CharField(max_length=100, verbose_name='Nom')
    prenom = models.CharField(max_length=100, verbose_name='Prénom')
    telephone = models.CharField(max_length=20, verbose_name='Téléphone')
    email = models.EmailField(blank=True, default='', verbose_name='Email')
    numero_permis = models.CharField(
        max_length=50, unique=True,
        verbose_name='Numéro de permis'
    )
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='actif',
        verbose_name='Statut'
    )
    bus_assigne = models.ForeignKey(
        Bus,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chauffeurs',
        verbose_name='Bus assigné'
    )
    date_embauche = models.DateField(null=True, blank=True, verbose_name='Date d\'embauche')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nom', 'prenom']
        verbose_name = 'Chauffeur'
        verbose_name_plural = 'Chauffeurs'

    def __str__(self):
        return f"{self.prenom} {self.nom} — {self.numero_permis}"
