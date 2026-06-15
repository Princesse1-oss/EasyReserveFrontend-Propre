import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Chauffeur {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  numero_permis: string;
  statut: 'actif' | 'inactif' | 'conge';
  statut_display?: string;
  bus_assigne: number | null;
  bus_matricule?: string;
  date_embauche: string | null;
  date_creation?: string;
}

export interface CreateChauffeurRequest {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  numero_permis: string;
  statut: 'actif' | 'inactif' | 'conge';
  bus_assigne?: number | null;
  date_embauche?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChauffeurService {
  private readonly apiUrl = `${environment.apiUrl}/chauffeurs`;

  constructor(private http: HttpClient) {}

  getChauffeurs(): Observable<Chauffeur[]> {
    return this.http.get<Chauffeur[]>(`${this.apiUrl}/`);
  }

  getChauffeur(id: number): Observable<Chauffeur> {
    return this.http.get<Chauffeur>(`${this.apiUrl}/${id}/`);
  }

  createChauffeur(data: CreateChauffeurRequest): Observable<Chauffeur> {
    return this.http.post<Chauffeur>(`${this.apiUrl}/`, data);
  }

  updateChauffeur(id: number, data: Partial<CreateChauffeurRequest>): Observable<Chauffeur> {
    return this.http.patch<Chauffeur>(`${this.apiUrl}/${id}/`, data);
  }

  deleteChauffeur(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }
}
