import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SettingsService } from '@core/services/settings.service';

export const groqInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('api.groq.com')) return next(req);
  const key = inject(SettingsService).apiKey();
  if (!key) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${key}` } }));
};
