import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuthService, User } from '../../../services/auth.service';

export interface TrajetDetail {
  id: number;
  ville_depart: string;
  ville_arrivee: string;
  date_depart: string;
  heure_depart: string;
  prix: number;
  places_disponibles: number;
  statut_depart?: string;
  bus_details?: {
    id?: number;
    type_bus: string;
    agence_nom?: string;
    capacite?: number;
  };
  bus?: number;
  agence_nom?: string;
}

export interface SiegePlan {
  id: number;
  numero_siege: number;
  disponible: boolean;
}

@Component({
  selector: 'app-client-trajet-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './client-trajet-detail.html',
  styleUrl: './client-trajet-detail.scss'
})
export class ClientTrajetDetail implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  trajet: TrajetDetail | null = null;
  sieges: SiegePlan[] = [];
  reservationForm!: FormGroup;
  loading = true;
  loadingSieges = false;
  processing = false;
  errorText = '';
  trajetId: number | null = null;

  private timeoutId: any = null;
  private subscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private fb: FormBuilder,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.route.snapshot.url.join('/') } });
      return;
    }

    this.reservationForm = this.fb.group({
      nombre_places: [1, [Validators.required, Validators.min(1), Validators.max(999)]],
      passager_tel: ['', [Validators.required, Validators.pattern(/^[0-9]{9,15}$/)]]
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    this.trajetId = idParam ? Number(idParam) : null;

    if (this.trajetId && !isNaN(this.trajetId)) {
      this.loadData();
    } else {
      this.setError('ID de trajet invalide.');
    }
  }

  loadData(): void {
    this.loading = true;
    this.errorText = '';

    this.timeoutId = setTimeout(() => {
      this.setError('Le serveur met trop de temps à répondre.');
    }, 10000);

    this.subscription = this.http.get<TrajetDetail>(`${this.apiUrl}/trajets/${this.trajetId}/`).pipe(
      finalize(() => {
        clearTimeout(this.timeoutId);
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.trajet = data;

        // Mise à jour du validateur MAX
        const maxPlaces = data.places_disponibles ?? 0;
        const placesControl = this.reservationForm.get('nombre_places');
        if (placesControl) {
          placesControl.setValidators([Validators.required, Validators.min(1), Validators.max(maxPlaces)]);
          placesControl.updateValueAndValidity();
          if (placesControl.value > maxPlaces) placesControl.setValue(Math.max(1, maxPlaces));
        }

        // Charger le plan de siège depuis le bus du trajet
        const busId = data.bus_details?.id || data.bus;
        if (busId) {
          this.chargerPlanSieges(Number(busId));
        }

        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) this.setError('Serveur injoignable.');
        else if (err.status === 404) this.setError('Ce trajet n\'existe plus.');
        else this.setError(`Erreur serveur (${err.status}).`);
      }
    });
  }

  chargerPlanSieges(busId: number): void {
    this.loadingSieges = true;
    this.http.get<any>(`${this.apiUrl}/places/?bus=${busId}&page_size=100`).pipe(
      finalize(() => { this.loadingSieges = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (res: any) => {
        const raw: SiegePlan[] = Array.isArray(res) ? res : (res?.results || []);
        // Marquer les sièges déjà réservés pour CE trajet (confirmee ou en_attente)
        this.http.get<any>(`${this.apiUrl}/reservations/?trajet=${this.trajetId}&page_size=200`).subscribe({
          next: (resData: any) => {
            const reservations = Array.isArray(resData) ? resData : (resData?.results || []);
            const siegesReserves = new Set<number>();
            reservations.forEach((r: any) => {
              if (r.place && (r.statut === 'confirmee' || r.statut === 'en_attente')) {
                siegesReserves.add(r.place);
              }
            });
            this.sieges = raw.map(s => ({
              ...s,
              disponible: !siegesReserves.has(s.id) && s.disponible
            })).sort((a, b) => a.numero_siege - b.numero_siege);
            this.cdr.detectChanges();
          },
          error: () => {
            // Fallback : afficher les sièges sans croisement réservations
            this.sieges = raw.sort((a, b) => a.numero_siege - b.numero_siege);
            this.cdr.detectChanges();
          }
        });
      },
      error: () => { this.sieges = []; }
    });
  }

  // Sièges organisés en rangées de 4 (2+2) comme un bus
  get siegesParRangees(): SiegePlan[][] {
    const rows: SiegePlan[][] = [];
    for (let i = 0; i < this.sieges.length; i += 4) {
      rows.push(this.sieges.slice(i, i + 4));
    }
    return rows;
  }

  get siegesDisponiblesCount(): number {
    return this.sieges.filter(s => s.disponible).length;
  }

  onSubmit(): void {
    if (this.reservationForm.invalid || !this.trajet) {
      this.reservationForm.markAllAsTouched();
      return;
    }

    // Vérifier que le trajet n'est pas parti
    if (this.trajet.statut_depart === 'parti') {
      alert('Ce trajet est déjà parti. Impossible de réserver.');
      return;
    }

    const form = this.reservationForm.value;
    const places = Number(form.nombre_places);

    if (places > this.trajet.places_disponibles) {
      alert(`Il ne reste que ${this.trajet.places_disponibles} places.`);
      return;
    }

    this.processing = true;

    const currentUser = this.auth.getCurrentUser();
    const payload = {
      trajet: Number(this.trajet.id),
      nombre_places: places,
      passager_nom: (currentUser?.first_name || currentUser?.username || 'Client').trim(),
      passager_tel: String(form.passager_tel || '').trim(),
      statut: 'en_attente'
    };

    this.http.post<{ id: number }>(`${this.apiUrl}/reservations/`, payload).subscribe({
      next: (res) => {
        this.processing = false;
        this.router.navigate(['/client/paiement'], { queryParams: { reservationId: res.id } });
      },
      error: (err) => {
        this.processing = false;
        alert(err.error?.detail || err.error?.nombre_places?.[0] || 'Erreur lors de la réservation.');
      }
    });
  }

  getUserName(): string {
    const u = this.auth.getCurrentUser();
    return u ? (u.first_name || u.username || 'Utilisateur') : 'Utilisateur';
  }

  incrementPlaces(): void {
    const current = this.reservationForm.value.nombre_places || 0;
    const max = this.trajet?.places_disponibles || 0;
    if (current < max) this.reservationForm.patchValue({ nombre_places: current + 1 });
  }

  decrementPlaces(): void {
    const current = this.reservationForm.value.nombre_places || 1;
    if (current > 1) this.reservationForm.patchValue({ nombre_places: current - 1 });
  }

  calculateTotal(): string {
    if (!this.trajet) return '0 FCFA';
    const n = this.reservationForm.value.nombre_places || 1;
    return new Intl.NumberFormat('fr-FR').format(this.trajet.prix * n) + ' FCFA';
  }

  setError(msg: string): void {
    this.errorText = msg;
    this.loading = false;
    clearTimeout(this.timeoutId);
    this.cdr.detectChanges();
  }

  retry(): void { if (this.trajetId) this.loadData(); }

  get f() { return this.reservationForm.controls; }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
    if (this.subscription) this.subscription.unsubscribe();
  }
}
