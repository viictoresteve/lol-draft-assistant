import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoolSelector } from './pool-selector';

describe('PoolSelector', () => {
  let component: PoolSelector;
  let fixture: ComponentFixture<PoolSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoolSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
