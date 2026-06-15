import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { RouterLink, ActivatedRoute, Router } from '@angular/router'; // ✅ Ajout ActivatedRoute + Router
import { catchError, finalize, of } from 'rxjs'; // ✅ Ajout des opérateurs rxjs manquants
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

// ==================== INTERFACES ====================
interface Trajet {
  id: number;
  bus: number;
  ville_depart: string;
  ville_arrivee: string;
  date_depart: string;
  heure_depart: string;
  prix: number;
  places_disponibles: number;
  statut?: string;
  statut_depart?: 'planifie' | 'parti' | 'annule';
  bus_matricule?: string;
  bus_type?: string;
  bus_capacite?: number;
}

interface Bus {
  id: number;
  matricule: string;
  capacite: number;
  type_bus: string;
}

// ==================== COMPOSANT ====================
@Component({
  selector: 'app-trajets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trajets.html',
  styleUrl: './trajets.scss'
})
export class GestionnaireTrajets implements OnInit {
  private readonly apiUrl = environment.apiUrl;
  
  // ✅ User pour la topbar
  user: any = null;
  
  // ✅ PROPRIÉTÉS POUR LE MODE ADMIN (ajoutées)
  isAdminMode = false;
  managerId: string | null = null;
  gestionnaireNom = '';
  agenceNom = '';
  errorText = ''; // ✅ Pour les erreurs API mode admin
  
  // Formulaires
  trajetForm!: FormGroup;
  isEditMode = false;
  editingTrajetId: number | null = null;
  
  // Données
  trajets: Trajet[] = [];
  busDisponibles: Bus[] = [];
  
  // États
  loading = false;
  successMsg = '';
  errorMsg = '';
  
  // KPIs
  totalTrajets = 0;
  departsAujourdhui = 0;
  tauxOccupationMoyen = 0;
  alerteTarif = 'Aucune';
  revenuPrevisionnel = 0;

  constructor(
    private fb: FormBuilder, 
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    // ✅ Injection des services pour le mode admin
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // ✅ Récupération de l'utilisateur connecté pour la topbar
    this.user = this.authService.getCurrentUser();
    this.initForm();
    
    // ✅ DÉTECTION DU MODE ADMIN (nouveau)
    this.managerId = this.route.snapshot.paramMap.get('managerId');
    this.isAdminMode = !!this.managerId;
    
    if (this.isAdminMode) {
      this.gestionnaireNom = this.route.snapshot.queryParamMap.get('nom') || 'Gestionnaire';
      this.agenceNom = this.route.snapshot.queryParamMap.get('agence') || 'Agence inconnue';
      console.log('👁️ Mode admin : consultation de', this.gestionnaireNom);
      this.chargerDonneesPourGestionnaire(Number(this.managerId));
    } else {
      console.log('👤 Mode gestionnaire : chargement de mes trajets');
      this.loadTrajets();
      this.loadBusDisponibles();
    }
  }

  // ==================== MÉTHODES MODE ADMIN (nouvelles) ====================
  
  // ✅ Headers avec token pour les appels API
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

