import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { App } from "../src/app/App";
import { API_URL } from "../src/services/api";
import {
  readAdminSession,
  saveAdminSession,
} from "../src/services/sessionStorage";
import {
  auth,
  apiUser,
  change,
  click,
  formSubmit,
  response,
  token,
} from "./helpers";
function localServer() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API_URL}/api/v1/auth/login`) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          identifier: "admin",
          password: "Password123",
        });
        return response({ ...auth, display_name: auth.displayName });
      }
      expect(url).toBe(`${API_URL}/api/v1/admin/users`);
      expect(init?.headers).toEqual({ Authorization: `Bearer ${token}` });
      return response([apiUser]);
    }),
  );
}
describe("[integration] src/services/sessionStorage.ts", () => {
  it("local login persists a readable admin session and logout clears it", async () => {
    localServer();
    render(<App />);
    change("username", "admin");
    change("password", "Password123");
    formSubmit();
    await screen.findByText("apiConnected");
    expect(readAdminSession()).toMatchObject(auth);
    click("signOut");
    expect(readAdminSession()).toBeNull();
  });
  it("restored session is revoked when protected API returns forbidden", async () => {
    saveAdminSession(auth);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 403)));
    render(<App />);
    await screen.findByRole("button", { name: /^enterConsole/ });
    expect(readAdminSession()).toBeNull();
  });
});
