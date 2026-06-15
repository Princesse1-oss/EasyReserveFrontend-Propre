from django.db.models.signals import post_save
from django.dispatch import receiver
from reservations.models import Reservation
from sms.tasks import send_reservation_sms_task
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Reservation)
def trigger_sms_on_reservation_confirm(sender, instance, created, **kwargs):
    """
    Déclenche l'envoi SMS quand une réservation est confirmée.
    """
    # On vérifie que le statut est bien 'confirmee'
    if instance.statut == 'confirmee' and instance.passager_tel:
        logger.info(f"📱 Signal reçu pour la réservation #{instance.id}")
        
        try:
            # ✅ APPEL DIRECT (Synchrone) au lieu de .delay()
            # Cela envoie le SMS immédiatement sans passer par Celery/Redis
            result = send_reservation_sms_task(instance.id)
            
            if result:
                logger.info(f"✅ SMS envoyé avec succès à {instance.passager_tel}")
            else:
                logger.error(f"❌ Échec de l'envoi SMS")
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'appel SMS : {e}")