  // ✅ Charger les données DU gestionnaire ciblé (pour l'admin)
  private chargerDonneesPourGestionnaire(managerId: number): void {
    this.loading = true;
    this.errorText = '';
    
    this.http.get<Trajet[]>(
      `${this.apiUrl}/trajets/?manager_id=${managerId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        console.error('❌ Erreur chargement trajets gestionnaire:', err);
        this.errorText = err.error?.detail || 'Impossible de charger les trajets.';
        this.errorMsg = this.errorText; // ✅ Affiche dans l'UI existante
        return of([]);
      }),
      finalize(() => {
        this.loading = false;
        this.forceUpdate();
      })
    ).subscribe((data: Trajet[]) => {
      this.trajets = data.map(t => this.mapTrajet(t));
      this.calculateKPIs();
      console.log(`✅ ${this.trajets.length} trajets chargés pour le gestionnaire #${managerId}`);
      this.forceUpdate();
    });
  }

  // ✅ Retour au dashboard
  goBack(): void {
    this.router.navigate([this.isAdminMode ? '/dashboard' : '/gestionnaire']);
  }

  // ==================== INITIALISATION ====================
  private initForm(): void {
    this.trajetForm = this.fb.group({
      ville_depart: ['', [Validators.required, Validators.minLength(2)]],
      ville_arrivee: ['', [Validators.required, Validators.minLength(2)]],
      date_depart: ['', Validators.required],
      heure_depart: ['', Validators.required],
      prix: ['', [Validators.required, Validators.min(500)]],
      bus: [null, Validators.required]
    });
  }

  // ==================== CHARGEMENT DES DONNÉES ====================
  loadTrajets(): void {
    console.log('📡 Chargement des trajets...');
    this.loading = true;
    this.errorMsg = '';
    
    this.http.get<any>(`${this.apiUrl}/trajets/`).subscribe({
      next: (response) => {
        const data = response?.results || (Array.isArray(response) ? response : []);
        console.log(`📦 ${data.length} trajets reçus`);
        
        this.trajets = data.map((t: any) => this.mapTrajet(t));
        this.calculateKPIs();
        this.loading = false;
        this.forceUpdate();
      },
      error: (err) => {
        console.error('❌ Erreur chargement trajets:', err);
        this.errorMsg = 'Impossible de charger les trajets. Vérifiez votre connexion.';
        this.loading = false;
        this.forceUpdate();
      }
    });
  }

  loadBusDisponibles(): void {
    this.http.get<any>(`${this.apiUrl}/bus/`).subscribe({
      next: (response) => {
        const data = response?.results || (Array.isArray(response) ? response : []);
        this.busDisponibles = data;
        console.log(`🚌 ${this.busDisponibles.length} bus disponibles`);
      },
      error: (err) => {
        console.error('Erreur chargement bus:', err);
        this.busDisponibles = [];
      }
    });
  }

  // ==================== MAPPING ====================
  private mapTrajet(t: any): Trajet {
    return {
      id: t.id || 0,
      bus: t.bus || 0,
      ville_depart: t.ville_depart || '',
      ville_arrivee: t.ville_arrivee || '',
      date_depart: t.date_depart || '',
      heure_depart: t.heure_depart || '',
      prix: t.prix || 0,
      places_disponibles: t.places_disponibles ?? 45,
      statut: t.statut || 'planifie',
      statut_depart: t.statut_depart || 'planifie',
      bus_matricule: t.bus_details?.matricule || t.bus_detail?.matricule || t.bus_matricule || `Bus #${t.bus}`,
      bus_type: t.bus_details?.type_bus || t.bus_detail?.type_bus || t.bus_type || 'Standard',
      bus_capacite: t.bus_details?.capacite || t.bus_detail?.capacite || t.bus_capacite || 45
    };
  }

  // ==================== KPIs ====================
  private calculateKPIs(): void {
    this.totalTrajets = this.trajets.length;
    
    const today = new Date().toISOString().split('T')[0];
    this.departsAujourdhui = this.trajets.filter(t => {
      const trajetDate = t.date_depart?.split('T')[0] || '';
      return trajetDate === today;
    }).length;
    
    this.revenuPrevisionnel = this.trajets.reduce((acc, t) => {
      const cap = t.bus_capacite || 45;
      const vendues = cap - (t.places_disponibles ?? cap);
      return acc + (t.prix || 0) * Math.max(0, vendues);
    }, 0);
    
    if (this.trajets.length > 0) {
      const totalCap = this.trajets.reduce((sum, t) => sum + (t.bus_capacite || 45), 0);
      const totalVendues = this.trajets.reduce((sum, t) => {
        const cap = t.bus_capacite || 45;
        const vendues = cap - (t.places_disponibles ?? cap);
        return sum + Math.max(0, vendues);
      }, 0);
      this.tauxOccupationMoyen = totalCap > 0 ? Math.round((totalVendues / totalCap) * 100) : 0;
    } else {
      this.tauxOccupationMoyen = 0;
    }
    
    const basPrix = this.trajets.filter(t => (t.prix || 0) < 3000).length;
    this.alerteTarif = basPrix > 0 ? `${basPrix} trajet(s) < 3000 FCFA` : 'Aucune';
  }

  // ==================== CRUD ====================
  onSubmit(): void {
    if (this.trajetForm.invalid) {
      this.trajetForm.markAllAsTouched();
      this.showError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.loading = true;
    const val = this.trajetForm.value;
    
    const payload = {
      bus: Number(val.bus),
      ville_depart: val.ville_depart.trim(),
      ville_arrivee: val.ville_arrivee.trim(),
      date_depart: val.date_depart,
      heure_depart: val.heure_depart,
      prix: Number(val.prix)
    };

    // ✅ URL différente selon le mode (admin ou gestionnaire)
    const baseUrl = this.isAdminMode && this.managerId
      ? `${this.apiUrl}/trajets/?manager_id=${this.managerId}`
      : `${this.apiUrl}/trajets/`;

    if (this.isEditMode && this.editingTrajetId) {
      this.updateTrajet(this.editingTrajetId, payload, baseUrl);
    } else {
      this.createTrajet(payload, baseUrl);
    }
  }

  private createTrajet(payload: any, baseUrl: string): void {
    this.http.post<Trajet>(baseUrl, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: (res) => {
        console.log('✅ Trajet créé:', res);
        this.showSuccess('Trajet créé avec succès !');
        this.resetForm();
        // Recharger selon le mode
        if (this.isAdminMode && this.managerId) {
          this.chargerDonneesPourGestionnaire(Number(this.managerId));
        } else {
          this.loadTrajets();
          this.loadBusDisponibles();
        }
      },
      error: (err: HttpErrorResponse) => {
        console.error('❌ Erreur création:', err);
        this.showError(err.error?.detail || 'Erreur lors de la création du trajet');
        this.loading = false;
        this.forceUpdate();
      }
    });
  }

  editTrajet(trajet: Trajet): void {
    console.log('✏️ Édition trajet:', trajet.id);
    
    this.isEditMode = true;
    this.editingTrajetId = trajet.id;
    
    this.trajetForm.patchValue({
      ville_depart: trajet.ville_depart,
      ville_arrivee: trajet.ville_arrivee,
      date_depart: trajet.date_depart,
      heure_depart: trajet.heure_depart,
      prix: trajet.prix,
      bus: trajet.bus
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.showInfo('Mode édition activé. Modifiez les informations puis cliquez sur "Mettre à jour".');
  }

  private updateTrajet(id: number, payload: any, baseUrl: string): void {
    this.http.put<Trajet>(`${baseUrl}${id}/`, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: (res) => {
        console.log('✅ Trajet mis à jour:', res);
        this.showSuccess('Trajet mis à jour avec succès !');
        this.resetForm();
        if (this.isAdminMode && this.managerId) {
          this.chargerDonneesPourGestionnaire(Number(this.managerId));
        } else {
          this.loadTrajets();
        }
      },
      error: (err: HttpErrorResponse) => {
        console.error('❌ Erreur mise à jour:', err);
        this.showError(err.error?.detail || 'Erreur lors de la mise à jour');
        this.loading = false;
        this.forceUpdate();
      }
    });
  }

  deleteTrajet(trajet: Trajet): void {
    if (!confirm(`Confirmer la suppression du trajet ${trajet.ville_depart} → ${trajet.ville_arrivee} ?`)) return;

    this.http.delete(`${this.apiUrl}/trajets/${trajet.id}/`, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.showSuccess('Trajet supprimé avec succès !');
        if (this.isAdminMode && this.managerId) {
          this.chargerDonneesPourGestionnaire(Number(this.managerId));
        } else {
          this.loadTrajets();
        }
      },
      error: (err) => {
        this.showError('Impossible de supprimer ce trajet');
        this.forceUpdate();
      }
    });
  }

  // ✅ CONFIRMATION DU DÉPART
  confirmerDepart(trajet: Trajet): void {
    if (!confirm(`Confirmer le départ du trajet ${trajet.ville_depart} → ${trajet.ville_arrivee} ?\nCette action fermera les réservations.`)) return;

    this.http.post(`${this.apiUrl}/trajets/${trajet.id}/confirmer_depart/`, {}, { headers: this.getAuthHeaders() }).subscribe({
      next: (res: any) => {
        this.showSuccess(`🚌 Départ confirmé : ${trajet.ville_depart} → ${trajet.ville_arrivee}`);
        // Mettre à jour localement
        const idx = this.trajets.findIndex(t => t.id === trajet.id);
        if (idx !== -1) {
          this.trajets[idx] = { ...this.trajets[idx], statut_depart: 'parti' } as any;
          this.forceUpdate();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.showError(err.error?.detail || 'Erreur lors de la confirmation du départ.');
      }
    });
  }

  // ==================== UTILITAIRES ====================
  cancelEdit(): void {
    this.resetForm();
    this.showInfo('Édition annulée');
  }

  private resetForm(): void {
    this.trajetForm.reset();
    this.isEditMode = false;
    this.editingTrajetId = null;
    this.loading = false;
  }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = '';
    this.forceUpdate();
    setTimeout(() => {
      this.successMsg = '';
      this.forceUpdate();
    }, 4000);
  }

  private showError(msg: string): void {
    this.errorMsg = msg;
    this.successMsg = '';
    this.forceUpdate();
  }

  private showInfo(msg: string): void {
    this.successMsg = msg;
    this.forceUpdate();
  }

  private forceUpdate(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  formatDate(d: string): string {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return d;
    }
  }

  getStatutColor(statut: string): string {
    const colors: Record<string, string> = {
      'planifie': 'badge-blue',
      'en_cours': 'badge-green',
      'termine': 'badge-gray',
      'annule': 'badge-red'
    };
    return colors[statut || 'planifie'] || 'badge-gray';
  }

  get f() { return this.trajetForm.controls; }
  get isEditing() { return this.isEditMode; }
}
