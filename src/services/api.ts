import { API_URL } from "../config/env";

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    T | ApiErrorPayload | null;
  if (!response.ok) {
    const payload = data as ApiErrorPayload | null;
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : "API_REQUEST_FAILED";
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    throw new ApiError(message, response.status, code);
  }
  return data as T;
}

export { API_URL };
