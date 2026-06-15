import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

// ✅ TYPE DÉCLARÉ ICI (après les imports, avant le composant)
export type ApiListResponse<T> = T[] | { count: number; results: T[]; next?: string; previous?: string };

export interface Reservation {
  id: number;
  trajet_detail?: {
    ville_depart: string;
    ville_arrivee: string;
    date_depart: string;
    heure_depart: string;
    prix: number;
  };
  nombre_places: number;
  passager_nom: string;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  date_reservation: string;
  mode_paiement?: string;
}

@Component({
  selector: 'app-client-reservations',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './client-reservation.html',
  styleUrl: './client-reservation.scss'
})
export class ClientReservations implements OnInit {
  private readonly apiUrl = environment.apiUrl;
  
  reservations: Reservation[] = [];
  filteredReservations: Reservation[] = [];
  loading = true;
  errorText = '';
  
  searchQuery = '';
  filterStatut = 'all';
  filterDate = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  loadReservations(): void {
    this.loading = true;
    this.errorText = '';
    
    // ✅ Utilise le type ApiListResponse<Reservation>
    this.http.get<ApiListResponse<Reservation>>(`${this.apiUrl}/reservations/`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      finalize(() => { 
        this.loading = false; 
        this.cdr.detectChanges(); 
      })
    ).subscribe({
      next: (response) => {
        let data: Reservation[];
        
        // ✅ Extraction sécurisée selon le format de réponse
        if (Array.isArray(response)) {
          data = response;
        } else if (response && typeof response === 'object' && 'results' in response) {
          data = (response as { results: Reservation[] }).results;
        } else {
          data = [];
        }
        
        console.log(`✅ ${data.length} réservation(s) extraite(s)`);
        
        // ✅ Tri avec typage explicite
        this.reservations = data.sort((a: Reservation, b: Reservation) => 
          new Date(b.date_reservation).getTime() - new Date(a.date_reservation).getTime()
        );
        
        this.filteredReservations = [...this.reservations];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Erreur HTTP:', err);
        this.errorText = err.status === 401 
          ? '🔐 Session expirée. Reconnectez-vous.' 
          : err.status === 0 
          ? ' Serveur injoignable' 
          : `Erreur ${err.status}`;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.reservations];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter((r: Reservation) => {
        const depart = r.trajet_detail?.ville_depart?.toLowerCase() || '';
        const arrivee = r.trajet_detail?.ville_arrivee?.toLowerCase() || '';
        const idStr = r.id.toString();
        return depart.includes(query) || arrivee.includes(query) || idStr.includes(query);
      });
    }

    if (this.filterStatut !== 'all') {
      filtered = filtered.filter((r: Reservation) => r.statut === this.filterStatut);
    }

    if (this.filterDate) {
      filtered = filtered.filter((r: Reservation) => {
        const resDate = r.trajet_detail?.date_depart || '';
        return resDate === this.filterDate;
      });
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

  canCancel(res: Reservation): boolean {
    if (res.statut !== 'en_attente') return false;
    if (!res.trajet_detail?.date_depart || !res.trajet_detail?.heure_depart) return false;
    
    const departure = new Date(`${res.trajet_detail.date_depart}T${res.trajet_detail.heure_depart}`);
    const now = new Date();
    const diffHours = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return diffHours > 24;
  }

  cancelReservation(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ?')) return;

    this.http.post(`${this.apiUrl}/reservations/${id}/annuler/`, {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        const idx = this.reservations.findIndex((r: Reservation) => r.id === id);
        if (idx !== -1) {
          this.reservations[idx].statut = 'annulee';
          this.applyFilters();
        }
        alert('✅ Réservation annulée avec succès.');
      },
      error: (err) => {
        const msg = err.error?.detail || 'Impossible d\'annuler.';
        alert('❌ ' + msg);
      }
    });
  }
    // ✅ NOUVELLE MÉTHODE : Télécharger le billet
  downloadTicket(reservationId: number): void {
    console.log(`📥 Demande de téléchargement pour réservation #${reservationId}`);
    
    this.http.get(`${this.apiUrl}/reservations/${reservationId}/ticket/`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob' // ✅ CRUCIAL : Indique qu'on attend un fichier binaire
    }).subscribe({
      next: (blob) => {
        // Création d'une URL temporaire pour le fichier
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Billet_${reservationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Nettoyage
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (err) => {
        console.error('❌ Erreur téléchargement:', err);
        alert('Impossible de télécharger le billet. Vérifiez que la réservation est confirmée.');
      }
    });
  }

  getStatutBadge(statut: string): { class: string; label: string } {
    switch(statut) {
      case 'confirmee': return { class: 'badge-success', label: '✅ Confirmée' };
      case 'annulee': return { class: 'badge-danger', label: '❌ Annulée' };
      default: return { class: 'badge-warning', label: '⏳ En attente' };
    }
  }

  getTotalPrice(res: Reservation): string {
    const prix = res.trajet_detail?.prix || 0;
    const total = prix * res.nombre_places;
    return new Intl.NumberFormat('fr-FR').format(total) + ' FCFA';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', { 
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  formatTime(timeStr: string): string {
    return timeStr || '';
  }

  getResultsCount(): string {
    const count = this.filteredReservations.length;
    const total = this.reservations.length;
    
    if (count === 0) return 'Aucune réservation';
    if (count === total) return `${total} réservation${total > 1 ? 's' : ''}`;
    return `${count} sur ${total} réservation${total > 1 ? 's' : ''}`;
  }
}