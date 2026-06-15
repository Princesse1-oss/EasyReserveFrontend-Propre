from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from django.conf import settings
import logging
from .base import SMSProviderInterface

logger = logging.getLogger(__name__)

class TwilioProvider(SMSProviderInterface):
    """Implémentation du provider Twilio"""
    
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_PHONE_NUMBER
        
        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.warning("️ Twilio credentials incomplete")
        
        self.client = Client(self.account_sid, self.auth_token)
    
    def send(self, to: str, message: str) -> bool:
        try:
            if not to.startswith('+'):
                logger.error(f"❌ Invalid phone format: {to}")
                return False
                
            message_obj = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to
            )
            
            logger.info(f"✅ SMS sent via Twilio: {message_obj.sid}")
            return True
            
        except TwilioRestException as e:
            logger.error(f"❌ Twilio API error: {e.msg}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            return False
    
    def get_provider_name(self) -> str:
        return "Twilio"