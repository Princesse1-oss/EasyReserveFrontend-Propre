import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service'; // ✅ AJOUT DE ', User' ICI

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  loginForm: FormGroup;
  loading = false;
  erreur = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });

    if (this.authService.isLoggedIn()) {
      this.redirigerSelonRole();
    }
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }

  redirigerSelonRole(): void {
    const user = this.authService.getCurrentUser();
    
    if (!user || !user.role) {
      console.warn('⚠️ Utilisateur ou rôle manquant');
      this.router.navigate(['/login']);
      return;
    }

    console.log('🔀 Redirection pour rôle:', user.role);
    
    switch (user.role) {
      case 'ADMIN':
        this.router.navigate(['/dashboard']);
        break;
      case 'GESTIONNAIRE':
        this.router.navigate(['/gestionnaire']);
        break;
      case 'CLIENT':
        this.router.navigate(['/client/trajets']);
        break;
      default:
        this.authService.logout();
        this.router.navigate(['/login']);
    }
  }

  // ✅ onSubmit() avec typage correct
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    
    this.loading = true;
    this.erreur = '';

    this.authService.login(this.loginForm.value).subscribe({
        next: (user) => {
          console.log('🔍 DEBUG next() appelé');
          console.log('🔍 localStorage.token:', localStorage.getItem('token'));
          console.log('🔍 currentUser:', this.authService.getCurrentUser());
          
          this.loading = false;
          if (user) {
            console.log('🚀 Appel de redirigerSelonRole()');
            this.redirigerSelonRole();
          }
        },
        error: (err) => {
          this.loading = false;
          if (err.status === 0) {
            this.erreur = 'Serveur injoignable. Vérifiez votre connexion.';
          } else if (err.status === 401) {
            this.erreur = 'Identifiants incorrects. Vérifiez votre nom d\'utilisateur et mot de passe.';
          } else if (err.status === 400) {
            this.erreur = err.error?.detail || err.error?.non_field_errors?.[0] || 'Données invalides.';
          } else {
            this.erreur = `Erreur serveur (${err.status}). Réessayez plus tard.`;
          }
        }
      });
  }
}
