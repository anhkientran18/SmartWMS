// Real API mode is the default. Only an explicit mock setting enables the demo.
export const isDemoMode = import.meta.env.VITE_DATA_MODE === 'mock';
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
