import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-client-paiement',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './client-paiement.html',
  styleUrls: ['./client-paiement.scss']
})
export class ClientPaiement implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  reservation: any = null;
  loading = true;
  processing = false;
  success = false;
  errorText = '';

  selectedMethod = 'orange_money';
  progress = 0;
  progressText = '';
  reservationId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    public router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    const idParam = this.route.snapshot.queryParamMap.get('reservationId');

    if (idParam) {
      this.reservationId = Number(idParam);
      this.loadReservation();
    } else {
      this.errorText = 'Aucune réservation à payer.';
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  loadReservation(): void {
    this.loading = true;
    this.errorText = '';
    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/reservations/${this.reservationId}/`).subscribe({
      next: (data) => {
        this.reservation = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 0) {
          this.errorText = '🔌 Serveur injoignable';
        } else if (err.status === 404) {
          this.errorText = '❌ Réservation non trouvée';
        } else {
          this.errorText = 'Erreur ' + err.status;
        }
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ HELPERS POUR LE RÉCAPITULATIF

  private getTrajet(): any {
    return this.reservation?.trajet_detail || this.reservation?.trajet || {};
  }

  getRoute(): string {
    const t = this.getTrajet();
    return (t.ville_depart || '...') + ' → ' + (t.ville_arrivee || '...');
  }

  getDate(): string {
    const t = this.getTrajet();
    if (!t.date_depart) return 'N/A';
    const d = new Date(t.date_depart);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + (t.heure_depart || '');
  }

  getPrice(): number {
    const t = this.getTrajet();
    return Number(t.prix) || 0;
  }

  getPriceFormatted(): string {
    return new Intl.NumberFormat('fr-FR').format(this.getPrice()) + ' FCFA';
  }

  getNumberOfPlaces(): number {
    return this.reservation?.nombre_places || 1;
  }

  getTotal(): number {
    return this.getPrice() * this.getNumberOfPlaces();
  }

  getTotalFormatted(): string {
    return new Intl.NumberFormat('fr-FR').format(this.getTotal()) + ' FCFA';
  }

  getPaymentSummary(): string {
    const unit = this.getPriceFormatted();
    const qty = this.getNumberOfPlaces();
    const total = this.getTotalFormatted();
    return `${unit} × ${qty} place${qty > 1 ? 's' : ''} = ${total}`;
  }

  getPassengerName(): string {
    return this.reservation?.passager_nom || this.auth.getCurrentUser()?.username || 'Client';
  }

  getPassengerPhone(): string {
    return this.reservation?.passager_tel || 'Non renseigné';
  }

  // ✅ SIMULATION PAIEMENT (barre de progression)
  simulatePayment(): void {
    this.processing = true;
    this.progress = 0;
    this.progressText = 'Connexion sécurisée...';
    this.cdr.detectChanges();

    const steps = [
      { p: 20, t: 'Vérification...' },
      { p: 45, t: 'Chiffrement...' },
      { p: 70, t: 'Transmission...' },
      { p: 90, t: 'Validation...' },
      { p: 100, t: 'Accepté !' }
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        this.progress = steps[i].p;
        this.progressText = steps[i].t;
        this.cdr.detectChanges();
        i++;
      } else {
        clearInterval(interval);
        this.confirmPayment();
      }
    }, 600);
  }

  // ✅ CORRECTION : appel correct vers POST /paiements/ au lieu d'un PATCH direct
  confirmPayment(): void {
    if (!this.reservationId) return;

    // Génération d'un transaction_id simulé unique
    const transactionId = `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const payload = {
      reservation: this.reservationId,
      montant: this.getTotal(),
      methode: this.selectedMethod,
      transaction_id: transactionId,
      telephone_paiement: this.reservation?.passager_tel || null
    };

    this.http.post(`${this.apiUrl}/paiements/`, payload).subscribe({
      next: () => {
        this.success = true;
        this.processing = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.processing = false;
        this.errorText = err.error?.detail || err.error?.non_field_errors?.[0] || 'Échec du paiement. Réessayez.';
        this.cdr.detectChanges();
      }
    });
  }

  retry(): void {
    if (this.reservationId) this.loadReservation();
  }
}