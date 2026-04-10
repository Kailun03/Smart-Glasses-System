const isDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

const defaultApiBaseUrl = isDevelopment
    ? 'http://localhost:8000'
    : 'https://your-backend-name.onrender.com';

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || defaultApiBaseUrl;

const derivedWsUrl = API_BASE_URL
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://');

export const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || derivedWsUrl;

export const SYSTEM_VERSION = 'v0.0.1-beta'