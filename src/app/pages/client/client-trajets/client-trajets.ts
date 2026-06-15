import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService, User } from '../../../services/auth.service';
import { catchError, timeout, throwError, finalize } from 'rxjs';

// ✅ INTERFACE : places_disponibles garanti comme nombre
export interface Trajet {
  id: number;
  ville_depart: string;
  ville_arrivee: string;
  date_depart: string;
  heure_depart: string;
  prix: number;
  places_disponibles: number;
  statut: string;
  bus_details?: {
    matricule: string;
    type_bus: string;
    capacite?: number;
    agence_nom?: string;
  };
  agence_nom?: string;
}

@Component({
  selector: 'app-client-trajets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './client-trajets.html',
  styleUrl: './client-trajets.scss'
})
export class ClientTrajets implements OnInit {
  private readonly apiUrl = environment.apiUrl;
  searchForm!: FormGroup;
  trajets: Trajet[] = [];
  loading = false;
  searched = false;
  today = new Date().toISOString().split('T')[0];
  errorMessage = '';
  user: User | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.user = this.auth.getCurrentUser();
    this.initForm();
    // ✅ Charge TOUS les trajets au démarrage (sans filtres)
    this.loadTrajets();
  }

  initForm(): void {
    // ✅ Champs vides pour permettre une recherche large ou "tout afficher"
    this.searchForm = this.fb.group({
      ville_depart: [''],
      ville_arrivee: [''],
      date_depart: ['']
    });
  }

  /**
   * ✅ Charge TOUS les trajets (Appel initial et bouton "Retry")
   * N'envoie AUCUN paramètre à l'API pour tout récupérer.
   */
  loadTrajets(): void {
    console.log(' Chargement initial : TOUS les trajets');
    this.loading = true;
    this.errorMessage = '';
    this.searched = true;

    // ✅ Appel simple sans paramètres
    this.http.get<any>(`${this.apiUrl}/trajets/`)
      .pipe(
        timeout(15000),
        finalize(() => { this.loading = false; this.cdr.detectChanges(); }),
        catchError((error) => {
          this.errorMessage = error.status === 0 
            ? '🔌 Serveur injoignable' 
            : `Erreur ${error.status}`;
          this.cdr.detectChanges();
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (response) => {
          this.processData(response);
        },
        error: () => {}
      });
  }

  /**
   * ✅ Recherche avec filtres (Bouton "Rechercher")
   * Envoie les paramètres uniquement si remplis.
   */
  search(): void {
    console.log('🔍 Recherche avec filtres');
    this.loading = true;
    this.errorMessage = '';
    this.searched = true;

    const params: any = {};
    const formValue = this.searchForm.value;

    // ✅ Ajout des filtres conditionnels
    if (formValue.ville_depart?.trim()) params.ville_depart__icontains = formValue.ville_depart.trim();
    if (formValue.ville_arrivee?.trim()) params.ville_arrivee__icontains = formValue.ville_arrivee.trim();
    if (formValue.date_depart) params.date_depart = formValue.date_depart;

    console.log('🔍 Params envoyés:', params);

    this.http.get<any>(`${this.apiUrl}/trajets/`, { params })
      .pipe(
        timeout(15000),
        finalize(() => { this.loading = false; this.cdr.detectChanges(); }),
        catchError((error) => {
          this.errorMessage = error.status === 0 
            ? ' Serveur injoignable' 
            : `Erreur ${error.status}`;
          this.cdr.detectChanges();
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (response) => {
          this.processData(response);
        },
        error: () => {}
      });
  }

  /**
   * ✅ Traitement et Normalisation des données
   */
  private processData(response: any): void {
    const rawData: any[] = this.extractData(response);
    console.log(`📦 Données brutes reçues: ${rawData.length}`);

    this.trajets = rawData.map((t: any): Trajet => {
      const propVal = t.places_disponibles;
      const capVal = t.bus_details?.capacite;
      
      let places: number = 0;
      if (typeof propVal === 'number' && !isNaN(propVal)) places = propVal;
      else if (typeof capVal === 'number' && !isNaN(capVal)) places = capVal;

      return {
        id: Number(t.id ?? 0),
        ville_depart: String(t.ville_depart ?? 'N/A'),
        ville_arrivee: String(t.ville_arrivee ?? 'N/A'),
        date_depart: String(t.date_depart ?? ''),
        heure_depart: String(t.heure_depart ?? ''),
        prix: Number(t.prix ?? 0),
        places_disponibles: places,
        statut: String(t.statut ?? 'inconnu'),
        bus_details: t.bus_details,
        agence_nom: t.agence_nom
      };
    }).filter(t => t.places_disponibles > 0); // ✅ Garde seulement les trajets avec places > 0

    console.log(`✅ ${this.trajets.length} trajet(s) affiché(s)`);
    this.cdr.detectChanges();
  }

  /**
   * ✅ Méthode pour extraire les données de la réponse API
   */
  private extractData(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.results && Array.isArray(response.results)) return response.results;
    if (response.data && Array.isArray(response.data)) return response.data;
    return [];
  }

  /**
   * ✅ Réinitialiser la recherche (Affiche tout à nouveau)
   */
  resetSearch(): void {
    this.searchForm.reset({
      ville_depart: '',
      ville_arrivee: '',
      date_depart: ''
    });
    this.errorMessage = '';
    this.loadTrajets(); // ✅ Recharge tous les trajets
  }

  goToTrajetDetail(trajetId: number | undefined): void {
    if (trajetId !== undefined && trajetId !== null && !isNaN(trajetId)) {
      this.router.navigate(['/client/trajets', trajetId]);
    }
  }

  // ✅ HELPERS SÉCURISÉS
  getUserName(): string {
    const u = this.user;
    return u ? (u.first_name ?? u.username ?? 'Client') : 'Client';
  }

  getUserAvatar(): string {
    const u = this.user;
    const char = u?.first_name?.charAt(0) ?? u?.username?.charAt(0) ?? 'C';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(char)}&background=667eea&color=fff&size=128`;
  }

  logout(): void {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      this.auth.logout();
      this.router.navigate(['/login']);
    }
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch { return 'N/A'; }
  }

  formatPrice(price: number | null | undefined): string {
    const p = (price !== undefined && price !== null) ? Number(price) : 0;
    return new Intl.NumberFormat('fr-FR').format(p) + ' FCFA';
  }

  getPlaces(trajet: Trajet): number {
    return trajet.places_disponibles;
  }

  getAgency(trajet: Trajet): string {
    return trajet.agence_nom || trajet.bus_details?.agence_nom || 'Agence';
  }

  getBusType(trajet: Trajet): string {
    return trajet.bus_details?.type_bus || 'Bus';
  }
}