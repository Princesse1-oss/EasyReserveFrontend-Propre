import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// 💡 Updated to check for password_confirm instead of password2
function passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
  const password = control.get('password');
  const passwordConfirm = control.get('password_confirm');
  if (password && passwordConfirm && password.value !== passwordConfirm.value) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  registerForm: FormGroup;
  loading = false;
  erreur = '';
  succes = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public router: Router
  ) {
    // 💡 Aligned form controls with Django specifications (Added email, swapped password2 for password_confirm)
    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        username: ['', [Validators.required, Validators.minLength(3)]],
        first_name: [''],
        last_name: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        password_confirm: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/trajets']);
    }
  }

  get email() { return this.registerForm.get('email'); }
  get username() { return this.registerForm.get('username'); }
  get password() { return this.registerForm.get('password'); }
  get password_confirm() { return this.registerForm.get('password_confirm'); }

  onSubmit(): void {
    if (this.registerForm.invalid) return;
    this.loading = true;
    this.erreur = '';
    this.succes = '';

    // 💡 Transmitting fields matching the backend specifications exactly
    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.succes = 'Compte créé avec succès ! Redirection...';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.loading = false;
        this.erreur = err.error?.username || err.error?.email || 'Erreur lors de la création du compte.';
      },
    });
  }
}
