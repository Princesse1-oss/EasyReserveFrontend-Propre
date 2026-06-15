import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  const authService = inject<AuthService>(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  const authService = inject<AuthService>(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
  } else if (authService.isGestionnaire()) {
    router.navigate(['/gestionnaire']);
  } else {
    router.navigate(['/client/trajets']);
  }
  return false;
};

// Guard pour les pages reservees aux gestionnaires uniquement.
export const gestionnaireGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  const authService = inject<AuthService>(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.getCurrentUser();
  if (user?.role === 'GESTIONNAIRE') {
    return true;
  }

  if (user?.role === 'ADMIN') {
    router.navigate(['/dashboard']);
  } else {
    router.navigate(['/client/trajets']);
  }
  return false;
};

// Guard pour les pages publiques (login/register)
// Redirige vers la bonne page d'accueil si déjà connecté
export const publicGuard: CanActivateFn = (): boolean => {
  const authService = inject<AuthService>(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    const user = authService.getCurrentUser();
    if (user?.role === 'ADMIN') {
      router.navigate(['/dashboard']);
    } else if (user?.role === 'GESTIONNAIRE') {
      router.navigate(['/gestionnaire']);
    } else {
      router.navigate(['/client/trajets']);
    }
    return false;
  }

  return true;
};
