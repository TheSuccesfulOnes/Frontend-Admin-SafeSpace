import { describe, expect, it, vi } from "vitest";
import {
  clearAdminSession,
  readAdminSession,
  saveAdminSession,
} from "../src/services/sessionStorage";
import { auth } from "./helpers";
const key = "employee-wellbeing.admin-session";
describe("[unit] src/services/sessionStorage.ts", () => {
  it("missing session is anonymous", () =>
    expect(readAdminSession()).toBeNull());
  it.each([
    ["null", null],
    ["number", 42],
    ["string", "admin"],
    ["boolean", true],
    ["array", []],
    ["missing token", { ...auth, token: undefined }],
    ["numeric token", { ...auth, token: 1 }],
    ["missing username", { ...auth, username: undefined }],
    ["null username", { ...auth, username: null }],
    ["missing display name", { ...auth, displayName: undefined }],
    ["object display name", { ...auth, displayName: {} }],
    ["missing role", { ...auth, role: undefined }],
    ["numeric role", { ...auth, role: 1 }],
    ["employee", { ...auth, role: "EMPLOYEE" }],
    ["HR", { ...auth, role: "HR_MEMBER" }],
    ["lowercase role", { ...auth, role: "system_admin" }],
    ["unknown role", { ...auth, role: "SUPER_ADMIN" }],
  ])("rejects and removes %s", (_name, data) => {
    sessionStorage.setItem(key, JSON.stringify(data));
    expect(readAdminSession()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it("malformed JSON is removed", () => {
    sessionStorage.setItem(key, "{");
    expect(readAdminSession()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it("valid administrator is restored", () => {
    saveAdminSession(auth);
    expect(readAdminSession()).toEqual(auth);
  });
  it("extra fields do not remove a valid session", () => {
    saveAdminSession({ ...auth, extra: true } as typeof auth);
    expect(readAdminSession()).toMatchObject(auth);
  });
  it("saving replaces previous session", () => {
    saveAdminSession(auth);
    saveAdminSession({ ...auth, username: "second" });
    expect(readAdminSession()?.username).toBe("second");
  });
  it("logout removes only administrator session", () => {
    sessionStorage.setItem("unrelated", "keep");
    saveAdminSession(auth);
    clearAdminSession();
    expect(readAdminSession()).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
  });
  it("logout is idempotent", () => {
    clearAdminSession();
    clearAdminSession();
    expect(readAdminSession()).toBeNull();
  });
  it("storage read failure returns anonymous", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    expect(readAdminSession()).toBeNull();
  });
  it("storage read and removal failure still returns anonymous", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    expect(readAdminSession()).toBeNull();
  });
});
