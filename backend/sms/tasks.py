from celery import shared_task
from sms.services import SMSService
from reservations.models import Reservation
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_reservation_sms_task(self, reservation_id):
    """
    Tâche Celery pour envoyer un SMS de confirmation de réservation.
    """
    try:
        # Récupère la réservation avec le trajet
        reservation = Reservation.objects.select_related('trajet').get(id=reservation_id)
        
        # Vérifie qu'on a un numéro
        if not reservation.passager_tel:
            logger.warning(f"⚠️ No phone number for reservation #{reservation_id}")
            return False
        
        # Formate le message SMS
        message = f"""EasyReserve ✅
Ticket #{reservation.id}
{reservation.trajet.ville_depart} → {reservation.trajet.ville_arrivee}
📅 {reservation.trajet.date_depart.strftime('%d/%m/%Y')} à {reservation.trajet.heure_depart}
🪑 {reservation.nombre_places} place(s)
Passager: {reservation.passager_nom}
Merci de voyager avec nous! 🚌"""
        
        # Nettoie le message (une seule ligne)
        message = ' '.join(message.split())
        
        # Envoie le SMS via Twilio
        success = SMSService.send_sms(reservation.passager_tel, message)
        
        if success:
            logger.info(f"✅ SMS sent to {reservation.passager_tel} for reservation #{reservation_id}")
            return True
        else:
            logger.error(f"❌ SMS failed for reservation #{reservation_id}")
            raise Exception("SMSService returned False")
            
    except Reservation.DoesNotExist:
        logger.error(f"❌ Reservation #{reservation_id} does not exist")
        return False
    except Exception as exc:
        # Retry avec backoff exponentiel
        logger.warning(f"⚠️ Retrying SMS send for reservation #{reservation_id} (attempt {self.request.retries + 1}/3)")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))