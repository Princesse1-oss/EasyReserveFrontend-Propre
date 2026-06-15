import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaiementRequest {
  reservation: number;          // ID de la réservation concernée
  montant: number;              // Montant exact du trajet
  methode: 'orange_money' | 'mtn_money' | 'carte_bancaire';
  transaction_id: string;       // ID unique généré par l'opérateur mobile ou la carte
  telephone_paiement?: string;  // Optionnel, requis uniquement pour Orange/MTN Money
}

export interface PaiementResponse {
  id: number;
  reservation: number;
  montant: number;
  methode: 'orange_money' | 'mtn_money' | 'carte_bancaire';
  statut: 'en_attente' | 'valide' | 'echoue';
  transaction_id: string;
  telephone_paiement?: string;
  client_username: string;
  trajet_info: string;
  date_paiement: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaiementService {
  private readonly apiUrl = `${environment.apiUrl}/paiements`;

  constructor(private readonly http: HttpClient) {}

  // 1. Initialiser ou déclarer un paiement (effectué par le Client)
  creerPaiement(data: PaiementRequest): Observable<PaiementResponse> {
    return this.http.post<PaiementResponse>(`${this.apiUrl}/`, data);
  }

  // 2. Historique des paiements (Client voit les siens, Gérant/Admin voient tout)
  getPaiements(): Observable<PaiementResponse[]> {
    return this.http.get<PaiementResponse[]>(`${this.apiUrl}/`);
  }

  // 3. Récupérer un paiement spécifique par son ID
  getPaiement(id: number): Observable<PaiementResponse> {
    return this.http.get<PaiementResponse>(`${this.apiUrl}/${id}/`);
  }

  // 4. Valider ou Refuser un paiement (Réservé aux Gestionnaires d'agences et Admins)
  validerPaiement(id: number, statut: 'valide' | 'echoue'): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.apiUrl}/${id}/valider_paiement/`, { statut });
  }
}
