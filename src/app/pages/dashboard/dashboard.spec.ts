import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ReservationService, Reservation } from '../../services/reservation.service';
import { environment } from '../../../environments/environment';
import { User } from '../client/client-profile/client-profile';

interface Agence {
  id: number;
  nom: string;
  adresse: string;
  telephone: string;
  email_contact: string;
  gestionnaire: number | null;
  gestionnaire_username: string;
}

interface Gestionnaire {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  agence?: Agence;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  user: User | null = null;
  reservations: Reservation[] = [];
  gestionnaires: Gestionnaire[] = [];
  agences: Agence[] = [];
  loading = false;
  loadingGestionnaires = false;
  activeSection = 'tableau-bord';

  // Agence form
  showFormAgence = false;
  agenceForm: FormGroup;
  loadingFormA = false;
  erreurFormA = '';
  succesFormA = '';

  // Gestionnaire form
  showFormGestionnaire = false;
  gestionnaireForm: FormGroup;
  loadingFormG = false;
  erreurFormG = '';
  succesFormG = '';

  // Detail gestionnaire
  gestionnaireSelectionne: Gestionnaire | null = null;
  showDetailGestionnaire = false;
  reservationsGestionnaire: any[] = [];
  loadingDetail = false;

  // Detail agence
  agenceSelectionnee: Agence | null = null;
  showDetailAgence = false;

  // Modifier agence
  agenceAModifier: Agence | null = null;
  showModifierAgence = false;
  modifAgenceForm: FormGroup;
  loadingModif = false;
  erreurModif = '';
  succesModif = '';

  private apiUrl = environment.apiUrl;

