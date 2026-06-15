import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GestionnaireActivitesComponent } from './gestionnaire-activites';

describe('GestionnaireActivites', () => {
  let component: GestionnaireActivitesComponent;
  let fixture: ComponentFixture<GestionnaireActivitesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionnaireActivitesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionnaireActivitesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
