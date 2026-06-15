from django.apps import AppConfig


class TrajetsConfig(AppConfig):

    default_auto_field = 'django.db.models.BigAutoField'

    name = 'trajets'

    def ready(self):

        import trajets.signals