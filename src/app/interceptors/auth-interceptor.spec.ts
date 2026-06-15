import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, Observable, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Liste des endpoints publics à ignorer (pas besoin de token pour se connecter ou s'inscrire)
  const isPublicUrl = req.url.includes('/token/') || req.url.includes('/users/register/');

  let clonedRequest = req;

  // Si on a un jeton et que l'URL n'est pas publique, on injecte le header Bearer
  if (token && !isPublicUrl) {
    clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Gestion des erreurs globales (Ex: si le token expire et renvoie une erreur 401)
  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicUrl) {
        // En cas de token expiré non rafraîchi, on déconnecte de force l'utilisateur
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
