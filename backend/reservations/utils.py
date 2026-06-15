import io
import qrcode
from reportlab.lib.pagesizes import A6
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader  # ✅ Import crucial pour gérer les BytesIO

def generate_ticket(reservation):
    """Génère un billet PDF complet avec QR Code"""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A6)
    width, height = A6

    # 1. En-tête
    p.setFillColor(colors.HexColor("#667eea"))
    p.rect(0, height - 40, width, 40, fill=1, stroke=0)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 16)
    p.drawString(20, height - 25, "EasyReserve")
    p.setFont("Helvetica", 10)
    p.drawString(20, height - 40, "Votre billet de voyage")

    # 2. Infos Trajet
    p.setFillColor(colors.black)
    p.setFont("Helvetica-Bold", 12)
    p.drawString(20, height - 60, f"{reservation.trajet.ville_depart} ➔ {reservation.trajet.ville_arrivee}")
    p.setFont("Helvetica", 10)
    p.drawString(20, height - 75, f"Date : {reservation.trajet.date_depart} à {reservation.trajet.heure_depart}")
    p.drawString(20, height - 90, f"Passager : {reservation.passager_nom or reservation.client.username}")
    p.drawString(20, height - 105, f"Sièges : {reservation.nombre_places}")

    # Ligne de séparation
    p.setStrokeColor(colors.lightgrey)
    p.line(20, height - 115, width - 20, height - 115)

    # 3. Prix
    p.setFont("Helvetica-Bold", 14)
    p.setFillColor(colors.HexColor("#28a745"))
    total = float(reservation.trajet.prix) * reservation.nombre_places
    p.drawString(20, height - 140, f"TOTAL PAYÉ : {total:,.0f} FCFA")

    # 4. QR Code (✅ Correction BytesIO)
    qr_data = f"EasyReserve\nID:{reservation.id}\nTrajet:{reservation.trajet.id}\nStatut:Confirmé"
    qr_img = qrcode.make(qr_data)
    qr_bytes = io.BytesIO()
    qr_img.save(qr_bytes, format="PNG")
    qr_bytes.seek(0)
    
    # ✅ Utilisation de ImageReader pour que ReportLab accepte le flux binaire
    p.drawImage(ImageReader(qr_bytes), width / 2 - 17.5 * mm, height / 2 - 60 * mm, width=35*mm, height=35*mm)

    # 5. Footer
    p.setFont("Helvetica-Oblique", 8)
    p.setFillColor(colors.grey)
    p.drawString(20, 20, "Présentez ce billet à l'agent avant l'embarquement.")
    p.drawString(20, 10, f"Réf: #{reservation.id}")

    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer