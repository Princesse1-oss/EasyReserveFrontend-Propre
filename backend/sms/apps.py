from django.apps import AppConfig

class SmsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sms'

    def ready(self):
        # ✅ IMPORTANT : Charge les signaux quand l'app démarre
        import sms.signals  # noqa: F401
        print("SMS signals loaded successfully")