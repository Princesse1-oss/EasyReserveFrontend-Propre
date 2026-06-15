import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

// ✅ Interfaces avec typage strict
interface Bus {
  id: number;
  matricule: string;
  capacite: number;
  type_bus: 'standard' | 'vip' | 'minibus';
  agence: number | null;
  agence_nom?: string;
  is_active?: boolean;
}

interface Agence {
  id: number;
  nom: string;
  adresse?: string;
  gestionnaire?: number | null;
}

interface BusCreateRequest {
  matricule: string;
  capacite: number;
  type_bus: 'standard' | 'vip' | 'minibus';
  agence?: number; // Optionnel : si omis, Django utilise null
}

@Component({
  selector: 'app-buses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './bus.html',
  styleUrl: './bus.scss'
})
export class GestionnaireBuses implements OnInit {
  private readonly apiUrl = environment.apiUrl;
  
  // ✅ MODE ADMIN
  isAdminMode = false;
  managerId: string | null = null;
  gestionnaireNom = '';
  agenceNom = '';
  
  busForm!: FormGroup;
  modifForm!: FormGroup;
  
  buses: Bus[] = [];
  agences: Agence[] = [];
  
  loading = true;
  successMsg = '';
  errorMsg = '';
  
  showForm = false;
  showModifier = false;
  busAModifier: Bus | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  get user() { return this.authService.getCurrentUser(); }
  get isAdmin() { return this.user?.role === 'ADMIN'; }
  get isGestionnaire() { return this.user?.role === 'GESTIONNAIRE'; }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goBack(): void {
    this.router.navigate([this.isAdminMode ? `/dashboard/gestionnaires/${this.managerId}/activites` : '/gestionnaire'], {
      queryParams: this.isAdminMode ? { nom: this.gestionnaireNom, agence: this.agenceNom } : {}
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }
  
  // ✅ Gestion sécurisée de userAgenceId
  get userAgenceId(): number | null { 
    const id = this.user?.agence_id; 
    return (id !== undefined && id !== null) ? Number(id) : null; 
  }

  ngOnInit(): void {
    // ✅ DETECTION MODE ADMIN
    this.managerId = this.route.snapshot.paramMap.get('managerId');
    this.isAdminMode = !!this.managerId;
    if (this.isAdminMode) {
      this.gestionnaireNom = this.route.snapshot.queryParamMap.get('nom') || 'Gestionnaire';
      this.agenceNom = this.route.snapshot.queryParamMap.get('agence') || 'Agence inconnue';
    }
    
    this.initForms();
    this.loadBuses();
    if (this.isAdmin) {
      this.loadAgences();
    }
    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.errorMsg = 'Chargement interrompu. Verifiez que le serveur Django est demarre et que votre session est valide.';
      }
    }, 9000);
  }

  private initForms(): void {
    const defaultAgence = this.isGestionnaire ? this.userAgenceId : null;
    
    this.busForm = this.fb.group({
      matricule: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(20)]],
      capacite: [45, [Validators.required, Validators.min(1), Validators.max(100)]],
      type_bus: ['standard', Validators.required],
      agence: [defaultAgence]
    });

    this.modifForm = this.fb.group({
      matricule: ['', [Validators.required, Validators.minLength(4)]],
      capacite: [45, [Validators.required, Validators.min(1), Validators.max(100)]],
      type_bus: ['standard', Validators.required],
      agence: [null],
      is_active: [true]
    });

    // ✅ Désactiver le champ agence pour les gestionnaires (dès l'init)
    if (this.isGestionnaire && this.userAgenceId) {
      this.busForm.get('agence')?.disable();
      this.modifForm.get('agence')?.disable();
    }
  }

  loadBuses(): void {
    this.loading = true;
    this.errorMsg = '';

    // ✅ Construire l'URL avec managerId si mode admin
    const busesUrl = this.isAdminMode 
      ? `${this.apiUrl}/bus/?manager_id=${this.managerId}` 
      : `${this.apiUrl}/bus/`;

    this.http.get<Bus[] | { results: Bus[] }>(busesUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        const dataArray = Array.isArray(response) 
          ? response 
          : (response as { results?: Bus[] })?.results || [];
        
        this.buses = dataArray;
        this.loading = false;
        this.cdr.detectChanges();
        console.log('✅ Buses chargés :', this.buses.length);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Impossible de charger la liste des bus.';
        this.cdr.detectChanges();
        console.error('❌ Erreur chargement buses:', err);
      }
    });
  }

  loadAgences(): void {
    this.http.get<Agence[] | { results: Agence[] }>(`${this.apiUrl}/agences/`, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        this.agences = Array.isArray(data) ? data : (data as { results?: Agence[] })?.results || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('❌ Erreur chargement agences:', err)
    });
  }

  getAgenceNom(agenceId: number | null | undefined): string {
    if (!agenceId) return 'Non assignée';
    const agence = this.agences.find(a => a.id === agenceId);
    return agence?.nom || 'Agence inconnue';
  }

  // ===== TOGGLE =====
  toggleForm(): void {
    this.showForm = !this.showForm;
    this.showModifier = false;
    this.successMsg = '';
    this.errorMsg = '';
    
    const defaultAgence = this.isGestionnaire ? this.userAgenceId : null;
    this.busForm.reset({ 
      capacite: 45, 
      type_bus: 'standard', 
      agence: defaultAgence 
    });
    
    // ✅ Ré-appliquer l'état disabled après reset
    if (this.isGestionnaire && this.userAgenceId) {
      this.busForm.get('agence')?.disable();
    } else {
      this.busForm.get('agence')?.enable();
    }
  }

  toggleModifier(bus: Bus): void {
    this.busAModifier = bus;
    this.showModifier = !this.showModifier;
    this.showForm = false;
    this.successMsg = '';
    this.errorMsg = '';
    
    this.modifForm.patchValue({
      matricule: bus.matricule,
      capacite: bus.capacite,
      type_bus: bus.type_bus,
      agence: bus.agence ?? null,
      is_active: bus.is_active ?? true
    });
    
    // ✅ Ré-appliquer l'état disabled après patch
    if (this.isGestionnaire) {
      this.modifForm.get('agence')?.disable();
    } else {
      this.modifForm.get('agence')?.enable();
    }
  }

  // ===== CRÉATION — PAYLOAD SÉCURISÉ =====
  onSubmit(): void {
    if (this.busForm.invalid) {
      this.busForm.markAllAsTouched();
      this.errorMsg = 'Veuillez corriger les erreurs dans le formulaire.';
      return;
    }

    this.loading = true;
    this.successMsg = '';
    this.errorMsg = '';

    const rawValue = this.busForm.getRawValue();
    
    // ✅ Construction typée du payload
    const payload: BusCreateRequest = {
      matricule: String(rawValue.matricule || '').trim(),
      capacite: Number(rawValue.capacite),
      type_bus: rawValue.type_bus as 'standard' | 'vip' | 'minibus'
    };

    // ✅ Ajouter agence seulement si valeur valide (number)
    const agenceValue = rawValue.agence;
    if (typeof agenceValue === 'number' && agenceValue > 0) {
      payload.agence = agenceValue;
    }
    // Si agence est null/undefined/'' → on omet le champ (Django utilisera null)

    console.log('📤 Payload création bus:', JSON.stringify(payload));

    this.http.post<Bus>(`${this.apiUrl}/bus/`, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMsg = `✅ Bus "${response.matricule}" créé avec succès !`;
        
        this.busForm.reset({ 
          capacite: 45, 
          type_bus: 'standard', 
          agence: this.isGestionnaire ? this.userAgenceId : null 
        });
        if (this.isGestionnaire && this.userAgenceId) {
          this.busForm.get('agence')?.disable();
        }
        
        this.showForm = false;
        this.loadBuses();
        setTimeout(() => this.successMsg = '', 4000);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        console.error('❌ Erreur création bus:', err);
        console.error('🔍 Réponse backend:', err.error);
        
        if (err.status === 0) {
          this.errorMsg = '🔌 Serveur injoignable. Django tourne-t-il ?';
        } else if (err.error?.matricule) {
          this.errorMsg = `❌ Matricule : ${err.error.matricule[0]}`;
        } else if (err.error?.agence) {
          this.errorMsg = `❌ Agence : ${err.error.agence[0]}`;
        } else if (err.error?.capacite) {
          this.errorMsg = `❌ Capacité : ${err.error.capacite[0]}`;
        } else if (err.error?.type_bus) {
          this.errorMsg = `❌ Type : ${err.error.type_bus[0]}`;
        } else if (err.error?.non_field_errors) {
          this.errorMsg = `❌ ${err.error.non_field_errors[0]}`;
        } else {
          this.errorMsg = `Erreur ${err.status}: ${JSON.stringify(err.error)}`;
        }
      }
    });
  }

  // ===== MODIFICATION =====
  sauvegarderModification(): void {
    if (!this.busAModifier || this.modifForm.invalid) {
      this.modifForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const rawValue = this.modifForm.getRawValue();
    
    const payload: Partial<Bus> = {
      matricule: String(rawValue.matricule || '').trim(),
      capacite: Number(rawValue.capacite),
      type_bus: rawValue.type_bus as 'standard' | 'vip' | 'minibus',
      is_active: rawValue.is_active ?? true
    };

    // ✅ Même logique pour l'agence en modification
    const agenceValue = rawValue.agence;
    if (typeof agenceValue === 'number' && agenceValue > 0) {
      payload.agence = agenceValue;
    }

    this.http.patch<Bus>(`${this.apiUrl}/bus/${this.busAModifier.id}/`, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMsg = `✅ Bus "${response.matricule}" mis à jour !`;
        this.showModifier = false;
        this.busAModifier = null;
        this.loadBuses();
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        console.error('❌ Erreur modification:', err.error);
        this.errorMsg = err.error?.matricule?.[0] 
          || err.error?.detail 
          || JSON.stringify(err.error) 
          || 'Erreur modification.';
      }
    });
  }

  // ===== SUPPRESSION =====
  supprimerBus(bus: Bus): void {
    if (!confirm(`⚠️ Supprimer le bus "${bus.matricule}" ? Cette action est irréversible.`)) return;
    
    this.http.delete(`${this.apiUrl}/bus/${bus.id}/`, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.successMsg = `🗑 Bus "${bus.matricule}" supprimé.`;
        this.loadBuses();
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: (err) => {
        console.error('❌ Erreur suppression:', err);
        if (err.error?.detail?.includes('related') || err.error?.detail?.includes('foreign key')) {
          this.errorMsg = '❌ Ce bus est lié à des trajets existants. Impossible de le supprimer.';
        } else {
          this.errorMsg = 'Erreur lors de la suppression.';
        }
      }
    });
  }

  // ===== UTILITAIRES D'AFFICHAGE =====
  getTypeBadgeClass(type: string): string {
    const map: Record<string, string> = {
      'standard': 'badge-blue',
      'vip': 'badge-gold', 
      'minibus': 'badge-green'
    };
    return map[type] || 'badge-gray';
  }

  getTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'standard': '🚌 Standard',
      'vip': '✨ VIP',
      'minibus': '🚐 Minibus'
    };
    return map[type] || type;
  }

  // ✅ GETTERS POUR VALIDATION TEMPLATE
  get activeBusCount(): number {
    return this.buses.filter((bus) => bus.is_active !== false).length;
  }

  get totalCapacity(): number {
    return this.buses.reduce((total, bus) => total + Number(bus.capacite || 0), 0);
  }

  get busTypeCount(): number {
    return new Set(this.buses.map((bus) => bus.type_bus)).size;
  }

  cleanTypeLabel(type: string): string {
    const map: Record<string, string> = {
      standard: 'Standard',
      vip: 'VIP',
      minibus: 'Minibus'
    };
    return map[type] || type;
  }

  get f() { return this.busForm.controls; }
  get m() { return this.modifForm.controls; }
}
