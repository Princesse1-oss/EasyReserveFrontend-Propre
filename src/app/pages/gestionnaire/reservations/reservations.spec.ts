import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';

// ✅ IMPORTER LE BON NOM DE COMPOSANT (vérifie dans reservations.ts)
import { GestionnaireReservations } from './reservations'; // ← Nom réel du composant

describe('GestionnaireReservations', () => {
  let component: GestionnaireReservations;
  let fixture: ComponentFixture<GestionnaireReservations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GestionnaireReservations,  // ✅ Composant standalone
        ReactiveFormsModule,
       
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionnaireReservations);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ✅ Déclenche la détection de changements
  });

  it('should create', () => {
    expect(component).toBeTruthy();  // ✅ Syntaxe corrigée
  });
});