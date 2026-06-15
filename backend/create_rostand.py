import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EasyReserve.settings')
django.setup()

from django.contrib.auth import get_user_model
from agences.models import Agence

User = get_user_model()

# Créer ou récupérer l'agence General Voyage
agence, created = Agence.objects.get_or_create(
    nom='General Voyage',
    defaults={
        'adresse': '',
        'telephone': '',
        'email_contact': ''
    }
)
if created:
    print('Agence General Voyage créée')
else:
    print('Agence General Voyage déjà existante')

# Créer l'utilisateur Rostand
rostand, created = User.objects.get_or_create(
    username='Rostand',
    defaults={
        'email': 'rostand@example.com',
        'first_name': 'Rostand',
        'last_name': 'Ngaba',
        'role': 'GESTIONNAIRE',
        'telephone': ''
    }
)
if created:
    rostand.set_password('EasyReserve@Rostand2025')
    rostand.save()
    print('Utilisateur Rostand créé: Rostand / EasyReserve@Rostand2025')
else:
    rostand.set_password('EasyReserve@Rostand2025')
    rostand.save()
    print('Utilisateur Rostand mis à jour')

# Assigner l'agence à Rostand
agence.gestionnaire = rostand
agence.save()
print('Agence General Voyage assignée à Rostand')

print('\nTout est prêt !')
