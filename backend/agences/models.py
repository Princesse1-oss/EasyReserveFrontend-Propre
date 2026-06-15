from django.db import models
from django.conf import settings

class Agence(models.Model):
    nom = models.CharField(max_length=150, unique=True)
    
    # 💡 Ajout de null=True, blank=True sur ces champs pour bloquer les questions de Django
    adresse = models.CharField(max_length=255, null=True, blank=True)
    telephone = models.CharField(max_length=50, null=True, blank=True)
    email_contact = models.EmailField(null=True, blank=True)
    date_creation = models.DateTimeField(null=True, blank=True)
    
    gestionnaire = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'GESTIONNAIRE'},
        related_name='agence'
    )

    def __str__(self):
        return self.nom

