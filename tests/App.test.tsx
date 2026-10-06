import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { App } from "../src/app/App";
import { API_URL } from "../src/services/api";
import {
  auth,
  apiUser,
  change,
  click,
  formSubmit,
  response,
  token,
} from "./helpers";
const key = "employee-wellbeing.admin-session";
function mount(status = 200, stored: unknown = auth) {
  if (stored !== undefined) sessionStorage.setItem(key, JSON.stringify(stored));
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === `${API_URL}/api/v1/auth/login` && init?.method === "POST")
      return response({ ...auth, display_name: auth.displayName });
    expect(url).toBe(`${API_URL}/api/v1/admin/users`);
    expect(init).toEqual({ headers: { Authorization: `Bearer ${token}` } });
    return response(status === 200 ? [apiUser] : {}, status);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  return fetcher;
}
describe("[integration] src/app/App.tsx", () => {
  it("missing session performs no protected fetch", () => {
    const fetcher = mount(200, null);
    expect(
      screen.getByRole("button", { name: /^enterConsole/ }),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["EMPLOYEE", "HR_MEMBER", "system_admin", "ADMIN"])(
    "stored %s role cannot enter console",
    (role) => {
      const fetcher = mount(200, { ...auth, role });
      expect(fetcher).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(key)).toBeNull();
      expect(screen.queryByRole("navigation")).toBeNull();
    },
  );
  it.each([
    null,
    { ...auth, token: null },
    { ...auth, username: 1 },
    { ...auth, displayName: null },
  ])("invalid stored shape %j is removed without protected fetch", (stored) => {
    const fetcher = mount(200, stored);
    expect(fetcher).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it("valid restored session hydrates protected users", async () => {
    const fetcher = mount();
    await screen.findByText("apiConnected");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(key)).not.toBeNull();
  });
  it.each([401, 403])(
    "HTTP %i revokes session and returns login",
    async (status) => {
      mount(status);
      await screen.findByRole("button", { name: /^enterConsole/ });
      expect(sessionStorage.getItem(key)).toBeNull();
      expect(screen.queryByRole("navigation")).toBeNull();
    },
  );
  it.each([400, 404, 429, 500, 503])(
    "HTTP %i retains session and exposes retry",
    async (status) => {
      mount(status);
      await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
      expect(sessionStorage.getItem(key)).not.toBeNull();
    },
  );
  it("logout clears session and returns login", async () => {
    mount();
    await screen.findByText("apiConnected");
    click("signOut");
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(
      screen.getByRole("button", { name: /^enterConsole/ }),
    ).toBeInTheDocument();
  });
  it("login persists only after authenticated SYSTEM_ADMIN result", async () => {
    mount(200, null);
    change("username", "admin");
    change("password", "Password123");
    formSubmit();
    await screen.findByText("apiConnected");
    expect(JSON.parse(sessionStorage.getItem(key)!)).toMatchObject(auth);
  });
  it("retry recovers connection without changing session", async () => {
    const fetcher = mount(503);
    await screen.findByRole("alert");
    fetcher.mockResolvedValueOnce(response([apiUser]));
    click("retry");
    await screen.findByText("apiConnected");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sessionStorage.getItem(key)).not.toBeNull();
  });
  it("retry unauthorized response clears earlier session", async () => {
    const fetcher = mount(503);
    await screen.findByRole("alert");
    fetcher.mockResolvedValueOnce(response({}, 401));
    click("retry");
    await screen.findByRole("button", { name: /^enterConsole/ });
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it("logout resets page before subsequent login", async () => {
    mount();
    await screen.findByText("apiConnected");
    fireEvent.click(screen.getByRole("button", { name: /^employees/ }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "employees",
    );
    click("signOut");
    change("username", "admin");
    change("password", "Password123");
    formSubmit();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "overview",
      ),
    );
  });
});
