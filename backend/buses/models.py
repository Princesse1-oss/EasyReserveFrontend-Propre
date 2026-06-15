from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from agences.models import Agence

class Bus(models.Model):
    TYPE_CHOICES = (
        ('standard', 'Standard'),
        ('vip', 'VIP'),
        ('minibus', 'Minibus'),
    )

    matricule = models.CharField(max_length=50, unique=True)
    capacite = models.PositiveIntegerField()
    type_bus = models.CharField(max_length=20, choices=TYPE_CHOICES, default='standard')
    is_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    # Association stricte à une agence
    agence = models.ForeignKey(
       'agences.Agence',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='buses'
    )

    def __str__(self):
        return f"{self.matricule} ({self.get_type_bus_display()})"


@receiver(post_save, sender=Bus)
def generer_places_automatique(sender, instance, created, **kwargs):
    """
    Signal Django : Génère automatiquement les sièges numérotés 
    dans la table 'places' dès qu'un bus est créé.
    """
    if created:
        from places.models import Place  # Import local pour éviter les imports circulaires
        
        places_a_creer = [
            Place(numero_siege=i, bus=instance, disponible=True)
            for i in range(1, instance.capacite + 1)
        ]
        Place.objects.bulk_create(places_a_creer)
