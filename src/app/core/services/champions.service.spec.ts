import { ChampionsService } from './champions.service';
import { TestBed } from '@angular/core/testing';

describe('ChampionsService', () => {
  let service: ChampionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChampionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