  constructor(
    private readonly authService: AuthService,
    private readonly reservationService: ReservationService,
    private readonly fb: FormBuilder,
    private readonly http: HttpClient
  ) {
    this.agenceForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(3)]],
      adresse: ['', Validators.required],
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,15}$/)]],
      email_contact: [''],
    });

    this.gestionnaireForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirm: ['', Validators.required],
      agence_id: ['', Validators.required],
    });

    this.modifAgenceForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(3)]],
      adresse: [''],
      telephone: [''],
      email_contact: [''],
    });
  }

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.chargerReservations();
    if (this.user?.role === 'ADMIN') {
      this.chargerGestionnaires();
      this.chargerAgences();
    }
  }

  setSection(section: string): void {
    this.activeSection = section;
    this.showFormAgence = false;
    this.showFormGestionnaire = false;
  }

  chargerReservations(): void {
    this.loading = true;
    this.reservationService.getMesReservations().subscribe({
      next: (data) => { this.reservations = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  chargerGestionnaires(): void {
    this.loadingGestionnaires = true;
    this.http.get<any>(`${this.apiUrl}/users/?role=GESTIONNAIRE`).subscribe({
      next: (data) => {
        this.gestionnaires = Array.isArray(data) ? data : data.results || [];
        this.loadingGestionnaires = false;
      },
      error: () => { this.loadingGestionnaires = false; },
    });
  }

  chargerAgences(): void {
    this.http.get<any>(`${this.apiUrl}/agences/`).subscribe({
      next: (data) => { this.agences = Array.isArray(data) ? data : data.results || []; },
      error: () => {},
    });
  }

  get agencesDisponibles(): Agence[] {
    return this.agences.filter(a => !a.gestionnaire);
  }

  getAgenceNom(gestionnaireId: number): string {
    return this.agences.find(a => a.gestionnaire === gestionnaireId)?.nom || 'Aucune agence';
  }

  // ===== AGENCE =====
  toggleFormAgence(): void {
    this.showFormAgence = !this.showFormAgence;
    this.erreurFormA = '';
    this.succesFormA = '';
    this.agenceForm.reset();
  }

  creerAgence(): void {
    if (this.agenceForm.invalid) return;
    this.loadingFormA = true;
    this.erreurFormA = '';
    this.succesFormA = '';

    this.http.post<Agence>(`${this.apiUrl}/agences/`, this.agenceForm.value).subscribe({
      next: () => {
        this.loadingFormA = false;
        this.succesFormA = 'Agence créée avec succès !';
        this.agenceForm.reset();
        this.chargerAgences();
        setTimeout(() => { this.showFormAgence = false; this.succesFormA = ''; }, 2000);
      },
      error: (err) => {
        this.loadingFormA = false;
        this.erreurFormA = err.error?.nom?.[0] || 'Impossible de créer l\'agence.';
      },
    });
  }

  voirDetailAgence(a: Agence): void {
    this.agenceSelectionnee = a;
    this.showDetailAgence = true;
  }

  fermerDetailAgence(): void {
    this.showDetailAgence = false;
    this.agenceSelectionnee = null;
  }

  modifierAgence(a: Agence): void {
    this.agenceAModifier = a;
    this.showModifierAgence = true;
    this.erreurModif = '';
    this.succesModif = '';
    this.modifAgenceForm.patchValue({
      nom: a.nom,
      adresse: a.adresse,
      telephone: a.telephone,
      email_contact: a.email_contact,
    });
  }

  fermerModifierAgence(): void {
    this.showModifierAgence = false;
    this.agenceAModifier = null;
  }

  sauvegarderModification(): void {
    if (!this.agenceAModifier || this.modifAgenceForm.invalid) return;
    this.loadingModif = true;
    this.erreurModif = '';

    this.http.patch(`${this.apiUrl}/agences/${this.agenceAModifier.id}/`, this.modifAgenceForm.value).subscribe({
      next: () => {
        this.loadingModif = false;
        this.succesModif = 'Agence modifiée avec succès !';
        this.chargerAgences();
        setTimeout(() => { this.fermerModifierAgence(); }, 1500);
      },
      error: (err) => {
        this.loadingModif = false;
        this.erreurModif = err.error?.nom?.[0] || 'Erreur lors de la modification.';
      },
    });
  }

  supprimerAgence(a: Agence): void {
    const msg = a.gestionnaire
      ? `Supprimer "${a.nom}" supprimera aussi le gestionnaire "${a.gestionnaire_username}". Confirmer ?`
      : `Supprimer l'agence "${a.nom}" ?`;

    if (!confirm(msg)) return;

    this.http.delete(`${this.apiUrl}/agences/${a.id}/`).subscribe({
      next: () => {
        this.chargerAgences();
        this.chargerGestionnaires();
      },
      error: () => { alert('Erreur lors de la suppression.'); },
    });
  }

  // ===== GESTIONNAIRE =====
  toggleFormGestionnaire(): void {
    this.showFormGestionnaire = !this.showFormGestionnaire;
    this.erreurFormG = '';
    this.succesFormG = '';
    this.gestionnaireForm.reset();
  }

  creerGestionnaire(): void {
    if (this.gestionnaireForm.invalid) return;
    this.loadingFormG = true;
    this.erreurFormG = '';
    this.succesFormG = '';
    const v = this.gestionnaireForm.value;

    this.http.post<any>(`${this.apiUrl}/users/register/`, {
      username: v.username, email: v.email,
      first_name: v.first_name, last_name: v.last_name,
      password: v.password, password_confirm: v.password_confirm,
      role: 'GESTIONNAIRE'
    }).subscribe({
      next: (newUser) => {
        const userId = newUser.id || newUser.user?.id;
        this.http.patch(`${this.apiUrl}/agences/${v.agence_id}/`, { gestionnaire: userId }).subscribe({
          next: () => {
            this.loadingFormG = false;
            this.succesFormG = `Gestionnaire ${v.username} créé et rattaché !`;
            this.gestionnaireForm.reset();
            this.chargerGestionnaires();
            this.chargerAgences();
            setTimeout(() => { this.showFormGestionnaire = false; this.succesFormG = ''; }, 3000);
          },
          error: () => {
            this.loadingFormG = false;
            this.erreurFormG = 'Compte créé mais erreur liaison agence.';
            this.chargerGestionnaires();
          },
        });
      },
      error: (err) => {
        this.loadingFormG = false;
        this.erreurFormG = err.error?.username?.[0] || err.error?.email?.[0] || 'Erreur création.';
      },
    });
  }

  voirDetailGestionnaire(g: Gestionnaire): void {
    const agence = this.agences.find(a => a.gestionnaire === g.id);
    this.gestionnaireSelectionne = { ...g, agence };
    this.showDetailGestionnaire = true;
    this.loadingDetail = true;
    this.http.get<any[]>(`${this.apiUrl}/reservations/`).subscribe({
      next: (data) => { this.reservationsGestionnaire = Array.isArray(data) ? data.slice(0, 10) : []; this.loadingDetail = false; },
      error: () => { this.loadingDetail = false; },
    });
  }

  fermerDetail(): void {
    this.showDetailGestionnaire = false;
    this.gestionnaireSelectionne = null;
  }

  get totalReservations(): number { return this.reservations.length; }
  get reservationsAnnulees(): number { return this.reservations.filter(r => r.statut === 'annulee').length; }
  get reservationsConfirmees(): number { return this.reservations.filter(r => r.statut === 'confirmee').length; }
  get reservationsEnAttente(): number { return this.reservations.filter(r => r.statut === 'en_attente').length; }

  onLogout(): void { this.authService.logout(); }

  get g_username() { return this.gestionnaireForm.get('username'); }
  get g_email() { return this.gestionnaireForm.get('email'); }
  get g_first_name() { return this.gestionnaireForm.get('first_name'); }
  get g_last_name() { return this.gestionnaireForm.get('last_name'); }
  get g_password() { return this.gestionnaireForm.get('password'); }
  get g_agence_id() { return this.gestionnaireForm.get('agence_id'); }
  get a_nom() { return this.agenceForm.get('nom'); }
  get a_adresse() { return this.agenceForm.get('adresse'); }
  get a_telephone() { return this.agenceForm.get('telephone'); }
}