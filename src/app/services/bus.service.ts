import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Bus } from './trajet.service';

export interface CreateBusRequest {
  matricule: string;
  capacite: number;
  type_bus: 'standard' | 'vip' | 'minibus';
  agence?: number; // Utile pour l'admin lors d'une création
}

@Injectable({
  providedIn: 'root',
})
export class BusService {
  // 💡 URL ajustée avec le slash final requis par Django
  private readonly apiUrl = `${environment.apiUrl}/bus`;

  constructor(private readonly http: HttpClient) {}

  getBus(): Observable<Bus[]> {
    return this.http.get<Bus[]>(`${this.apiUrl}/`);
  }

  getOneBus(id: number): Observable<Bus> {
    return this.http.get<Bus>(`${this.apiUrl}/${id}/`);
  }

  createBus(data: CreateBusRequest): Observable<Bus> {
    return this.http.post<Bus>(`${this.apiUrl}/`, data);
  }

  updateBus(id: number, data: Partial<CreateBusRequest>): Observable<Bus> {
    return this.http.put<Bus>(`${this.apiUrl}/${id}/`, data);
  }

  deleteBus(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }
}
