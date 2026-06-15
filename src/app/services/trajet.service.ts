import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Bus {
  id: number;
  matricule: string;
  capacite: number;
  type_bus: 'standard' | 'vip' | 'minibus';
  agence?: number;
  agence_nom?: string;
}

export interface Trajet {
  id: number;
  ville_depart: string;
  ville_arrivee: string;
  date_depart: string;   // 💡 Aligné sur l'architecture Django
  heure_depart: string;  // 💡 Aligné sur l'architecture Django
  prix: number;          // 💡 Aligné sur l'architecture Django (remplace tarif)
  bus: number;
  bus_details?: Bus;     // 💡 Aligné sur l'architecture Django
  agence_nom?: string;
  places_disponibles: number;
}

export interface TrajetFiltres {
  ville_depart?: string;
  ville_arrivee?: string;
  date_depart?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TrajetService {
  private readonly apiUrl = `${environment.apiUrl}/trajets`;

  constructor(private readonly http: HttpClient) {}

  // Lister tous les trajets avec filtrage multicritères DjangoFilter
  getTrajets(filtres?: TrajetFiltres): Observable<Trajet[]> {
    let params = new HttpParams();
    if (filtres?.ville_depart) {
      params = params.set('ville_depart__iexact', filtres.ville_depart);
    }
    if (filtres?.ville_arrivee) {
      params = params.set('ville_arrivee__iexact', filtres.ville_arrivee);
    }
    if (filtres?.date_depart) {
      params = params.set('date_exacte', filtres.date_depart);
    }
    return this.http.get<Trajet[]>(`${this.apiUrl}/`, { params });
  }

  getTrajet(id: number): Observable<Trajet> {
    return this.http.get<Trajet>(`${this.apiUrl}/${id}/`);
  }

  createTrajet(data: Partial<Trajet>): Observable<Trajet> {
    return this.http.post<Trajet>(`${this.apiUrl}/`, data);
  }

  updateTrajet(id: number, data: Partial<Trajet>): Observable<Trajet> {
    return this.http.put<Trajet>(`${this.apiUrl}/${id}/`, data);
  }

  deleteTrajet(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }
}
