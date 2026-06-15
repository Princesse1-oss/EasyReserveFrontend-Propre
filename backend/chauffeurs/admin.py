from django.contrib import admin
from .models import Chauffeur


@admin.register(Chauffeur)
class ChauffeurAdmin(admin.ModelAdmin):
    list_display = ['nom', 'prenom', 'telephone', 'numero_permis', 'statut', 'bus_assigne']
    list_filter = ['statut']
    search_fields = ['nom', 'prenom', 'numero_permis', 'telephone']
    ordering = ['nom', 'prenom']
