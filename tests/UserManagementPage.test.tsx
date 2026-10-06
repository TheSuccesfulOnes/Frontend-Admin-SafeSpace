import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UserManagementPage } from "../src/pages/UserManagementPage";
import type { User, Role } from "../src/types/domain";
import { API_URL } from "../src/services/api";
import {
  apiUser,
  backend,
  cancel,
  change,
  click,
  confirm,
  contract,
  formSubmit,
  response,
  settled,
  token,
  user,
  writes,
} from "./helpers";

function mount(
  users: User[] = [user],
  role: Role = "EMPLOYEE",
  currentUsername = "admin",
) {
  const fetcher = backend("/users", [], apiUser);
  const refresh = () =>
    fetch(`${API_URL}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => {});
  render(
    <UserManagementPage
      token={token}
      users={users}
      role={role}
      loading={false}
      currentUsername={currentUsername}
      onRefresh={refresh}
    />,
  );
  return fetcher;
}
function fill() {
  change("displayName", "Test Name");
  change("username", "new.user");
  change("email", "new@example.test");
  change("temporaryPassword", "TestPass123");
}
function password(value: string, confirmation = value) {
  click("resetPassword");
  change("newPassword", value);
  change("confirmPassword", confirmation);
  formSubmit();
}
describe("[integration] src/pages/UserManagementPage.tsx", () => {
  it.each(["displayName", "username", "email", "temporaryPassword"])(
    "requires create %s",
    (label) => {
      mount();
      click("＋ createAccount");
      expect(screen.getByLabelText(label)).toBeInvalid();
      expect(writes()).toHaveLength(0);
    },
  );
  it("invalid email fails browser validation", () => {
    mount();
    click("＋ createAccount");
    fill();
    change("email", "bad-email");
    expect(screen.getByLabelText("email")).toBeInvalid();
  });
  it.each(["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"] as const)(
    "create binds %s role to confirmed request",
    async (role) => {
      mount([], role);
      click("＋ createAccount");
      fill();
      formSubmit();
      expect(writes()).toHaveLength(0);
      confirm();
      await settled();
      contract("/admin/users", "POST", {
        display_name: "Test Name",
        username: "new.user",
        email: "new@example.test",
        password: "TestPass123",
        role,
      });
    },
  );
  it("cancel create keeps draft", () => {
    mount();
    click("＋ createAccount");
    fill();
    formSubmit();
    cancel();
    expect(writes()).toHaveLength(0);
    expect(screen.getByLabelText("username")).toHaveValue("new.user");
  });
  it("edit sends selected role without password", async () => {
    mount();
    click("edit");
    change("role", "HR_MEMBER");
    formSubmit();
    confirm();
    await settled();
    contract("/admin/users/7", "PATCH", {
      display_name: user.displayName,
      username: user.username,
      email: user.email,
      role: "HR_MEMBER",
    });
  });
  it.each(["", "1234567"])("rejects short reset password %j", (value) => {
    mount();
    password(value);
    expect(screen.getByText("passwordTooShort")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes()).toHaveLength(0);
  });
  it("rejects reset password mismatch", () => {
    mount();
    password("12345678", "87654321");
    expect(screen.getByText("passwordMismatch")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
  it("accepts exactly eight characters after confirmation", async () => {
    mount();
    password("12345678");
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract("/admin/users/7/password", "POST", { new_password: "12345678" });
  });
  it("cancel reset does not change password", () => {
    mount();
    password("12345678");
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it.each([true, false])(
    "enabled=%s chooses opposite status",
    async (enabled) => {
      mount([{ ...user, enabled }]);
      click(enabled ? "disableAccount" : "enableAccount");
      confirm();
      await settled();
      contract(`/admin/users/7/${enabled ? "disable" : "enable"}`, "PATCH");
    },
  );
  it("deletion occurs after confirmation", async () => {
    mount();
    click("deleteAccount");
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract("/admin/users/7", "DELETE");
  });
  it("cancel deletion keeps account untouched", () => {
    mount();
    click("deleteAccount");
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it.each(["edit", "resetPassword", "disableAccount", "deleteAccount"])(
    "protects another system owner from %s",
    (action) => {
      mount(
        [{ ...user, role: "SYSTEM_ADMIN", systemOwner: true }],
        "SYSTEM_ADMIN",
      );
      const button = screen.getByRole("button", { name: action });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(writes()).toHaveLength(0);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );
  it("current account cannot disable or delete itself", () => {
    mount([user], "EMPLOYEE", user.username);
    expect(
      screen.getByRole("button", { name: "disableAccount" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "deleteAccount" }),
    ).toBeDisabled();
  });
  it("owner may edit its own account", () => {
    mount(
      [{ ...user, systemOwner: true, role: "SYSTEM_ADMIN" }],
      "SYSTEM_ADMIN",
      user.username,
    );
    click("edit");
    expect(screen.getByLabelText("username")).toHaveValue(user.username);
  });
  it.each([
    ["Username is already in use", "usernameAlreadyUsed"],
    ["Email is already in use", "emailAlreadyUsed"],
    ["Internal diagnostic", "createAccountFailed"],
  ])("maps server create failure %s safely", async (message, expected) => {
    const fetcher = mount();
    click("＋ createAccount");
    fill();
    formSubmit();
    fetcher.mockResolvedValueOnce(response({ message }, 409));
    confirm();
    await settled();
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByLabelText("username")).toHaveValue("new.user");
  });
  it("role filtering prevents cross-role mutation", () => {
    mount([{ ...user, role: "HR_MEMBER" }]);
    expect(screen.queryByRole("button", { name: "deleteAccount" })).toBeNull();
    expect(writes()).toHaveLength(0);
  });
  it("search normalizes whitespace and case within selected role", () => {
    mount([user, { ...user, id: 8, username: "other" }]);
    change("searchByUsername", " EMPLOYEE ");
    expect(
      within(screen.getByRole("table")).getByText("@employee"),
    ).toBeInTheDocument();
    expect(screen.queryByText("@other")).toBeNull();
  });
});
