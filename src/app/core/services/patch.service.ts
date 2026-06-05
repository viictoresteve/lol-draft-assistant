import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class PatchService {
  private http = inject(HttpClient);

  private _version = signal<string>(environment.patchVersion);
  readonly version = this._version.asReadonly();

  constructor() {
    this.http
      .get<string[]>('https://ddragon.leagueoflegends.com/api/versions.json')
      .subscribe({
        next: (versions) => {
          if (versions && versions.length > 0) {
            this._version.set(versions[0]);
          }
        },
        error: () => {
          // Fall back silently to environment.patchVersion
        },
      });
  }
}
