import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trajets } from './trajets';

describe('Trajets', () => {
  let component: Trajets;
  let fixture: ComponentFixture<Trajets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trajets],
    }).compileComponents();

    fixture = TestBed.createComponent(Trajets);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
