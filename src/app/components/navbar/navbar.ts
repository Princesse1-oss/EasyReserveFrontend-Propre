import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  menuOuvert = false;

  constructor(private readonly authService: AuthService) {}

  get user(): User | null {
    return this.authService.getCurrentUser();
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get isGestionnaire(): boolean {
    return this.authService.isGestionnaire();
  }

  toggleMenu(): void {
    this.menuOuvert = !this.menuOuvert;
  }

  onLogout(): void {
    this.authService.logout();
  }
}