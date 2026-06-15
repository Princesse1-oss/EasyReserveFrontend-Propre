import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { catchError, finalize, forkJoin, of, timeout } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

// ==================== INTERFACES ====================
export interface TrajetStatus {
  id: number;
  ville_depart: string;
  ville_arrivee: string;
  date_depart: string;
  heure_depart: string;
  prix: number;
  places_disponibles?: number;
  bus_details?: { type_bus?: string; agence_nom?: string; capacite?: number };
}

export interface ReservationItem {
  id: number;
  client_username: string;
  trajet_detail?: { 
    id: number; 
    ville_depart: string; 
    ville_arrivee: string; 
    date_depart: string;
    heure_depart: string;
    prix: number;
  };
  statut: 'en_attente' | 'confirmee' | 'annulee';
  nombre_places: number;
  passager_nom: string;
  passager_tel?: string;
  date_reservation: string;
  mode_paiement?: string;
}

export interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: { label: string; handler: () => void };
}

export interface ReservationStats {
  total: number;
  en_attente: number;
  confirmee: number;
  annulee: number;
  revenu_confirmee: number;
  revenu_potentiel: number;
  taux_conversion: number;
  departs_aujourd_hui: number;
  bus_plein_alert: number;
}

@Component({
  selector: 'app-gestionnaire-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterModule],
  templateUrl: './reservations.html',
  styleUrl: './reservations.scss'
})
export class GestionnaireReservations implements OnInit {
  private readonly apiUrl = environment.apiUrl;
  
  // ✅ MODE ADMIN
  isAdminMode = false;
  managerId: string | null = null;
  gestionnaireNom = '';
  agenceNom = '';
  
  // Données
  reservations: ReservationItem[] = [];
  filteredReservations: ReservationItem[] = [];
  trajets: TrajetStatus[] = [];
  
  // États UI
  loading = false;
  errorText = '';
  showNotifications = false;
  
  // Filtres
  searchQuery = '';
  filterStatut = 'all';
  filterDate = '';
  
  // ✅ STATS / KPIs
  stats: ReservationStats = {
    total: 0,
    en_attente: 0,
    confirmee: 0,
    annulee: 0,
    revenu_confirmee: 0,
    revenu_potentiel: 0,
    taux_conversion: 0,
    departs_aujourd_hui: 0,
    bus_plein_alert: 0
  };
  
  // ✅ NOTIFICATIONS
  notifications: NotificationItem[] = [];
  unreadCount = 0;

  // ✅ CORRECTION : tempMessage doit être public pour le template
  tempMessage: { text: string; type: 'success' | 'danger' | 'info' } | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // ✅ DETECTION MODE ADMIN
    this.managerId = this.route.snapshot.paramMap.get('managerId');
    this.isAdminMode = !!this.managerId;
    if (this.isAdminMode) {
      this.gestionnaireNom = this.route.snapshot.queryParamMap.get('nom') || 'Gestionnaire';
      this.agenceNom = this.route.snapshot.queryParamMap.get('agence') || 'Agence inconnue';
    }
    
