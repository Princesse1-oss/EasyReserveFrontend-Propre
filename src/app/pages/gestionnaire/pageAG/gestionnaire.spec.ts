import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Gestionnaire } from './gestionnaire';

describe('Gestionnaire', () => {
  let component: Gestionnaire;
  let fixture: ComponentFixture<Gestionnaire>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Gestionnaire],
    }).compileComponents();

    fixture = TestBed.createComponent(Gestionnaire);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
