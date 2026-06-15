from django.apps import AppConfig

class ReservationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reservations'

    def ready(self):
        # 💡 Import obligatoire ici pour enregistrer les écouteurs de signaux
        import reservations.signals
