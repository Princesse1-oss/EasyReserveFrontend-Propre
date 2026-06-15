import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { Chauffeur } from '../../../services/chauffeur.service';

interface Bus {
  id: number;
  matricule: string;
  type_bus: string;
}

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './chauffeurs.html',
  styleUrl: './chauffeurs.scss'
})
export class GestionnaireChauffeurs implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  chauffeurs: Chauffeur[] = [];
  buses: Bus[] = [];
  filteredChauffeurs: Chauffeur[] = [];

  loading = true;
  successMsg = '';
  errorMsg = '';

  searchQuery = '';
  filterStatut = 'all';

  showForm = false;
  isEditMode = false;
  editingId: number | null = null;
  chauffeurForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  get user() { return this.authService.getCurrentUser(); }
  get isAdmin() { return this.user?.role === 'ADMIN'; }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadAll();
  }

  private initForm(c?: Chauffeur): void {
    this.chauffeurForm = this.fb.group({
      nom:          [c?.nom || '',           [Validators.required, Validators.minLength(2)]],
      prenom:       [c?.prenom || '',         [Validators.required, Validators.minLength(2)]],
      telephone:    [c?.telephone || '',      [Validators.required, Validators.pattern(/^[0-9]{9,15}$/)]],
      email:        [c?.email || '',          [Validators.email]],
      numero_permis:[c?.numero_permis || '', [Validators.required, Validators.minLength(4)]],
      statut:       [c?.statut || 'actif',   Validators.required],
      bus_assigne:  [c?.bus_assigne || null],
      date_embauche:[c?.date_embauche || ''],
    });
  }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      chauffeurs: this.http.get<any>(`${this.apiUrl}/chauffeurs/`).pipe(catchError(() => of([]))),
      buses:      this.http.get<any>(`${this.apiUrl}/bus/`).pipe(catchError(() => of([]))),
    }).pipe(finalize(() => { this.loading = false; this.cdr.detectChanges(); }))
    .subscribe(({ chauffeurs, buses }) => {
      this.chauffeurs = Array.isArray(chauffeurs) ? chauffeurs : (chauffeurs?.results || []);
      this.buses      = Array.isArray(buses)      ? buses      : (buses?.results      || []);
      this.applyFilters();
    });
  }

  applyFilters(): void {
    let list = [...this.chauffeurs];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c =>
        c.nom.toLowerCase().includes(q) ||
        c.prenom.toLowerCase().includes(q) ||
        c.telephone.includes(q) ||
        c.numero_permis.toLowerCase().includes(q)
      );
    }
    if (this.filterStatut !== 'all') {
      list = list.filter(c => c.statut === this.filterStatut);
    }
    this.filteredChauffeurs = list;
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatut = 'all';
    this.applyFilters();
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    this.isEditMode = false;
    this.editingId = null;
    this.initForm();
    this.successMsg = '';
    this.errorMsg = '';
  }

  editChauffeur(c: Chauffeur): void {
    this.showForm = true;
    this.isEditMode = true;
    this.editingId = c.id;
    this.initForm(c);
    this.successMsg = '';
    this.errorMsg = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubmit(): void {
    if (this.chauffeurForm.invalid) {
      this.chauffeurForm.markAllAsTouched();
      this.errorMsg = 'Veuillez corriger les erreurs.';
      return;
    }

    const payload = { ...this.chauffeurForm.getRawValue() };
    if (!payload.bus_assigne) payload.bus_assigne = null;
    if (!payload.date_embauche) payload.date_embauche = null;
    if (!payload.email) payload.email = '';

    const url = this.isEditMode && this.editingId
      ? `${this.apiUrl}/chauffeurs/${this.editingId}/`
      : `${this.apiUrl}/chauffeurs/`;

    const request$ = this.isEditMode
      ? this.http.patch<Chauffeur>(url, payload)
      : this.http.post<Chauffeur>(url, payload);

    request$.subscribe({
      next: () => {
        this.successMsg = this.isEditMode ? '✅ Chauffeur mis à jour !' : '✅ Chauffeur créé !';
        this.showForm = false;
        this.isEditMode = false;
        this.editingId = null;
        this.loadAll();
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg = err.error?.numero_permis?.[0]
          || err.error?.telephone?.[0]
          || err.error?.detail
          || JSON.stringify(err.error)
          || 'Erreur lors de la sauvegarde.';
      }
    });
  }

  cancelEdit(): void {
    this.showForm = false;
    this.isEditMode = false;
    this.editingId = null;
    this.initForm();
  }

  deleteChauffeur(c: Chauffeur): void {
    if (!confirm(`Supprimer ${c.prenom} ${c.nom} ? Cette action est irréversible.`)) return;
    this.http.delete(`${this.apiUrl}/chauffeurs/${c.id}/`).subscribe({
      next: () => {
        this.successMsg = `🗑 ${c.prenom} ${c.nom} supprimé.`;
        this.loadAll();
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => { this.errorMsg = 'Erreur lors de la suppression.'; }
    });
  }

  getStatutBadgeClass(statut: string): string {
    const map: Record<string, string> = {
      actif:   'badge-actif',
      inactif: 'badge-inactif',
      conge:   'badge-conge',
    };
    return map[statut] || 'badge-gray';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      actif:   '✅ Actif',
      inactif: '❌ Inactif',
      conge:   '🏖 En congé',
    };
    return map[statut] || statut;
  }

  getBusMatricule(busId: number | null): string {
    if (!busId) return '— Non assigné';
    const bus = this.buses.find(b => b.id === busId);
    return bus ? `🚌 ${bus.matricule}` : `Bus #${busId}`;
  }

  cleanStatutClass(statut: string): string {
    if (statut === 'actif') return 'actif';
    if (statut === 'inactif') return 'inactif';
    if (statut === 'conge') return 'conge';
    return 'inactif';
  }

  cleanStatutLabel(statut: string): string {
    if (statut === 'actif') return 'Actif';
    if (statut === 'inactif') return 'Inactif';
    if (statut === 'conge') return 'En conge';
    return statut;
  }

  get f() { return this.chauffeurForm.controls; }

  get statsActifs(): number  { return this.chauffeurs.filter(c => c.statut === 'actif').length; }
  get statsInactifs(): number { return this.chauffeurs.filter(c => c.statut === 'inactif').length; }
  get statsConge(): number   { return this.chauffeurs.filter(c => c.statut === 'conge').length; }
  get statsTotal(): number   { return this.chauffeurs.length; }
}
