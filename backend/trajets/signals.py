from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Trajet
from places.models import Place

@receiver(post_save, sender=Trajet)
def create_places(sender, instance, created, **kwargs):
    if created and instance.bus:
        Place.objects.bulk_create([
            Place(numero_siege=i, bus=instance.bus, disponible=True)
            for i in range(1, instance.bus.capacite + 1)
        ], ignore_conflicts=True)