import { TestBed } from '@angular/core/testing';

import { ChampionPool } from './champion-pool';

describe('ChampionPool', () => {
  let service: ChampionPool;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChampionPool);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