    this.loadData();
    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.errorText = 'Chargement interrompu. Verifiez que le serveur Django est demarre et que votre session est valide.';
        this.cdr.detectChanges();
      }
    }, 9000);
  }

  goBack(): void {
    this.router.navigate([this.isAdminMode ? `/dashboard/gestionnaires/${this.managerId}/activites` : '/gestionnaire'], {
      queryParams: this.isAdminMode ? { nom: this.gestionnaireNom, agence: this.agenceNom } : {}
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadData(): void {
    this.loading = true;
    this.errorText = '';

    // ✅ Construire les URLs avec managerId si mode admin
    const reservationsUrl = this.isAdminMode 
      ? `${this.apiUrl}/reservations/?manager_id=${this.managerId}` 
      : `${this.apiUrl}/reservations/`;
    const trajetsUrl = this.isAdminMode 
      ? `${this.apiUrl}/trajets/?manager_id=${this.managerId}` 
      : `${this.apiUrl}/trajets/`;

    forkJoin({
      reservations: this.http.get<ReservationItem[]>(reservationsUrl, { 
        headers: this.getAuthHeaders() 
      }).pipe(timeout(8000), catchError(() => of([]))),
      trajets: this.http.get<TrajetStatus[]>(trajetsUrl, {
        headers: this.getAuthHeaders()
      }).pipe(timeout(8000), catchError(() => of([])))
    }).pipe(
      finalize(() => { this.loading = false; })
    ).subscribe({
      next: ({ reservations, trajets }) => {
        const reservationList = this.extractData(reservations);
        const trajetList = this.extractData(trajets);
        const validTrajetIds = new Set(trajetList.map(t => t.id));
        
        this.reservations = reservationList.filter(r => {
          const trajetId = r.trajet_detail?.id;
          return !trajetId || validTrajetIds.has(trajetId);
        }).sort((a, b) => 
          new Date(b.date_reservation).getTime() - new Date(a.date_reservation).getTime()
        );
        
        this.trajets = trajetList;
        this.filteredReservations = [...this.reservations];
        
        this.calculateStats();
        this.generateNotifications();
        this.applyFilters();
      },
      error: (err: HttpErrorResponse) => {
        console.error('❌ Erreur chargement:', err);
        this.errorText = err.status === 401 
          ? '🔐 Session expirée. Reconnectez-vous.' 
          : 'Erreur de chargement des données.';
      }
    });
  }

  private calculateStats(): void {
    const today = new Date().toISOString().split('T')[0];
    
    this.stats.total = this.reservations.length;
    this.stats.en_attente = this.reservations.filter(r => r.statut === 'en_attente').length;
    this.stats.confirmee = this.reservations.filter(r => r.statut === 'confirmee').length;
    this.stats.annulee = this.reservations.filter(r => r.statut === 'annulee').length;
    
    this.stats.revenu_confirmee = this.reservations
      .filter(r => r.statut === 'confirmee')
      .reduce((sum, r) => sum + (r.trajet_detail?.prix || 0) * r.nombre_places, 0);
    
    this.stats.revenu_potentiel = this.reservations
      .filter(r => r.statut === 'en_attente')
      .reduce((sum, r) => sum + (r.trajet_detail?.prix || 0) * r.nombre_places, 0);
    
    this.stats.taux_conversion = this.stats.total > 0 
      ? Math.round((this.stats.confirmee / this.stats.total) * 100) 
      : 0;
    
    this.stats.departs_aujourd_hui = this.trajets.filter(t => 
      t.date_depart.startsWith(today)
    ).length;
    
    this.stats.bus_plein_alert = this.trajets.filter(t => {
      const cap = t.bus_details?.capacite || 45;
      const dispo = t.places_disponibles ?? cap;
      const taux = ((cap - dispo) / cap) * 100;
      return taux >= 80 && taux < 100;
    }).length;
  }

  private generateNotifications(): void {
    this.notifications = [];
    const today = new Date().toISOString().split('T')[0];
    
    const pendingToday = this.reservations.filter(r => 
      r.statut === 'en_attente' && r.date_reservation.startsWith(today)
    );
    if (pendingToday.length > 0) {
      this.notifications.push({
        id: 'pending_today',
        type: 'warning',
        title: `${pendingToday.length} réservation(s) en attente`,
        message: `${pendingToday.length} nouvelle(s) réservation(s) à valider aujourd'hui.`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'Voir les pending',
          handler: () => {
            this.filterStatut = 'en_attente';
            this.applyFilters();
            this.showNotifications = false;
          }
        }
      });
    }
    
    const almostFull = this.trajets.filter(t => {
      const cap = t.bus_details?.capacite || 45;
      const dispo = t.places_disponibles ?? cap;
      return dispo <= 5 && dispo > 0 && t.date_depart >= today;
    });
    if (almostFull.length > 0) {
      this.notifications.push({
        id: 'bus_almost_full',
        type: 'info',
        title: `${almostFull.length} bus presque plein(s)`,
        message: `${almostFull.length} trajet(s) avec moins de 5 places disponibles.`,
        timestamp: new Date(),
        read: false,
        action: { label: 'Voir les trajets', handler: () => this.showNotifications = false }
      });
    }
    
    const soonDepartures = this.trajets.filter(t => {
      const depart = new Date(`${t.date_depart}T${t.heure_depart}`);
      const now = new Date();
      const hoursDiff = (depart.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursDiff > 0 && hoursDiff <= 24 && t.date_depart >= today;
    });
    if (soonDepartures.length > 0) {
      this.notifications.push({
        id: 'soon_departures',
        type: 'danger',
        title: `${soonDepartures.length} départ(s) imminent(s)`,
        message: `${soonDepartures.length} trajet(s) dans les prochaines 24h.`,
        timestamp: new Date(),
        read: false,
        action: { label: 'Voir les départs', handler: () => this.showNotifications = false }
      });
    }
    
    const confirmedToday = this.reservations.filter(r => 
      r.statut === 'confirmee' && r.date_reservation.startsWith(today)
    );
    if (confirmedToday.length > 0) {
      this.notifications.push({
        id: 'confirmed_today',
        type: 'success',
        title: `${confirmedToday.length} confirmation(s) aujourd'hui`,
        message: `Bravo ! ${confirmedToday.length} réservation(s) validée(s).`,
        timestamp: new Date(),
        read: false
      });
    }
    
    this.notifications.sort((a, b) => (a.read ? 1 : -1));
    this.unreadCount = this.notifications.filter(n => !n.read).length;
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.notifications.forEach(n => n.read = true);
      this.unreadCount = 0;
      this.cdr.detectChanges();
    }
  }

  markAllRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.unreadCount = 0;
    this.cdr.detectChanges();
  }

  clearNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.cdr.detectChanges();
  }

  applyFilters(): void {
    let filtered = [...this.reservations];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.passager_nom?.toLowerCase().includes(q) ||
        r.trajet_detail?.ville_depart?.toLowerCase().includes(q) ||
        r.trajet_detail?.ville_arrivee?.toLowerCase().includes(q) ||
        r.id.toString().includes(q) ||
        r.passager_tel?.includes(q)
      );
    }

    if (this.filterStatut !== 'all') {
      filtered = filtered.filter(r => r.statut === this.filterStatut);
    }

    if (this.filterDate) {
      filtered = filtered.filter(r => 
        r.trajet_detail?.date_depart === this.filterDate
      );
    }

    this.filteredReservations = filtered;
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatut = 'all';
    this.filterDate = '';
    this.applyFilters();
  }

  confirmerReservation(id: number): void {
    if (!confirm('Confirmer cette réservation ?')) return;

    this.http.post(`${this.apiUrl}/reservations/${id}/confirmer/`, {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        const idx = this.reservations.findIndex(r => r.id === id);
        if (idx !== -1) {
          this.reservations[idx].statut = 'confirmee';
          this.applyFilters();
          this.calculateStats();
          this.generateNotifications();
        }
        this.showTempMessage('✅ Réservation confirmée avec succès.', 'success');
      },
      error: (err) => this.showTempMessage('❌ ' + (err.error?.detail || 'Erreur confirmation.'), 'danger')
    });
  }

  annulerReservation(id: number): void {
    if (!confirm('Annuler cette réservation ?')) return;

    this.http.post(`${this.apiUrl}/reservations/${id}/annuler/`, {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        const idx = this.reservations.findIndex(r => r.id === id);
        if (idx !== -1) {
          this.reservations[idx].statut = 'annulee';
          this.applyFilters();
          this.calculateStats();
          this.generateNotifications();
        }
        this.showTempMessage('✅ Réservation annulée.', 'success');
      },
      error: (err) => this.showTempMessage('❌ ' + (err.error?.detail || 'Erreur annulation.'), 'danger')
    });
  }

  showTempMessage(text: string, type: 'success' | 'danger' | 'info'): void {
    this.tempMessage = { text, type };
    this.cdr.detectChanges();
    setTimeout(() => {
      this.tempMessage = null;
      this.cdr.detectChanges();
    }, 4000);
  }

  getStatutBadge(statut: string): { class: string; label: string } {
    switch(statut) {
      case 'confirmee': return { class: 'badge-success', label: '✅ Confirmée' };
      case 'annulee': return { class: 'badge-danger', label: '❌ Annulée' };
      default: return { class: 'badge-warning text-dark', label: '⏳ En attente' };
    }
  }

  getStatutBadgeClass(statut: string): string {
    if (statut === 'confirmee') return 'confirmee';
    if (statut === 'annulee') return 'annulee';
    return 'en_attente';
  }

  private extractData<T = any>(response: any): T[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.data)) return response.data;
    return [];
  }

  getStatutLabel(statut: string): string {
    if (statut === 'confirmee') return 'Confirmee';
    if (statut === 'annulee') return 'Annulee';
    return 'En attente';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', { 
      weekday: 'short', day: 'numeric', month: 'short' 
    });
  }

  formatPrice(prix: number, places: number): string {
    return new Intl.NumberFormat('fr-FR').format(prix * places) + ' FCFA';
  }

  getResultsCount(): string {
    const count = this.filteredReservations.length;
    const total = this.reservations.length;
    if (count === 0) return 'Aucune réservation';
    if (count === total) return `${total} réservation${total > 1 ? 's' : ''}`;
    return `${count} sur ${total}`;
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'danger': '🚨'
    };
    return icons[type] || '🔔';
  }

  getNotificationClass(type: string): string {
    const classes: Record<string, string> = {
      'info': 'border-info bg-info-subtle',
      'success': 'border-success bg-success-subtle',
      'warning': 'border-warning bg-warning-subtle',
      'danger': 'border-danger bg-danger-subtle'
    };
    return classes[type] || 'border-secondary';
  }
}
