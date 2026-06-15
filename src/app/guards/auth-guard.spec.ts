import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core'; 
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { isPlatformBrowser } from '@angular/common';

export const authGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // 1. SSR / Server-side rendering handling
  if (!isPlatformBrowser(platformId)){
    return true;
  }

  // 2. Access restriction for non-authenticated clients
  if (!authService.isLoggedIn()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // 3. Admin access authorization
  if (authService.isAdmin() || authService.isGestionnaire()){
    return true;
  }
 
  // 4. Fallback redirection for regular CLIENT actors
  // 💡 Added 'return false;' to satisfy type safety and shifted to /trajets
  router.navigate(['/trajets']);
  return false; 
};

export const adminGuard: CanActivateFn = (): boolean => {
  const authService = inject<AuthService>(AuthService);
  const router = inject(Router);

  // 💡 Administrators and Managers are fully authorized
  if (authService.isLoggedIn() && (authService.isAdmin() || authService.isGestionnaire())) {
    return true;
  }

  router.navigate(['/trajets']);
  return false;
};
