import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

// ✅ Variables pour gérer le rafraîchissement concurrent
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * ✅ Intercepteur fonctionnel Angular 17+
 * Compatible avec withInterceptors() dans app.config.ts
 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn): Observable<any> => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  
  // ✅ N'injecte le token que sur les URLs API locales
  const isApiUrl = req.url.startsWith('http') && !req.url.includes('github') && !req.url.includes('fonts.googleapis');
  const isAuthEndpoint = req.url.includes('/auth/jwt/create/')
    || req.url.includes('/auth/jwt/refresh/')
    || req.url.includes('/token/')
    || req.url.includes('/token/refresh/');
  
  if (token && isApiUrl) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isApiUrl && !isAuthEndpoint) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

/**
 * ✅ Gère l'erreur 401 : tente de rafraîchir le token
 */
function handle401Error(
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response: { access: string; refresh?: string }) => {
        if (response.access) {
          localStorage.setItem('token', response.access);
        }
        if (response.refresh) {
          localStorage.setItem('refreshToken', response.refresh);
        }

        isRefreshing = false;
        refreshTokenSubject.next(response.access);

        return next(
          req.clone({ setHeaders: { Authorization: `Bearer ${response.access}` } })
        );
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      }),
      finalize(() => { isRefreshing = false; })
    );
  } else {
    // ✅ Attendre que le refresh en cours se termine
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((newToken: string | null) => {
        if (!newToken) return throwError(() => new Error('No new token'));
        return next(
          req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
        );
      })
    );
  }
}
