import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';
import { ReservationService, Reservation } from '../../services/reservation.service';
import { environment } from '../../../environments/environment';
import { catchError, finalize, forkJoin, of } from 'rxjs';

// ==================== INTERFACES ====================
interface Agence {
  id: number; nom: string; adresse: string; telephone: string;
  email_contact: string; gestionnaire: number | null; gestionnaire_username: string;
}
interface Gestionnaire {
  id: number; username: string; email: string; first_name: string;
  last_name: string; role: string; telephone?: string; is_active: boolean;
  agence_nom?: string; agence_id?: number; date_joined: string;
}
interface GestionnaireCount { total: number; actifs: number; inactifs: number; }
interface ActivitesData {
  agence: { nom: string; ville: string; contact: string };
  stats: { total_reservations: number; reservations_confirmees: number; total_trajets: number; total_bus: number; };
  reservations: any[]; trajets: any[]; buses: any[];
}
interface StatsGlobales {
  total_reservations: number;
  reservations_confirmees: number;
  reservations_en_attente: number;
  reservations_annulees: number;
  chiffre_affaires: number;
  total_trajets: number;
  total_bus: number;
  total_agences: number;
  total_gestionnaires: number;
}
interface Paiement {
  id: number;
  reservation: number;
  montant: number;
  methode: string;
  statut: string;
  transaction_id: string;
  client_username: string;
  trajet_info: string;
  date_paiement: string;
}

