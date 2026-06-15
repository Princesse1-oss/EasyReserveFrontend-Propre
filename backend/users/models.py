from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # 💡 Solution: Forced uppercase codes to preserve synchronization with DRF and Angular tokens
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('GESTIONNAIRE', 'Gestionnaire'),
        ('CLIENT', 'Client'),
    )

    telephone = models.CharField(
        max_length=20,
        null=True,     # Added robustness for admin users missing a mobile number
        blank=True
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='CLIENT' # Default is now uppercase
    )

    def __str__(self):
        return self.username
