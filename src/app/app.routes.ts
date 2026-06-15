import { Routes } from '@angular/router';
import { authGuard, adminGuard, gestionnaireGuard, publicGuard } from './guards/auth-guard';

export const routes: Routes = [
  // ===========================
  // === PUBLIC ===
  // ===========================
  {
    path: '',
    loadComponent: () => import('./pages/accueil/accueil').then((m) => m.Accueil),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [publicGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
    canActivate: [publicGuard],
  },

  // ===========================
  // === DASHBOARD ADMIN ===
  // ===========================
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [adminGuard],
  },

  // ===========================
  // === DASHBOARD GESTIONNAIRE ===
  // ===========================
  {
    path: 'gestionnaire',
    loadComponent: () => import('./pages/gestionnaire/pageAG/gestionnaire').then((m) => m.GestionnaireComponent),
    canActivate: [gestionnaireGuard],
  },
  // Alias pour compatibilité
  {
    path: 'Gestionnaire',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },

  // ===========================
  // === ESPACE GESTIONNAIRE ===
  // ===========================
  {
    path: 'gestionnaire/trajets',
    loadComponent: () => import('./pages/gestionnaire/trajets/trajets').then((m) => m.GestionnaireTrajets),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'gestionnaire/reservations',
    loadComponent: () => import('./pages/gestionnaire/reservations/reservations').then((m) => m.GestionnaireReservations),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'gestionnaire/buses',
    loadComponent: () => import('./pages/gestionnaire/bus/bus').then((m) => m.GestionnaireBuses),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'gestionnaire/paiement',
    loadComponent: () => import('./pages/gestionnaire/paiement/paiement').then((m) => m.Paiement),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'gestionnaire/chauffeurs',
    loadComponent: () => import('./pages/gestionnaire/chauffeurs/chauffeurs').then((m) => m.GestionnaireChauffeurs),
    canActivate: [gestionnaireGuard],
  },

  // ===========================
  // === ADMIN — VUE ACTIVITÉS D'UN GESTIONNAIRE ===
  // ===========================
  {
    path: 'dashboard/gestionnaires/:id/activites',
    loadComponent: () => import('./pages/admin/gestionnaire-activites/gestionnaire-activites').then((m) => m.GestionnaireActivitesComponent),
    canActivate: [adminGuard],
  },

  // ===========================
  // === ADMIN — MODE IMPERSONIFICATION (gérer les données d'un gestionnaire) ===
  // ===========================
  {
    path: 'admin/gestionnaire/:managerId/trajets',
    loadComponent: () => import('./pages/gestionnaire/trajets/trajets').then((m) => m.GestionnaireTrajets),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/gestionnaire/:managerId/buses',
    loadComponent: () => import('./pages/gestionnaire/bus/bus').then((m) => m.GestionnaireBuses),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/gestionnaire/:managerId/reservations',
    loadComponent: () => import('./pages/gestionnaire/reservations/reservations').then((m) => m.GestionnaireReservations),
    canActivate: [adminGuard],
  },

  // ===========================
  // === ROUTES LEGACY (conservées pour compatibilité) ===
  // ===========================
  {
    path: 'trajets',
    loadComponent: () => import('./pages/gestionnaire/trajets/trajets').then((m) => m.GestionnaireTrajets),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'reservations',
    loadComponent: () => import('./pages/gestionnaire/reservations/reservations').then((m) => m.GestionnaireReservations),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'paiement',
    loadComponent: () => import('./pages/gestionnaire/paiement/paiement').then((m) => m.Paiement),
    canActivate: [gestionnaireGuard],
  },
  {
    path: 'bus/gestionnaire',
    redirectTo: 'gestionnaire/buses',
    pathMatch: 'full',
  },

  // ===========================
  // === ESPACE CLIENT ===
  // ===========================
  {
    path: 'client/trajets',
    loadComponent: () => import('./pages/client/client-trajets/client-trajets').then(m => m.ClientTrajets),
    canActivate: [authGuard],
  },
  {
    path: 'client/trajets/:id',
    loadComponent: () => import('./pages/client/client-trajet-detail/client-trajet-detail').then(m => m.ClientTrajetDetail),
    canActivate: [authGuard],
  },
  {
    path: 'client/paiement',
    loadComponent: () => import('./pages/client/client-paiement/client-paiement').then(m => m.ClientPaiement),
    canActivate: [authGuard],
  },
  {
    path: 'client/reservations',
    loadComponent: () => import('./pages/client/client-reservation/client-reservation').then(m => m.ClientReservations),
    canActivate: [authGuard],
  },
  {
    path: 'client/profil',
    loadComponent: () => import('./pages/client/client-profile/client-profile').then(m => m.ClientProfile),
    canActivate: [authGuard],
  },

  // ===========================
  // === FALLBACK 404 ===
  // ===========================
  {
    path: '**',
    redirectTo: 'login',
  },
];
