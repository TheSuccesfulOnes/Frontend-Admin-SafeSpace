import type { AuthResponse, Role } from "../types/domain";

const ADMIN_SESSION_KEY = "employee-wellbeing.admin-session";
const validRoles: Role[] = ["SYSTEM_ADMIN"];

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== "object") return false;

  const session = value as Partial<AuthResponse>;
  return (
    typeof session.token === "string" &&
    typeof session.username === "string" &&
    typeof session.displayName === "string" &&
    typeof session.role === "string" &&
    validRoles.includes(session.role as Role)
  );
}

export function readAdminSession(): AuthResponse | null {
  try {
    const storedSession = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!storedSession) return null;

    const parsedSession: unknown = JSON.parse(storedSession);
    if (!isAuthResponse(parsedSession)) {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }

    return parsedSession;
  } catch {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function saveAdminSession(session: AuthResponse) {
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
