import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuggestionsPanel } from './suggestions-panel';

describe('SuggestionsPanel', () => {
  let component: SuggestionsPanel;
  let fixture: ComponentFixture<SuggestionsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuggestionsPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuggestionsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
