import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Trajet } from './trajet.service';

export interface PlaceDetail {
  id: number;
  numero_siege: number;
  disponible: boolean;
}

export interface Reservation {
  id: number;
  client: number;
  client_username: string;
  trajet: number;
  trajet_detail: Trajet;
  place: number;               // 💡 Aligné sur l'ID de la table Place de Django
  place_detail?: PlaceDetail;  // 💡 Contenu optionnel du siège
  statut: 'en_attente' | 'confirmee' | 'annulee';
  date_reservation: string;
}

export interface CreateReservationRequest {
  trajet: number;
  place: number;  // 💡 Transmission de l'ID unique de la place sélectionnée
}

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private readonly apiUrl = `${environment.apiUrl}/reservations`;

  constructor(private readonly http: HttpClient) {}

  // Lister les réservations de l'utilisateur connecté
  getMesReservations(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.apiUrl}/`);
  }

  getReservation(id: number): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.apiUrl}/${id}/`);
  }

  createReservation(data: CreateReservationRequest): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.apiUrl}/`, data);
  }

  annulerReservation(id: number): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.apiUrl}/${id}/annuler/`, {});
  }

  confirmerReservation(id: number): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.apiUrl}/${id}/confirmer/`, {});
  }
}
