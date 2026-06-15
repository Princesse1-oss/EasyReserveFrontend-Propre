import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

function passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
  const p = control.get('password');
  const p2 = control.get('password_confirm');
  if (p && p2 && p.value !== p2.value) return { passwordMismatch: true };
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  registerForm: FormGroup;
  loading = false;
  erreur = '';
  succes = '';
  showPassword = false;
  showPassword2 = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirm: ['', Validators.required],
    }, { validators: passwordMatchValidator });

    if (this.authService.isLoggedIn()) {
      this.redirigerSelonRole();
    }
  }

  get username() { return this.registerForm.get('username'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get password_confirm() { return this.registerForm.get('password_confirm'); }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  togglePassword2(): void { this.showPassword2 = !this.showPassword2; }

  getPasswordStrength(): string {
    const pwd = this.password?.value || '';
    if (pwd.length < 6) return 'faible';
    if (pwd.length < 10 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return 'moyen';
    return 'fort';
  }

  getPasswordStrengthLabel(): string {
    const s = this.getPasswordStrength();
    if (s === 'faible') return 'Faible';
    if (s === 'moyen') return 'Moyen';
    return 'Fort';
  }

  redirigerSelonRole(): void {
    const user = this.authService.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return; }
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
        this.router.navigate(['/login']);
    }
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;
    this.loading = true;
    this.erreur = '';
    this.succes = '';

    const { username, email, password } = this.registerForm.value;
    // password_confirm n'est pas envoyé au backend — validation uniquement côté frontend

    this.authService.register({ username, email, password }).subscribe({
      next: () => {
        this.loading = false;
        this.succes = 'Compte créé avec succès ! Redirection...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        if (err.error?.username) this.erreur = 'Ce nom est déjà pris.';
        else if (err.error?.email) this.erreur = 'Cet email est déjà utilisé.';
        else this.erreur = 'Erreur serveur. Veuillez réessayer.';
      },
    });
  }
}
