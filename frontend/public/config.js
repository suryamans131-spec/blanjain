// In local dev this file is empty on purpose - api.js falls back to
// VITE_API_URL (from .env) or http://localhost:4000/api.
// In production Docker containers, docker/entrypoint.sh overwrites this
// file at container startup with: window.__API_URL__ = "https://...";
