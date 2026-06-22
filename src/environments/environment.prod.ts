export const environment = {
  production: true,
  groqApiKey: '', // set via Settings UI (stored in localStorage)
  patchVersion: '16.11.1', // auto-detected at runtime by PatchService
  // Set to your deployed proxy URL, e.g. https://lol-draft-proxy.railway.app
  proxyUrl: '',
  // Add your Sentry DSN from sentry.io to enable error tracking in production
  sentryDsn: '',
};
