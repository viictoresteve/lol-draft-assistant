import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoolDisplay } from './pool-display';

describe('PoolDisplay', () => {
  let component: PoolDisplay;
  let fixture: ComponentFixture<PoolDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolDisplay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoolDisplay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
