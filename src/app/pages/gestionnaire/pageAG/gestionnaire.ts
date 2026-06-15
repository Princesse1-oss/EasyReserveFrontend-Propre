import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuthService, User } from '../../../services/auth.service';

@Component({
  selector: 'app-gestionnaire',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './gestionnaire.html',
  styleUrl: './gestionnaire.scss'
})
export class GestionnaireComponent implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  user: User | null = null;
  loading = true;
  successMsg = '';
  errorMsg = '';

  agence: any = { nom: 'Administration REBUS', id: null };
  agences: any[] = [];
  gestionnairesStats = { total: 0, actifs: 0, inactifs: 0 };
  buses: any[] = [];
  trajets: any[] = [];
  reservations: any[] = [];
  recentActivities: any[] = [];

  totalAgencesCount = 0;
  totalGestionnairesCount = 0;
  totalReservationsCount = 0;
  totalAnnulationsCount = 0;
  totalBusCount = 0;
  activeBusesCount = 0;
  pendingReservationsCount = 0;
  confirmedReservationsCount = 0;
  activeBusCount = 0;
  chiffreAffaires = 0;
  busesEnRoute = 0;
  tauxOccupation = 0;
  departsAujourdhui = 0;
  revenuPrevisionnel = 0;
  alerteTarif = 'Aucune';

  constructor(
    private http: HttpClient,
    private readonly authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.loadData();
    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.errorMsg = 'Chargement interrompu. Verifiez que le serveur Django est demarre et que votre session est valide.';
        this.calculateMetrics();
      }
    }, 9000);
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToSection(section: 'dashboard' | 'trajets' | 'reservations' | 'buses' | 'paiement' | 'chauffeurs'): void {
    this.successMsg = '';
    this.errorMsg = '';
    const routes: Record<typeof section, string> = {
      dashboard: '/gestionnaire',
      trajets: '/gestionnaire/trajets',
      reservations: '/gestionnaire/reservations',
      buses: '/gestionnaire/buses',
      paiement: '/gestionnaire/paiement',
      chauffeurs: '/gestionnaire/chauffeurs'
    };
    this.router.navigate([routes[section]]);
  }

  loadData(): void {
    this.loading = true;
    this.errorMsg = '';
    const headers = this.getAuthHeaders();

    forkJoin({
      agences: this.http.get<any>(`${this.apiUrl}/agences/`, { headers }).pipe(catchError(() => of({ results: [] }))),
      gestionnaires: this.http.get<any>(`${this.apiUrl}/users/gestionnaires/count/`, { headers }).pipe(catchError(() => of({ total: 0, actifs: 0, inactifs: 0 }))),
      trajets: this.getListWithFallback('/trajets/?page_size=1000'),
      reservations: this.http.get<any>(`${this.apiUrl}/reservations/?page_size=1000`, { headers }).pipe(catchError(() => of({ results: [], count: 0 }))),
      reservationStats: this.http.get<any>(`${this.apiUrl}/reservations/statistiques/`, { headers }).pipe(catchError(() => of(null))),
      buses: this.http.get<any>(`${this.apiUrl}/bus/?page_size=1000`, { headers }).pipe(catchError(() => of({ results: [], count: 0 })))
    }).pipe(
      finalize(() => {
        this.loading = false;
      })
    ).subscribe({
      next: (res) => {
        this.agences = this.extractData(res.agences);
        this.gestionnairesStats = {
          total: Number(res.gestionnaires?.total || 0),
          actifs: Number(res.gestionnaires?.actifs || 0),
          inactifs: Number(res.gestionnaires?.inactifs || 0)
        };
        this.trajets = this.extractData(res.trajets);
        this.reservations = this.extractData(res.reservations);
        this.buses = this.extractData(res.buses);
        this.totalReservationsCount = this.extractCount(res.reservations, this.reservations.length);
        this.totalBusCount = this.extractCount(res.buses, this.buses.length);
        this.agence = this.agences[0] || { nom: 'Administration REBUS', id: null };
        this.calculateMetrics();
        this.applyReservationStats(res.reservationStats);
        this.recentActivities = this.getRecentActivities();
      },
      error: () => {
        this.errorMsg = 'Certaines donnees n ont pas pu etre chargees.';
        this.calculateMetrics();
        this.recentActivities = this.getRecentActivities();
      }
    });
  }

  private getListWithFallback(path: string): Observable<any> {
    const headers = this.getAuthHeaders();
    const emptyResponse = { results: [], count: 0 };

    return this.http.get<any>(`${this.apiUrl}${path}`, { headers }).pipe(
      catchError(() => of(emptyResponse)),
      switchMap((response) => {
        const data = this.extractData(response);
        const count = this.extractCount(response, data.length);
        if (data.length > 0 || count > 0) return of(response);

        return this.http.get<any>(`${this.apiUrl}${path}`).pipe(
          catchError(() => of(response))
        );
      })
    );
  }

  private applyReservationStats(stats: any): void {
    if (!stats) return;

    const total = Number(stats.total_reservations ?? 0);
    const confirmed = Number(stats.total_confirmations ?? stats.confirmees ?? 0);
    const pending = Number(stats.en_attente ?? 0);
    const cancelled = Number(stats.annulees ?? 0);
    const revenue = Number(stats.revenus_generes ?? 0);

    this.totalReservationsCount = Math.max(this.totalReservationsCount, total, confirmed + pending + cancelled);
    this.confirmedReservationsCount = Math.max(this.confirmedReservationsCount, confirmed);
    this.pendingReservationsCount = Math.max(this.pendingReservationsCount, pending);
    this.totalAnnulationsCount = Math.max(this.totalAnnulationsCount, cancelled);
    this.chiffreAffaires = Math.max(this.chiffreAffaires, revenue);
  }

  private extractData(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.data)) return response.data;
    return [];
  }

  private extractCount(response: any, fallback = 0): number {
    if (!response) return fallback;
    if (typeof response.count === 'number') return response.count;
    if (typeof response.total === 'number') return response.total;
    return fallback;
  }

  private calculateMetrics(): void {
    const todayStr = new Date().toISOString().split('T')[0];

    this.totalAgencesCount = this.agences.length;
    this.totalGestionnairesCount = this.gestionnairesStats.total;
    this.totalReservationsCount = Math.max(this.totalReservationsCount, this.reservations.length);
    this.pendingReservationsCount = this.reservations.filter((reservation: any) => {
      const statut = this.normalizeStatus(reservation.statut || reservation.status);
      return statut === 'en_attente' || statut === 'en attente' || statut === 'pending';
    }).length;
    this.confirmedReservationsCount = this.reservations.filter((reservation: any) => {
      const statut = this.normalizeStatus(reservation.statut || reservation.status);
      return statut === 'confirmee' || statut === 'confirme' || statut === 'confirmed';
    }).length;
    this.totalAnnulationsCount = this.reservations.filter((r: any) => {
      const statut = this.normalizeStatus(r.statut || r.status);
      return statut === 'annulee' || statut === 'annule' || statut === 'cancelled';
    }).length;
    this.totalBusCount = Math.max(this.totalBusCount, this.buses.length);
    this.activeBusesCount = this.buses.filter((bus: any) => bus.is_active !== false).length || this.totalBusCount;
    this.activeBusCount = this.activeBusesCount;

    this.departsAujourdhui = this.trajets.filter((t: any) => t.date_depart === todayStr).length;
    this.busesEnRoute = this.trajets.filter((t: any) => {
      const cap = this.getCapacite(t);
      const dispo = this.getPlacesDisponibles(t, cap);
      return dispo < cap;
    }).length;

    this.revenuPrevisionnel = this.trajets.reduce((acc, t: any) => {
      const prix = Number(t.prix) || 0;
      const cap = this.getCapacite(t);
      const dispo = this.getPlacesDisponibles(t, cap);
      const vendues = Math.max(0, cap - dispo);
      return acc + prix * vendues;
    }, 0);

    this.chiffreAffaires = this.reservations
      .filter((r: any) => {
        const statut = this.normalizeStatus(r.statut || r.status);
        return statut === 'confirmee' || statut === 'confirme' || statut === 'confirmed';
      })
      .reduce((acc, r: any) => {
        const prix = Number(r.trajet_detail?.prix || r.trajet?.prix || 0);
        const places = Number(r.nombre_places) || 1;
        return acc + prix * places;
      }, 0);

    const totalPlaces = this.trajets.reduce((sum, t: any) => sum + this.getCapacite(t), 0);
    const placesOccupees = this.trajets.reduce((sum, t: any) => {
      const cap = this.getCapacite(t);
      const dispo = this.getPlacesDisponibles(t, cap);
      return sum + Math.max(0, cap - dispo);
    }, 0);
    this.tauxOccupation = totalPlaces > 0 ? Math.round((placesOccupees / totalPlaces) * 100) : 0;

    const basPrix = this.trajets.filter((t: any) => (Number(t.prix) || 0) < 3000);
    this.alerteTarif = basPrix.length > 0 ? `${basPrix.length} trajet(s) < 3000 FCFA` : 'Aucune';
  }

  private getCapacite(trajet: any): number {
    return trajet.bus_details?.capacite ?? trajet.bus?.capacite ?? 45;
  }

  private getPlacesDisponibles(trajet: any, capacite: number): number {
    const dispo = Number(trajet.places_disponibles);
    if (!Number.isFinite(dispo) || dispo < 0) return capacite;
    return dispo;
  }

  private normalizeStatus(value: any): string {
    return String(value || '').trim().toLowerCase().replace(/-/g, '_');
  }

  getRecentActivities(): any[] {
    const reservationActivities = this.reservations.map((reservation: any) => ({
      type: 'reservation',
      title: `Reservation #${reservation.id || '-'}`,
      description: `${this.getClientLabel(reservation)} - ${this.getTrajetLabel(reservation)}`,
      status: reservation.statut || reservation.status || 'en_attente',
      date: reservation.date_reservation || reservation.created_at || reservation.date_creation,
      action: 'reservations'
    }));

    const trajetActivities = this.trajets.map((trajet: any) => ({
      type: 'trajet',
      title: 'Trajet planifie',
      description: `${trajet.ville_depart || '-'} - ${trajet.ville_arrivee || '-'} a ${trajet.heure_depart || '-'}`,
      status: trajet.statut_depart || trajet.statut || 'planifie',
      date: trajet.date_creation || trajet.created_at || trajet.date_depart,
      action: 'trajets'
    }));

    const busActivities = this.buses.map((bus: any) => ({
      type: 'bus',
      title: 'Bus enregistre',
      description: `${bus.matricule || 'Bus'} - ${bus.capacite || 0} places`,
      status: bus.is_active === false ? 'inactif' : 'actif',
      date: bus.date_creation || bus.created_at || bus.updated_at,
      action: 'buses'
    }));

    return [...reservationActivities, ...trajetActivities, ...busActivities]
      .sort((a, b) => this.getDateTime(b.date) - this.getDateTime(a.date))
      .slice(0, 10);
  }

  getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      reservation: 'bi-ticket-perforated',
      trajet: 'bi-signpost-2',
      bus: 'bi-bus-front'
    };
    return icons[type] || 'bi-clock-history';
  }

  getActivityClass(type: string): string {
    const classes: Record<string, string> = {
      reservation: 'activity reservation',
      trajet: 'activity trajet',
      bus: 'activity bus'
    };
    return classes[type] || 'activity';
  }

  getStatusLabel(value: any): string {
    const status = String(value || '').replace('_', ' ').toLowerCase();
    const labels: Record<string, string> = {
      'en attente': 'En attente',
      pending: 'En attente',
      confirmee: 'Confirmee',
      confirme: 'Confirmee',
      annulee: 'Annulee',
      annule: 'Annulee',
      planifie: 'Planifie',
      parti: 'Depart confirme',
      actif: 'Actif',
      inactif: 'Inactif'
    };
    return labels[status] || status || '-';
  }

  getStatusClass(value: any): string {
    const status = String(value || '').replace('_', ' ').toLowerCase();
    if (['confirmee', 'confirme', 'actif', 'planifie'].includes(status)) return 'status-badge success';
    if (['annulee', 'annule', 'inactif'].includes(status)) return 'status-badge danger';
    return 'status-badge warning';
  }

  getClientLabel(item: any): string {
    return item?.passager_nom || item?.client_username || item?.client_detail?.nom || item?.client?.username || 'Client';
  }

  getTrajetLabel(item: any): string {
    const trajet = item?.trajet_detail || item?.trajet || item;
    const depart = trajet?.ville_depart || trajet?.depart;
    const arrivee = trajet?.ville_arrivee || trajet?.destination;
    if (depart || arrivee) return `${depart || '-'} - ${arrivee || '-'}`;
    return typeof trajet === 'number' ? `Trajet #${trajet}` : 'Trajet non renseigne';
  }

  formatShortDate(value: any): string {
    if (!value) return 'Date non renseignee';
    try {
      return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(value);
    }
  }

  private getDateTime(value: any): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
}
