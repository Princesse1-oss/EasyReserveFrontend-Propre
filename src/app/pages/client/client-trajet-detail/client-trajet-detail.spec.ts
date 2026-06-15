import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientTrajetDetail } from './client-trajet-detail';

describe('ClientTrajetDetail', () => {
  let component: ClientTrajetDetail;
  let fixture: ComponentFixture<ClientTrajetDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientTrajetDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientTrajetDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
