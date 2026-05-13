import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChampionPoolPage } from './champion-pool-page';

describe('ChampionPoolPage', () => {
  let component: ChampionPoolPage;
  let fixture: ComponentFixture<ChampionPoolPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionPoolPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChampionPoolPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
