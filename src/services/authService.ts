import type { AuthResponse, Role } from "../types/domain";
import { API_URL, parseApiResponse } from "./api";

type ApiAuthResponse = Omit<AuthResponse, "displayName"> & {
  display_name: string;
};

export async function login(
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await parseApiResponse<ApiAuthResponse>(response);
  return {
    ...data,
    displayName: data.display_name,
    role: data.role as Role,
  };
}
