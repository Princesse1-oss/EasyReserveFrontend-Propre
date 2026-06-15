from django.db import models
from buses.models import Bus

class Place(models.Model):
    numero_siege = models.PositiveIntegerField(null=True, blank=True)
    bus = models.ForeignKey(
        Bus,
        on_delete=models.CASCADE,
        related_name='places',
        null=True,
        blank=True
    )
    disponible = models.BooleanField(default=True)

    class Meta:
        unique_together = ['numero_siege', 'bus']
        ordering = ['numero_siege']

    def __str__(self):
        return f"Siège {self.numero_siege or 'Inconnu'} - Bus {self.bus.matricule if self.bus else 'Sans Bus'}"
