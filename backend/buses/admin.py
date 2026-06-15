from django.contrib import admin
from .models import Bus

@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ['matricule', 'type_bus', 'capacite']
    list_filter = ['type_bus']
    search_fields = ['matricule']
    ordering = ['matricule']

