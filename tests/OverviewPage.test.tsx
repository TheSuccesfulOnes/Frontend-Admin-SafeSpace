import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OverviewPage } from "../src/pages/OverviewPage";
import type { User, Role } from "../src/types/domain";
import {
  apiUser,
  backend,
  cancel,
  click,
  confirm,
  contract,
  deferred,
  response,
  settled,
  token,
  user,
  writes,
} from "./helpers";
function mount(
  users: User[] = [{ ...user, enabled: false }],
  currentUsername = "admin",
  loading = false,
) {
  const fetcher = backend("/users", [], apiUser),
    refresh = vi.fn(),
    employees = vi.fn(),
    hr = vi.fn();
  const view = render(
    <OverviewPage
      token={token}
      users={users}
      currentUsername={currentUsername}
      loading={loading}
      onRefresh={refresh}
      onEmployees={employees}
      onHr={hr}
    />,
  );
  return { fetcher, refresh, employees, hr, ...view };
}
describe("[integration] src/pages/OverviewPage.tsx", () => {
  it.each(["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"] as Role[])(
    "confirmed enable for %s",
    async (role) => {
      const { refresh } = mount([{ ...user, role, enabled: false }]);
      click("enableAccount");
      expect(writes()).toHaveLength(0);
      confirm();
      await settled();
      contract("/admin/users/7/enable", "PATCH");
      expect(refresh).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"] as Role[])(
    "enabled %s has no enable operation",
    (role) => {
      mount([{ ...user, role }]);
      expect(
        screen.queryByRole("button", { name: "enableAccount" }),
      ).toBeNull();
      expect(writes()).toHaveLength(0);
    },
  );
  it.each(["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"] as Role[])(
    "foreign owner %s is protected",
    (role) => {
      mount([{ ...user, role, systemOwner: true, enabled: false }]);
      const button = screen.getByRole("button", { name: "enableAccount" });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(writes()).toHaveLength(0);
    },
  );
  it("current owner can re-enable itself", async () => {
    mount([{ ...user, systemOwner: true, enabled: false }], user.username);
    click("enableAccount");
    confirm();
    await settled();
    contract("/admin/users/7/enable", "PATCH");
  });
  it("cancel prevents enable and refresh", () => {
    const { refresh } = mount();
    click("enableAccount");
    cancel();
    expect(writes()).toHaveLength(0);
    expect(refresh).not.toHaveBeenCalled();
  });
  it("Escape cancels pending operation", () => {
    mount();
    click("enableAccount");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(writes()).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it.each([401, 403, 409, 500])(
    "HTTP %i preserves disabled account without refresh",
    async (status) => {
      const { fetcher, refresh } = mount();
      click("enableAccount");
      fetcher.mockResolvedValueOnce(response({}, status));
      confirm();
      await settled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "accountStatusFailed",
      );
      expect(refresh).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "enableAccount" }),
      ).toBeEnabled();
    },
  );
  it("busy blocks duplicate operations across rows", async () => {
    const { fetcher } = mount([
      { ...user, enabled: false },
      { ...user, id: 8, username: "other", enabled: false },
    ]);
    const pending = deferred<Response>();
    fireEvent.click(
      screen.getAllByRole("button", { name: "enableAccount" })[0],
    );
    fetcher.mockReturnValueOnce(pending.promise);
    confirm();
    screen
      .getAllByRole("button", { name: "enableAccount" })
      .forEach((b) => expect(b).toBeDisabled());
    await act(async () => pending.resolve(response(apiUser)));
    await settled();
    expect(writes()).toHaveLength(1);
  });
  it("loading prevents actions on unhydrated account data", () => {
    mount([{ ...user, enabled: false }], "admin", true);
    expect(screen.queryByRole("button", { name: "enableAccount" })).toBeNull();
  });
  it("empty account list has no enable target", () => {
    mount([]);
    expect(screen.queryByRole("button", { name: "enableAccount" })).toBeNull();
  });
  it("refresh failure reports failure and releases busy state", async () => {
    const { refresh } = mount();
    refresh.mockRejectedValueOnce(new Error("Offline"));
    click("enableAccount");
    confirm();
    await settled();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "accountStatusFailed",
      ),
    );
    expect(screen.getByRole("button", { name: "enableAccount" })).toBeEnabled();
  });
});
