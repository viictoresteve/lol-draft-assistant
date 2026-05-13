import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PickSlot } from './pick-slot';

describe('PickSlot', () => {
  let component: PickSlot;
  let fixture: ComponentFixture<PickSlot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PickSlot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PickSlot);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
