const DEFAULT_API_URL = "https://safespace-backend-q3uv.onrender.com";

/**
 * Uses Render in deployed builds while keeping local overrides available for
 * development through VITE_API_URL. Removing a trailing slash prevents
 * accidental double slashes in the endpoint URLs.
 */
export const API_URL = (
  import.meta.env.VITE_API_URL || DEFAULT_API_URL
).replace(/\/+$/, "");
