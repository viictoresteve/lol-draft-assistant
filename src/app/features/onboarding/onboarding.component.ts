import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  show = signal(!localStorage.getItem('lol-draft-onboarded'));

  dismiss() {
    localStorage.setItem('lol-draft-onboarded', '1');
    this.show.set(false);
  }
}
