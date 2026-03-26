const isDevelopment = window.location.hostname === 'localhost';

export const API_BASE_URL = isDevelopment 
    ? "http://localhost:8000" 
    : "https://your-backend-name.onrender.com"; // To be added when deployed

export const WS_BASE_URL = isDevelopment
    ? "ws://localhost:8000"
    : "wss://your-backend-name.onrender.com"; // To be added when deployed

export const SYSTEM_VERSION = 'v0.0.1-beta'