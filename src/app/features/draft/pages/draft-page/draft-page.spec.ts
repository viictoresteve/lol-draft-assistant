import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftPage } from './draft-page';

describe('DraftPage', () => {
  let component: DraftPage;
  let fixture: ComponentFixture<DraftPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DraftPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
