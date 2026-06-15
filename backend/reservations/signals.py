from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import EmailMessage
from django.conf import settings
from .models import Reservation
from .utils import generate_ticket


@receiver(post_save, sender=Reservation)
def envoyer_notification_reservation(sender, instance, created, **kwargs):
    """
    Déclenche automatiquement un email au client selon l'état de sa réservation.
    """
    client_email = instance.client.email
    if not client_email:
        return  # Sécurité si l'utilisateur n'a pas renseigné son email

    if created:
        # Cas 1 : Création de la réservation (En attente de paiement)
        subject = f"[EasyReserve] Réservation N°{instance.id} enregistrée"
        body = f"Bonjour {instance.client.username},\n\nVotre réservation pour le trajet {instance.trajet} a bien été prise en compte.\nElle est actuellement en attente de paiement."
        email = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, [client_email])
        try:
            email.send(fail_silently=True)
        except Exception:
            pass

    else:
        # Cas 2 : La réservation vient d'être confirmée par l'encaissement du paiement
        if instance.statut == 'confirmee':
            subject = f"[EasyReserve] Confirmation de votre voyage - Billet N°{instance.id}"
            body = f"Félicitations {instance.client.username} !\n\nVotre paiement a été validé. Vous trouverez ci-joint votre billet officiel de voyage pour le trajet {instance.trajet}.\n\nMerci de votre confiance,\nL'équipe EasyReserve."
            
            email = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, [client_email])
            
            # Génération et fixation du billet PDF en pièce jointe
            try:
                ticket_path = generate_ticket(instance)
                email.attach_file(ticket_path)
                email.send(fail_silently=True)
            except Exception:
                pass

        # Cas 3 : La réservation a été annulée
        elif instance.statut == 'annulee':
            subject = f"[EasyReserve] Annulation de la réservation N°{instance.id}"
            body = f"Bonjour {instance.client.username},\n\nNous vous confirmons que votre réservation pour le trajet {instance.trajet} a bien été annulée."
            email = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, [client_email])
            try:
                email.send(fail_silently=True)
            except Exception:
                pass

@receiver(post_save, sender=Reservation)
def trigger_sms_on_confirm(sender, instance, created, **kwargs):
    """Déclenche l'envoi SMS après création d'une réservation confirmée"""
    if created and instance.statut == 'confirmee' and instance.passager_tel:
        send_reservation_sms_task.delay(instance.id)
