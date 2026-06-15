import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

// Structure exacte retournée par GET /api/users/gestionnaires/{id}/activites/
interface ActivitesResponse {
  agence: {
    id: number;
    nom: string;
    ville: string;
    contact: string;
  };
  stats: {
    total_reservations: number;
    reservations_confirmees: number;
    total_trajets: number;
    total_bus: number;
  };
  reservations: any[];
  trajets: any[];
  buses: any[];
}

@Component({
  selector: 'app-gestionnaire-activites',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gestionnaire-activites.html',
  styleUrl: './gestionnaire-activites.scss'
})
export class GestionnaireActivitesComponent implements OnInit {

  loading = true;
  erreur = '';

  gestionnaireId!: number;
  gestionnaireNom = '';
  agenceNom = '';

  // ✅ Champs alignés sur ce que le backend retourne réellement
  statistiques = {
    chiffre_affaires: 0,       // calculé localement depuis les réservations
    total_reservations: 0,
    total_billets: 0,          // alias de total_reservations (billets = réservations confirmées)
    total_trajets: 0,
    total_bus: 0,
    taux_occupation: 0         // calculé localement
  };

  reservations: any[] = [];
  trajets: any[] = [];
  buses: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (!idParam) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.gestionnaireId = Number(idParam);

    // Récupère le nom du gestionnaire depuis les queryParams (passés par le dashboard)
    this.gestionnaireNom = this.route.snapshot.queryParamMap.get('nom') || `Gestionnaire #${this.gestionnaireId}`;
    this.agenceNom = this.route.snapshot.queryParamMap.get('agence') || 'Agence inconnue';

    console.log('👁️ Consultation activités gestionnaire ID:', this.gestionnaireId);
    this.chargerActivitesGestionnaire();
  }

  chargerActivitesGestionnaire(): void {
    this.loading = true;
    this.erreur = '';

    const url = `${environment.apiUrl}/users/gestionnaires/${this.gestionnaireId}/activites/`;
    console.log('📡 Appel API:', url);

    this.http.get<ActivitesResponse>(url)
      .pipe(
        catchError(error => {
          console.error('❌ Erreur API activités:', error);
          if (error.status === 401) {
            this.erreur = 'Session expirée. Veuillez vous reconnecter.';
            this.authService.logout();
          } else if (error.status === 400) {
            this.erreur = 'Ce gestionnaire n\'a pas d\'agence assignée.';
          } else if (error.status === 404) {
            this.erreur = 'Gestionnaire introuvable.';
          } else {
            this.erreur = 'Impossible de charger les activités.';
          }
          return of(null);
        }),
        finalize(() => { this.loading = false; })
      )
      .subscribe(response => {
        if (!response) return;

        console.log('✅ Réponse backend:', response);

        // ✅ Mapping correct : response.agence (pas response.gestionnaire)
        this.agenceNom = response.agence?.nom || this.agenceNom;

        this.reservations = response.reservations || [];
        this.trajets = response.trajets || [];
        this.buses = response.buses || [];

        // ✅ Mapping correct : response.stats (pas response.statistiques)
        const stats = response.stats || {};
        this.statistiques = {
          chiffre_affaires: this.calculerChiffreAffaires(this.reservations),
          total_reservations: stats.total_reservations || 0,
          total_billets: stats.reservations_confirmees || 0,   // billets = réservations confirmées
          total_trajets: stats.total_trajets || 0,
          total_bus: stats.total_bus || 0,
          taux_occupation: this.calculerTauxOccupation(this.trajets)
        };

        console.log('📊 Statistiques calculées:', this.statistiques);
      });
  }

  // ✅ Calcule le chiffre d'affaires depuis les réservations
  private calculerChiffreAffaires(reservations: any[]): number {
    return reservations.reduce((total, r) => {
      const montant = r.montant_total || r.prix || r.trajet?.prix || 0;
      const places = r.nombre_places || 1;
      return total + (montant * places);
    }, 0);
  }

  // ✅ Calcule le taux d'occupation moyen des trajets
  private calculerTauxOccupation(trajets: any[]): number {
    if (!trajets.length) return 0;
    const total = trajets.reduce((sum, t) => {
      const capacite = t.bus_capacite || t.bus?.capacite || 45;
      const disponibles = t.places_disponibles ?? capacite;
      const vendues = capacite - disponibles;
      return sum + (capacite > 0 ? (vendues / capacite) * 100 : 0);
    }, 0);
    return Math.round(total / trajets.length);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  goToTrajets(): void {
    this.router.navigate([`/admin/gestionnaire/${this.gestionnaireId}/trajets`], {
      queryParams: { nom: this.gestionnaireNom, agence: this.agenceNom }
    });
  }

  goToReservations(): void {
    this.router.navigate([`/admin/gestionnaire/${this.gestionnaireId}/reservations`], {
      queryParams: { nom: this.gestionnaireNom, agence: this.agenceNom }
    });
  }

  goToBuses(): void {
    this.router.navigate([`/admin/gestionnaire/${this.gestionnaireId}/buses`], {
      queryParams: { nom: this.gestionnaireNom, agence: this.agenceNom }
    });
  }

  formatPrix(prix: number): string {
    return new Intl.NumberFormat('fr-FR').format(prix) + ' FCFA';
  }
}
