import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

// ✅ Interface définie localement pour éviter les erreurs de résolution de modules
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  telephone: string;
  profile_picture: string | null;
  role: 'ADMIN' | 'GESTIONNAIRE' | 'CLIENT';
  agence_id?: number | null;
  is_active?: boolean;
  date_joined?: string;
}

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './client-profile.html',
  styleUrl: './client-profile.scss'
})
export class ClientProfile implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  user: User | null = null;
  userForm!: FormGroup;
  isEditing = false;
  loading = true;
  message: { type: 'success' | 'error' | ''; text: string } = { type: '', text: '' };

  selectedFile: File | null = null;
  profileImagePreview: string | ArrayBuffer | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  loadProfile(): void {
    this.loading = true;
    this.message = { type: '', text: '' };

    this.http.get<User>(`${this.apiUrl}/users/profile/`, { headers: this.getAuthHeaders() }).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (data) => {
        this.user = data;
        this.initForm();
        this.cdr.detectChanges();
      },
      error: () => {
        this.message = { type: 'error', text: 'Impossible de charger le profil.' };
      }
    });
  }

  initForm(): void {
    if (!this.user) return;
    this.userForm = this.fb.group({
      first_name: [this.user.first_name, [Validators.required, Validators.minLength(2)]],
      last_name: [this.user.last_name, [Validators.required, Validators.minLength(2)]],
      email: [this.user.email, [Validators.required, Validators.email]],
      telephone: [this.user.telephone, [Validators.pattern(/^[0-9]{9,15}$/)]]
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.message = { type: '', text: '' };
    this.selectedFile = null;
    this.profileImagePreview = null;
    if (this.isEditing && this.user) {
      this.initForm();
    }
    this.cdr.detectChanges();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.message = { type: 'error', text: 'L\'image ne doit pas dépasser 5 Mo.' };
        return;
      }
      if (!file.type.startsWith('image/')) {
        this.message = { type: 'error', text: 'Veuillez sélectionner une image valide.' };
        return;
      }
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => this.profileImagePreview = reader.result;
      reader.readAsDataURL(file);
      this.message = { type: '', text: '' };
      this.cdr.detectChanges();
    }
  }

  getInitials(): string {
    if (!this.user) return '?';
    return (this.user.first_name?.charAt(0) || '') + (this.user.last_name?.charAt(0) || '');
  }

  getAvatarUrl(): string {
    if (this.profileImagePreview) return this.profileImagePreview as string;
    if (this.user?.profile_picture) return this.user.profile_picture;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.getInitials())}&background=667eea&color=fff&size=256`;
  }

  saveProfile(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = { type: '', text: '' };

    const formData = new FormData();
    const formValue = this.userForm.value;

    formData.append('first_name', formValue.first_name.trim());
    formData.append('last_name', formValue.last_name.trim());
    formData.append('email', formValue.email.trim().toLowerCase());
    formData.append('telephone', formValue.telephone?.trim() || '');

    if (this.selectedFile) {
      formData.append('profile_picture', this.selectedFile);
    }

    // ✅ Appel PATCH avec FormData + Headers d'auth
    this.http.patch<User>(`${this.apiUrl}/users/profile/`, formData, {
      headers: new HttpHeaders({
        'Authorization': this.getAuthHeaders().get('Authorization') || ''
      })
    }).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.isEditing = false;
        this.selectedFile = null;
        this.profileImagePreview = null;
        this.message = { type: 'success', text: '✅ Profil mis à jour avec succès.' };

        // Mise à jour sécurisée du service/auth
        try {
          if (typeof (this.auth as any).updateCurrentUser === 'function') {
            this.auth.updateCurrentUser(updatedUser);
          } else {
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }
        } catch (e) {
          console.warn('️ Fallback localStorage appliqué:', e);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        const errors = Object.entries(err.error || {})
          .map(([field, msgs]: any) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
          .join(' | ');
        this.message = { type: 'error', text: errors || '❌ Échec de la mise à jour.' };
      }
    });
  }
}