from django.conf import settings
import logging
from .providers.twilio import TwilioProvider

logger = logging.getLogger(__name__)

class SMSService:
    """
    Service principal pour l'envoi de SMS.
    Utilise Twilio par défaut.
    """
    
    @staticmethod
    def send_sms(to: str, message: str) -> bool:
        """
        Envoie un SMS via le provider configuré.
        """
        try:
            # ✅ CORRECTION : Ajout automatique de l'indicatif +237 si absent
            if not to.startswith('+'):
                to = '+237' + to
                logger.info(f"🔧 Numéro formaté automatiquement : {to}")

            # Vérification basique des settings
            if not hasattr(settings, 'TWILIO_ACCOUNT_SID') or not settings.TWILIO_ACCOUNT_SID:
                logger.warning("⚠️ Twilio credentials not configured in settings.py")
                return False
            
            # Utilisation du provider Twilio
            provider = TwilioProvider()
            return provider.send(to, message)
            
        except Exception as e:
            logger.error(f"❌ Error sending SMS: {e}")
            return False