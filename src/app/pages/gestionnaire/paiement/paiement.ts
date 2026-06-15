import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PaiementService, PaiementResponse } from '../../../services/paiement.service';
import { AuthService } from '../../../services/auth.service';

type PaiementStatut = 'all' | 'en_attente' | 'valide' | 'echoue' | 'annule';

@Component({
  selector: 'app-paiement',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './paiement.html',
  styleUrl: './paiement.scss'
})
export class Paiement implements OnInit {
  paiements: PaiementResponse[] = [];
  filteredPaiements: PaiementResponse[] = [];

  loading = true;
  submittingId: number | null = null;
  erreur = '';
  succes = '';

  searchQuery = '';
  filterStatut: PaiementStatut = 'all';
  filterMethode = 'all';

  constructor(
    private paiementService: PaiementService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPaiements();
    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.erreur = 'Chargement interrompu. Verifiez que le serveur Django est demarre et que votre session est valide.';
      }
    }, 9000);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadPaiements(): void {
    this.loading = true;
    this.erreur = '';
    this.paiementService.getPaiements().subscribe({
      next: (data: any) => {
        this.paiements = Array.isArray(data) ? data : (data?.results || []);
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les paiements.';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredPaiements = this.paiements.filter((p: any) => {
      const matchesSearch = !q
        || String(p.id).includes(q)
        || String(p.client_username || '').toLowerCase().includes(q)
        || String(p.trajet_info || '').toLowerCase().includes(q)
        || String(p.transaction_id || '').toLowerCase().includes(q)
        || String(p.telephone_paiement || '').includes(q);

      const matchesStatut = this.filterStatut === 'all' || p.statut === this.filterStatut;
      const matchesMethode = this.filterMethode === 'all' || p.methode === this.filterMethode;
      return matchesSearch && matchesStatut && matchesMethode;
    });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatut = 'all';
    this.filterMethode = 'all';
    this.applyFilters();
  }

  validerPaiement(id: number): void {
    this.updatePaiement(id, 'valide');
  }

  refuserPaiement(id: number): void {
    this.updatePaiement(id, 'echoue');
  }

  private updatePaiement(id: number, statut: 'valide' | 'echoue'): void {
    if (statut === 'echoue' && !confirm('Refuser ce paiement ?')) return;
    this.submittingId = id;
    this.erreur = '';
    this.succes = '';

    this.paiementService.validerPaiement(id, statut).subscribe({
      next: () => {
        const paiement = this.paiements.find((p) => p.id === id);
        if (paiement) paiement.statut = statut;
        this.applyFilters();
        this.succes = statut === 'valide' ? 'Paiement valide avec succes.' : 'Paiement marque comme echoue.';
        this.submittingId = null;
        setTimeout(() => this.succes = '', 3000);
      },
      error: (err) => {
        this.erreur = err.error?.detail || 'Impossible de mettre a jour le paiement.';
        this.submittingId = null;
      }
    });
  }

  get totalPaiements(): number {
    return this.paiements.length;
  }

  get paiementsEnAttente(): number {
    return this.paiements.filter((p: any) => p.statut === 'en_attente').length;
  }

  get paiementsValides(): number {
    return this.paiements.filter((p: any) => p.statut === 'valide').length;
  }

  get revenuValide(): number {
    return this.paiements
      .filter((p: any) => p.statut === 'valide')
      .reduce((total, p: any) => total + Number(p.montant || 0), 0);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA';
  }

  formatDate(value: string): string {
    if (!value) return 'Non renseignee';
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatutClass(statut: string): string {
    if (statut === 'valide') return 'valide';
    if (statut === 'echoue' || statut === 'annule') return 'echoue';
    return 'en_attente';
  }

  getStatutLabel(statut: string): string {
    if (statut === 'valide') return 'Valide';
    if (statut === 'echoue') return 'Echoue';
    if (statut === 'annule') return 'Annule';
    return 'En attente';
  }

  getMethodeLabel(methode: string): string {
    const map: Record<string, string> = {
      orange_money: 'Orange Money',
      mtn_money: 'MTN MoMo',
      mtn_momo: 'MTN MoMo',
      carte_bancaire: 'Carte bancaire',
      carte: 'Carte bancaire',
      espece: 'Especes'
    };
    return map[methode] || methode;
  }
}
