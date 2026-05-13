import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChampionSearch } from './champion-search';

describe('ChampionSearch', () => {
  let component: ChampionSearch;
  let fixture: ComponentFixture<ChampionSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionSearch]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChampionSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
