import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EasyReserve.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

# Créer un utilisateur ADMIN
admin, created = User.objects.get_or_create(
    username='admin',
    defaults={
        'email': 'admin@example.com',
        'first_name': 'Admin',
        'last_name': 'Test',
        'role': 'ADMIN',
        'is_staff': True,
        'is_superuser': True
    }
)
if created:
    admin.set_password('admin123')
    admin.save()
    print('Admin créé: admin / admin123')
else:
    admin.set_password('admin123')
    admin.save()
    print('Admin mis à jour')

# Créer un utilisateur GESTIONNAIRE
gestionnaire, created = User.objects.get_or_create(
    username='gestionnaire',
    defaults={
        'email': 'gestionnaire@example.com',
        'first_name': 'John',
        'last_name': 'Manager',
        'role': 'GESTIONNAIRE',
        'telephone': '+237691234567'
    }
)
if created:
    gestionnaire.set_password('pass1234')
    gestionnaire.save()
    print('Gestionnaire créé: gestionnaire / pass1234')
else:
    gestionnaire.set_password('pass1234')
    gestionnaire.save()
    print('Gestionnaire mis à jour')

# Créer un utilisateur CLIENT
client, created = User.objects.get_or_create(
    username='client',
    defaults={
        'email': 'client@example.com',
        'first_name': 'Alice',
        'last_name': 'Voyageur',
        'role': 'CLIENT',
        'telephone': '+237698765432'
    }
)
if created:
    client.set_password('client123')
    client.save()
    print('Client créé: client / client123')
else:
    client.set_password('client123')
    client.save()
    print('Client mis à jour')

print('\nTous les utilisateurs test sont prêts!')
