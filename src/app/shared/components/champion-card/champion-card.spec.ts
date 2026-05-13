import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChampionCard } from './champion-card';

describe('ChampionCard', () => {
  let component: ChampionCard;
  let fixture: ComponentFixture<ChampionCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChampionCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
