import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-accueil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './accueil.html',
  styleUrl: './accueil.scss',
})
export class Accueil {
  fonctionnalites = [
    { icon: 'bi-search', titre: 'Rechercher', description: 'Filtrez les trajets par ville de depart, destination et date de voyage.' },
    { icon: 'bi-ticket-perforated', titre: 'Reserver', description: 'Consultez les horaires, les prix et les places disponibles avant de confirmer.' },
    { icon: 'bi-credit-card', titre: 'Payer', description: 'Reglez votre billet en ligne par Mobile Money ou carte bancaire.' },
    { icon: 'bi-qr-code', titre: 'Recevoir', description: 'Accedez a votre billet electronique et a l historique de vos reservations.' },
  ];

  stats = [
    { nombre: '24h/24', label: 'Reservation en ligne' },
    { nombre: '3', label: 'Etapes pour reserver' },
    { nombre: '100%', label: 'Billets numeriques' },
    { nombre: 'Admin', label: 'Gestion centralisee' },
  ];
}