// ==================== COMPOSANT ====================
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  user: User | null = null;
  reservations: Reservation[] = [];
  agences: Agence[] = [];
  gestionnaires: Gestionnaire[] = [];
  paiements: Paiement[] = [];

  loadingAgences = false;
  loadingGestionnaires = false;
  loadingReservations = false;
  loadingActivites = false;
  loadingStats = false;
  loadingPaiements = false;

  activeSection = 'tableau-bord';
  gestionnaireCount: GestionnaireCount = { total: 0, actifs: 0, inactifs: 0 };
  errorText = '';

  // Stats globales
  statsGlobales: StatsGlobales = {
    total_reservations: 0, reservations_confirmees: 0,
    reservations_en_attente: 0, reservations_annulees: 0,
    chiffre_affaires: 0, total_trajets: 0,
    total_bus: 0, total_agences: 0, total_gestionnaires: 0
  };

  showFormAgence = false; agenceForm!: FormGroup; loadingFormA = false; erreurFormA = ''; succesFormA = '';
  agenceSelectionnee: Agence | null = null; showDetailAgence = false;
  agenceAModifier: Agence | null = null; showModifierAgence = false; modifAgenceForm!: FormGroup;
  loadingModif = false; erreurModif = ''; succesModif = '';

  showFormGestionnaire = false; gestionnaireForm!: FormGroup; loadingFormG = false;
  erreurFormG = ''; succesFormG = '';
  gestionnaireSelectionne: Gestionnaire | null = null;
  showDetailGestionnaire = false; showActivitesModal = false;
  activitesData: ActivitesData | null = null;
  gestionnaireAModifier: Gestionnaire | null = null;
  showModifierGestionnaire = false; modifGestionnaireForm!: FormGroup;
  loadingModifG = false; erreurModifG = ''; succesModifG = '';

  private apiUrl = environment.apiUrl;

  constructor(
    private authService: AuthService,
    private reservationService: ReservationService,
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { this.initForms(); }

  private initForms(): void {
    this.agenceForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(3)]],
      adresse: ['', Validators.required],
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,15}$/)]],
      email_contact: ['', [Validators.email]],
    });
    this.gestionnaireForm = this.fb.group({
      first_name: ['', Validators.required], last_name: [''],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,15}$/)]],
      agence_id: ['', Validators.required],
    });
    this.modifAgenceForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(3)]],
      adresse: [''], telephone: [''], email_contact: ['', [Validators.email]],
    });
    this.modifGestionnaireForm = this.fb.group({
      first_name: ['', Validators.required], last_name: [''],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.pattern(/^[0-9]{9,15}$/)]], is_active: [true],
    });
  }

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.chargerReservations();
    if (this.isAdmin()) {
      this.chargerStatsGlobales();
      this.chargerAgences();
      this.chargerGestionnaires();
      this.chargerGestionnaireCount();
    }
  }

  setSection(section: string): void {
    this.activeSection = section;
    this.resetForms();
    if (section === 'agences') this.chargerAgences();
    if (section === 'gestionnaires') this.chargerGestionnaires();
    if (section === 'paiements') this.chargerPaiements();
  }

  resetForms(): void {
    this.showFormAgence = this.showFormGestionnaire = this.showModifierAgence =
      this.showModifierGestionnaire = this.showActivitesModal = false;
    this.erreurFormA = this.succesFormA = this.erreurFormG = this.succesFormG = '';
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  // ==================== STATS GLOBALES ====================
  chargerStatsGlobales(): void {
    this.loadingStats = true;

    forkJoin({
      reservations: this.http.get<any>(`${this.apiUrl}/reservations/?page_size=1000`, { headers: this.getAuthHeaders() }).pipe(catchError(() => of({ results: [], count: 0 }))),
      paiements: this.http.get<any>(`${this.apiUrl}/paiements/statistiques/`, { headers: this.getAuthHeaders() }).pipe(catchError(() => of({ chiffre_affaires_total: 0 }))),
      trajets: this.http.get<any>(`${this.apiUrl}/trajets/?page_size=1`, { headers: this.getAuthHeaders() }).pipe(catchError(() => of({ count: 0 }))),
      buses: this.http.get<any>(`${this.apiUrl}/bus/?page_size=1`, { headers: this.getAuthHeaders() }).pipe(catchError(() => of({ count: 0 }))),
    }).pipe(finalize(() => { this.loadingStats = false; this.cdr.detectChanges(); }))
    .subscribe(({ reservations, paiements, trajets, buses }) => {
      const resArray: any[] = Array.isArray(reservations) ? reservations : (reservations?.results || []);
      this.statsGlobales = {
        total_reservations: reservations?.count || resArray.length,
        reservations_confirmees: resArray.filter((r: any) => r.statut === 'confirmee').length,
        reservations_en_attente: resArray.filter((r: any) => r.statut === 'en_attente').length,
        reservations_annulees: resArray.filter((r: any) => r.statut === 'annulee').length,
        chiffre_affaires: paiements?.chiffre_affaires_total || 0,
        total_trajets: trajets?.count || 0,
        total_bus: buses?.count || 0,
        total_agences: this.agences.length,
        total_gestionnaires: this.gestionnaireCount.total,
      };
      this.cdr.detectChanges();
    });
  }

  chargerReservations(): void {
    this.loadingReservations = true;
    this.reservationService.getMesReservations().pipe(
      finalize(() => this.loadingReservations = false),
      catchError(() => { this.loadingReservations = false; return of([]); })
    ).subscribe({
      next: (data: any) => {
        this.reservations = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      }
    });
  }

  // ==================== PAIEMENTS ====================
  chargerPaiements(): void {
    this.loadingPaiements = true;
    this.http.get<any>(`${this.apiUrl}/paiements/`, { headers: this.getAuthHeaders() }).pipe(
      finalize(() => { this.loadingPaiements = false; this.cdr.detectChanges(); }),
      catchError(() => of({ results: [] }))
    ).subscribe({
      next: (data: any) => {
        this.paiements = Array.isArray(data) ? data : (data?.results || []);
        this.cdr.detectChanges();
      }
    });
  }

  validerPaiement(paiement: Paiement, nouveauStatut: 'valide' | 'echoue'): void {
    const label = nouveauStatut === 'valide' ? 'valider' : 'refuser';
    if (!confirm(`Confirmer : ${label} le paiement #${paiement.id} ?`)) return;

    this.http.post(
      `${this.apiUrl}/paiements/${paiement.id}/valider_paiement/`,
      { statut: nouveauStatut },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: () => {
        paiement.statut = nouveauStatut;
        this.cdr.detectChanges();
        this.chargerStatsGlobales();
      },
      error: (e: any) => alert('❌ ' + (e.error?.detail || 'Erreur'))
    });
  }

  chargerAgences(): void {
    this.loadingAgences = true;
    this.http.get<any>(`${this.apiUrl}/agences/?page_size=100`, { headers: this.getAuthHeaders() }).pipe(
      finalize(() => { this.loadingAgences = false; this.cdr.detectChanges(); }),
      catchError((err: any) => { console.error('❌ Erreur Agences:', err); return of([]); })
    ).subscribe({
      next: (data: any) => {
        const raw = Array.isArray(data) ? data : data?.results || [];
        this.agences = raw.map((a: any) => ({
          id: a.id, nom: a.nom, adresse: a.adresse, telephone: a.telephone,
          email_contact: a.email_contact, gestionnaire: a.gestionnaire,
          gestionnaire_username: a.gestionnaire_username || 'Non assigné'
        }));
        this.statsGlobales.total_agences = this.agences.length;
      }
    });
  }

  chargerGestionnaires(): void {
    this.loadingGestionnaires = true;
    this.http.get<any>(`${this.apiUrl}/users/gestionnaires/`, { headers: this.getAuthHeaders() }).pipe(
      finalize(() => { this.loadingGestionnaires = false; this.cdr.detectChanges(); }),
      catchError((err: any) => { console.error('❌ HTTP Error:', err.status, err.error); return of([]); })
    ).subscribe({
      next: (res: any) => {
        const allUsers: any[] = Array.isArray(res) ? res : (res?.results || res?.data || []);
        const gestionnairesData = allUsers.filter((u: any) => {
          return (u.agence_id != null && u.agence_id !== '') ||
                 (u.agence && (u.agence.id || u.agence.nom)) ||
                 String(u.role || '').toUpperCase() === 'GESTIONNAIRE';
        });
        this.gestionnaires = gestionnairesData.map((g: any) => ({
          id: g.id || 0, username: g.username || '', email: g.email || '',
          first_name: g.first_name || '', last_name: g.last_name || '',
          role: g.role || 'GESTIONNAIRE', telephone: g.telephone || '',
          is_active: g.is_active !== false,
          agence_nom: g.agence?.nom || g.agence_nom || `ID:${g.agence_id || 'Aucune'}`,
          agence_id: g.agence?.id || g.agence_id,
          date_joined: g.date_joined || new Date().toISOString()
        }));
        this.chargerGestionnaireCount();
      },
      error: () => { this.gestionnaires = []; this.chargerGestionnaireCount(); }
    });
  }

  chargerGestionnaireCount(): void {
    this.gestionnaireCount = {
      total: this.gestionnaires.length,
      actifs: this.gestionnaires.filter((g: any) => g.is_active).length,
      inactifs: this.gestionnaires.filter((g: any) => !g.is_active).length
    };
    this.statsGlobales.total_gestionnaires = this.gestionnaireCount.total;
    this.cdr.detectChanges();
  }

  // ==================== GETTERS ====================
  get agencesDisponibles(): Agence[] { return this.agences.filter((a: any) => !a.gestionnaire); }
  get totalReservations(): number { return this.reservations.length; }
  get reservationsAnnulees(): number { return this.reservations.filter((r: any) => r.statut === 'annulee').length; }
  get reservationsConfirmees(): number { return this.reservations.filter((r: any) => r.statut === 'confirmee').length; }
  get reservationsEnAttente(): number { return this.reservations.filter((r: any) => r.statut === 'en_attente').length; }
  get paiementsEnAttente(): Paiement[] { return this.paiements.filter(p => p.statut === 'en_attente'); }

  isAdmin(): boolean {
    return String(this.user?.role || '').toUpperCase() === 'ADMIN';
  }

  get a_nom() { return this.agenceForm.get('nom'); }
  get a_adresse() { return this.agenceForm.get('adresse'); }
  get a_telephone() { return this.agenceForm.get('telephone'); }
  get a_email() { return this.agenceForm.get('email_contact'); }

  formatPrix(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
  }

  getPaiementMethodLabel(m: string): string {
    const labels: Record<string, string> = {
      orange_money: 'Orange Money',
      mtn_momo: 'MTN MoMo',
      carte: 'Carte bancaire',
      espece: 'Especes'
    };
    return labels[m] || m || '-';
  }

  getMethodeLabel(m: string): string {
    const labels: Record<string, string> = {
      orange_money: '🟠 Orange Money', mtn_momo: '🟡 MTN MoMo',
      carte: '💳 Carte', espece: '💵 Espèces'
    };
    return labels[m] || m;
  }

  getStatutPaiementBadge(s: string): string {
    const map: Record<string, string> = {
      valide: 'badge bg-success', en_attente: 'badge bg-warning text-dark',
      echoue: 'badge bg-danger', annule: 'badge bg-secondary'
    };
    return map[s] || 'badge bg-light';
  }

  // ==================== ACTIONS AGENCES ====================
  toggleFormAgence(): void { this.showFormAgence = !this.showFormAgence; this.erreurFormA = this.succesFormA = ''; this.agenceForm.reset(); }

  creerAgence(): void {
    if (this.agenceForm.invalid) { this.agenceForm.markAllAsTouched(); this.erreurFormA = 'Champs requis'; return; }
    this.loadingFormA = true;
    const v = this.agenceForm.getRawValue();
    this.http.post(`${this.apiUrl}/agences/`, {
      nom: v.nom?.trim(), adresse: v.adresse?.trim(),
      telephone: v.telephone?.trim().replace(/\D/g, ''),
      email_contact: v.email_contact?.trim()?.toLowerCase()
    }, { headers: this.getAuthHeaders() }).pipe(finalize(() => this.loadingFormA = false)).subscribe({
      next: () => { this.succesFormA = '✅ Agence créée'; this.agenceForm.reset(); this.chargerAgences(); setTimeout(() => { this.showFormAgence = false; this.succesFormA = ''; }, 2000); },
      error: (e: any) => { this.erreurFormA = e.error?.detail || 'Erreur'; alert(this.erreurFormA); }
    });
  }

  voirDetailAgence(a: Agence): void { this.agenceSelectionnee = a; this.showDetailAgence = true; }
  fermerDetailAgence(): void { this.showDetailAgence = false; this.agenceSelectionnee = null; }
  modifierAgence(a: Agence): void { this.agenceAModifier = a; this.showModifierAgence = true; this.modifAgenceForm.patchValue({ nom: a.nom, adresse: a.adresse, telephone: a.telephone, email_contact: a.email_contact }); }
  fermerModifierAgence(): void { this.showModifierAgence = false; this.agenceAModifier = null; }

  sauvegarderModificationAgence(): void {
    if (!this.agenceAModifier || this.modifAgenceForm.invalid) return;
    this.loadingModif = true;
    this.http.patch(`${this.apiUrl}/agences/${this.agenceAModifier.id}/`, this.modifAgenceForm.value, { headers: this.getAuthHeaders() }).pipe(finalize(() => this.loadingModif = false)).subscribe({
      next: () => { this.succesModif = '✅ Agence modifiée'; this.chargerAgences(); setTimeout(() => { this.fermerModifierAgence(); this.succesModif = ''; }, 1500); },
      error: () => { this.erreurModif = 'Erreur'; }
    });
  }

  supprimerAgence(a: Agence): void {
    if (!confirm(`Supprimer "${a.nom}" ?`)) return;
    if (a.gestionnaire) {
      this.http.post(`${this.apiUrl}/users/gestionnaires/${a.gestionnaire}/desactiver/`, { message: 'Agence supprimée.' }, { headers: this.getAuthHeaders() }).subscribe();
    }
    this.http.delete(`${this.apiUrl}/agences/${a.id}/`, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.chargerAgences(); this.chargerGestionnaires(); alert('✅ Supprimé'); },
      error: () => alert('❌ Erreur')
    });
  }

  // ==================== ACTIONS GESTIONNAIRES ====================
  toggleFormGestionnaire(): void { this.showFormGestionnaire = !this.showFormGestionnaire; this.erreurFormG = this.succesFormG = ''; this.gestionnaireForm.reset(); }

  creerGestionnaire(): void {
    if (this.gestionnaireForm.invalid) { this.gestionnaireForm.markAllAsTouched(); this.erreurFormG = 'Champs requis'; return; }
    this.loadingFormG = true;
    const v = this.gestionnaireForm.getRawValue();
    const payload = {
      username: v.username?.trim(), email: v.email?.trim()?.toLowerCase(),
      first_name: v.first_name?.trim() || '', last_name: v.last_name?.trim() || '',
      telephone: v.telephone?.trim() || '',
      password: `EasyReserve@${v.username}2025`,
      role: 'GESTIONNAIRE', agence_id: Number(v.agence_id)
    };
    this.http.post(`${this.apiUrl}/users/register/`, payload, { headers: this.getAuthHeaders() }).pipe(finalize(() => this.loadingFormG = false)).subscribe({
      next: () => {
        this.succesFormG = `✅ "${v.username}" créé`;
        this.gestionnaireForm.reset();
        setTimeout(() => { this.chargerGestionnaires(); this.chargerAgences(); this.showFormGestionnaire = false; this.succesFormG = ''; }, 500);
      },
      error: (e: HttpErrorResponse) => {
        this.erreurFormG = e.error?.username?.[0] || e.error?.email?.[0] || e.error?.detail || 'Erreur';
        alert(`❌ ${this.erreurFormG}`);
      }
    });
  }

  fermerActivites(): void { this.showActivitesModal = false; this.gestionnaireSelectionne = null; this.activitesData = null; }
  voirDetailGestionnaire(g: Gestionnaire): void { this.gestionnaireSelectionne = g; this.showDetailGestionnaire = true; }

  toggleGestionnaireStatus(g: Gestionnaire): void {
    const willDeactivate = g.is_active;
    const message = willDeactivate ? prompt(`Message pour ${g.username}:`, 'Compte desactive temporairement.') : '';
    if (willDeactivate && message === null) return;
    if (!confirm(`${willDeactivate ? 'Desactiver' : 'Activer'} "${g.username}" ?`)) return;

    this.http.post(
      `${this.apiUrl}/users/gestionnaires/${g.id}/${willDeactivate ? 'desactiver' : 'activer'}/`,
      willDeactivate && message ? { message: message.trim() } : {},
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: () => {
        g.is_active = !g.is_active;
        this.chargerGestionnaireCount();
        alert(`${g.username} ${willDeactivate ? 'desactive' : 'active'}.`);
      },
      error: () => alert('Erreur lors du changement de statut.')
    });
  }

  toggleActivation(g: Gestionnaire): void {
    const willDeactivate = g.is_active;
    const message = willDeactivate ? prompt(`Message pour ${g.username}:`, 'Compte désactivé temporairement.') : '';
    if (willDeactivate && message === null) return;
    if (!confirm(`${willDeactivate ? 'Désactiver' : 'Activer'} "${g.username}" ?`)) return;
    this.http.post(`${this.apiUrl}/users/gestionnaires/${g.id}/${willDeactivate ? 'desactiver' : 'activer'}/`,
      willDeactivate && message ? { message: message.trim() } : {},
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: () => { g.is_active = !g.is_active; this.chargerGestionnaireCount(); alert(`✅ ${g.username} ${willDeactivate ? 'désactivé' : 'activé'}`); },
      error: () => { g.is_active = !g.is_active; this.chargerGestionnaireCount(); }
    });
  }

  voirActivites(g: Gestionnaire): void {
    this.gestionnaireSelectionne = g;
    this.loadingActivites = true;
    this.showActivitesModal = true;
    
    this.http.get<ActivitesData>(`${this.apiUrl}/users/gestionnaires/${g.id}/activites/`, { headers: this.getAuthHeaders() })
      .pipe(finalize(() => { this.loadingActivites = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (data) => {
          this.activitesData = data;
        },
        error: () => {
          alert("Erreur lors de la récupération des activités");
          this.showActivitesModal = false;
        }
      });
  }

  modifierGestionnaire(g: Gestionnaire): void {
    this.gestionnaireAModifier = g; this.showModifierGestionnaire = true;
    this.modifGestionnaireForm.patchValue({ first_name: g.first_name, last_name: g.last_name || '', username: g.username, email: g.email, telephone: g.telephone || '', is_active: g.is_active });
  }

  fermerModifierGestionnaire(): void { this.showModifierGestionnaire = false; this.gestionnaireAModifier = null; }

  sauvegarderModificationGestionnaire(): void {
    if (!this.gestionnaireAModifier || this.modifGestionnaireForm.invalid) return;
    this.loadingModifG = true;
    this.http.patch(`${this.apiUrl}/users/${this.gestionnaireAModifier.id}/`, this.modifGestionnaireForm.value, { headers: this.getAuthHeaders() })
      .pipe(finalize(() => this.loadingModifG = false))
      .subscribe({
        next: () => { this.succesModifG = '✅ Mis à jour'; this.chargerGestionnaires(); setTimeout(() => { this.fermerModifierGestionnaire(); this.succesModifG = ''; }, 1500); },
        error: () => { this.erreurModifG = 'Erreur'; }
      });
  }

  supprimerGestionnaire(g: Gestionnaire): void {
    if (!confirm(`⚠️ Supprimer "${g.username}" ?`)) return;
    this.http.delete(`${this.apiUrl}/users/${g.id}/`, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.gestionnaires = this.gestionnaires.filter(u => u.id !== g.id); this.chargerAgences(); this.chargerGestionnaireCount(); alert('✅ Supprimé'); },
      error: () => alert('❌ Erreur')
    });
  }

  fermerDetailGestionnaire(): void { this.showDetailGestionnaire = false; this.gestionnaireSelectionne = null; }
  onLogout(): void { this.authService.logout(); }
}
