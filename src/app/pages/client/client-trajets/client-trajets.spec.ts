import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientTrajets } from './client-trajets';

describe('ClientTrajets', () => {
  let component: ClientTrajets;
  let fixture: ComponentFixture<ClientTrajets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientTrajets],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientTrajets);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
