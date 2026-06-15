
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EasyReserve.settings')
django.setup()

from users.models import User

users = User.objects.all()
for u in users:
    agence_info = getattr(u, 'agence', 'No agence')
    print(f"{u.id} - {u.username} - {u.role} - {agence_info}")

