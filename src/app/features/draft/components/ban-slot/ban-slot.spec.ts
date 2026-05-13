import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanSlot } from './ban-slot';

describe('BanSlot', () => {
  let component: BanSlot;
  let fixture: ComponentFixture<BanSlot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanSlot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanSlot);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
