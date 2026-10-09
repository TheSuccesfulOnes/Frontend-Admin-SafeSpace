import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LoginPage } from "../src/pages/LoginPage";
import { API_URL } from "../src/services/api";
import { auth, change, deferred, formSubmit, response } from "./helpers";
function mount(
  data: unknown = { ...auth, display_name: auth.displayName },
  status = 200,
) {
  const fetcher = vi.fn().mockResolvedValue(response(data, status));
  vi.stubGlobal("fetch", fetcher);
  const onLogin = vi.fn();
  render(<LoginPage onLogin={onLogin} />);
  return { fetcher, onLogin };
}
function fill(identifier = " admin ", password = " TestPass123 ") {
  change("username", identifier);
  change("password", password);
}
describe("[integration] src/pages/LoginPage.tsx", () => {
  it.each(["admin", "admin@example.test"])(
    "stable login selectors submit identifier %s without depending on labels",
    async (identifier) => {
      const { fetcher, onLogin } = mount();
      const input = document.querySelector<HTMLInputElement>(
        "#admin-login-identifier",
      )!;
      const password = document.querySelector<HTMLInputElement>(
        "#admin-login-password",
      )!;
      const submitButton = document.querySelector<HTMLButtonElement>(
        "#admin-login-submit",
      )!;

      expect(input).toBe(screen.getByLabelText("username"));
      expect(password).toBe(screen.getByLabelText("password"));
      expect(input).toHaveAttribute("name", "identifier");
      expect(password).toHaveAttribute("name", "password");
      expect(input.form?.id).toBe("admin-login-form");
      expect(submitButton.form).toBe(input.form);
      expect(document.querySelectorAll("#admin-login-identifier")).toHaveLength(
        1,
      );
      fireEvent.change(input, { target: { value: ` ${identifier} ` } });
      fireEvent.change(password, { target: { value: " TestPass123 " } });
      fireEvent.click(submitButton);
      await act(async () => {});

      expect(onLogin).toHaveBeenCalledOnce();
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
        identifier,
        password: " TestPass123 ",
      });
    },
  );
  it("login selectors stay stable through password visibility, loading and failure", async () => {
    const { fetcher } = mount();
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    fill();
    const input = document.getElementById("admin-login-identifier")!;
    const password = document.getElementById("admin-login-password")!;
    const submitButton = document.getElementById("admin-login-submit")!;
    fireEvent.click(screen.getByRole("button", { name: "showPassword" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(submitButton);
    expect(document.getElementById("admin-login-form")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(submitButton).toBeDisabled();
    await act(async () =>
      pending.resolve(response({ message: "Invalid credentials" }, 400)),
    );
    expect(screen.getByRole("alert").id).toBe("admin-login-error");
    expect(document.getElementById("admin-login-identifier")).toBe(input);
    expect(document.getElementById("admin-login-password")).toBe(password);
    expect(document.getElementById("admin-login-submit")).toBe(submitButton);
    expect(document.getElementById("admin-login-form")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(submitButton).toBeEnabled();
  });
  it.each([
    "EMPLOYEE",
    "HR_MEMBER",
    "system_admin",
    "ADMIN",
    "",
    null,
    1,
    undefined,
  ])("rejects API role %j", async (role) => {
    const { onLogin } = mount({
      ...auth,
      display_name: auth.displayName,
      role,
    });
    fill();
    formSubmit();
    await screen.findByRole("alert");
    expect(onLogin).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });
  it("SYSTEM_ADMIN succeeds and maps display name", async () => {
    const { onLogin } = mount();
    fill();
    formSubmit();
    await act(async () => {});
    expect(onLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: auth.displayName,
        role: "SYSTEM_ADMIN",
      }),
    );
  });
  it("trims identifier but preserves password exactly", async () => {
    const { fetcher } = mount();
    fill();
    formSubmit();
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledWith(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "admin", password: " TestPass123 " }),
    });
  });
  it.each([401, 403, 429, 500])(
    "HTTP %i blocks login and hides server diagnostic",
    async (status) => {
      const { onLogin } = mount({ message: "Private diagnostic" }, status);
      fill();
      formSubmit();
      expect(await screen.findByRole("alert")).toHaveTextContent("loginFailed");
      expect(screen.queryByText("Private diagnostic")).toBeNull();
      expect(onLogin).not.toHaveBeenCalled();
    },
  );
  it("malformed JSON blocks login", async () => {
    const { fetcher, onLogin } = mount();
    fetcher.mockResolvedValue(new Response("not json"));
    fill();
    formSubmit();
    await screen.findByRole("alert");
    expect(onLogin).not.toHaveBeenCalled();
  });
  it("network rejection blocks login", async () => {
    const { fetcher, onLogin } = mount();
    fetcher.mockRejectedValue(new Error("Offline"));
    fill();
    formSubmit();
    await screen.findByRole("alert");
    expect(onLogin).not.toHaveBeenCalled();
  });
  it.each(["username", "password"])("empty %s is browser-invalid", (label) => {
    const { fetcher } = mount();
    expect(screen.getByLabelText(label)).toBeInvalid();
    fireEvent.click(screen.getByRole("button", { name: /^enterConsole/ }));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("pending request disables submitting until completion", async () => {
    const { fetcher } = mount();
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    fill();
    formSubmit();
    expect(screen.getByRole("button", { name: /^signingIn/ })).toBeDisabled();
    await act(async () =>
      pending.resolve(response({ ...auth, display_name: auth.displayName })),
    );
    expect(screen.getByRole("button", { name: /^enterConsole/ })).toBeEnabled();
  });
  it("retry clears previous failure and accepts administrator", async () => {
    const { fetcher, onLogin } = mount({}, 401);
    fill();
    formSubmit();
    await screen.findByRole("alert");
    fetcher.mockResolvedValue(
      response({ ...auth, display_name: auth.displayName }),
    );
    formSubmit();
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
