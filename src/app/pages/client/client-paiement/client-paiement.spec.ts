import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientPaiement } from './client-paiement';

describe('ClientPaiement', () => {
  let component: ClientPaiement;
  let fixture: ComponentFixture<ClientPaiement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientPaiement],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientPaiement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
