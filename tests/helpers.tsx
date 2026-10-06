import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, vi } from "vitest";
import { API_URL } from "../src/services/api";

export const token = "test-session-token";
export const auth = {
  token,
  username: "admin",
  displayName: "Test Admin",
  role: "SYSTEM_ADMIN" as const,
};
export const user = {
  id: 7,
  username: "employee",
  displayName: "Test Employee",
  email: "employee@example.test",
  role: "EMPLOYEE" as const,
  enabled: true,
  systemOwner: false,
};
export const apiUser = {
  ...user,
  display_name: user.displayName,
  system_owner: false,
};
export const activity = {
  id: 7,
  title: "Activity fixture",
  description: "Description",
  status: "OPEN",
  options: [
    { id: 1, label: "First", votes: 0, percentage: 0 },
    { id: 2, label: "Second", votes: 0, percentage: 0 },
  ],
  created_by: "admin",
  created_at: "2026-01-01",
};
export const survey = {
  id: 7,
  title: "Survey fixture",
  question: "How are you?",
  type: "DAILY",
  status: "DRAFT",
  allow_comments: true,
  answers: 0,
  created_by: "admin",
  created_at: "2026-01-01",
};
export const report = {
  id: 7,
  title: "Report fixture",
  category: "Safety",
  description: "Private report",
  priority: "HIGH",
  status: "NEW",
  anonymous: true,
};
export const plans = [
  { code: "MONTHLY", duration_months: 1 },
  { code: "ANNUAL", duration_months: 12 },
];
export const payment = {
  id: 7,
  user_id: null,
  beneficiary_name: "Test Name",
  plan: "MONTHLY",
  next_payment_date: "2026-11-05",
  voucher_filename: "receipt.pdf",
  voucher_size: 4,
  created_at: "2026-10-05",
};
export function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export function backend(
  collection: string,
  data: unknown[],
  mutation: unknown,
) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.headers).toEqual(
      expect.objectContaining({ Authorization: `Bearer ${token}` }),
    );
    expect(url.startsWith(`${API_URL}/api/v1/`)).toBe(true);
    const method = init?.method ?? "GET";
    const root =
      collection === "/plans"
        ? "/admin/payments/plans"
        : collection === "/reports"
          ? "/reports"
          : `/admin${collection}`;
    const path = url.slice(`${API_URL}/api/v1`.length);
    if (method === "GET" && path === root) return response(data);
    if (
      method === "GET" &&
      /^\/surveys\/\d+\/comments$/.test(path) &&
      collection === "/surveys"
    )
      return response([]);
    const escapedRoot = root.replaceAll("/", "\\/");
    const id = `${escapedRoot}/[1-9]\\d*`;
    const allowed =
      collection === "/activities"
        ? {
            POST: `^${escapedRoot}$`,
            PUT: `^${id}$`,
            DELETE: `^${id}$`,
            PATCH: `^${id}/(open|close)$`,
          }
        : collection === "/surveys"
          ? {
              POST: `^(${escapedRoot}|${id}/(publish|close|reopen))$`,
              PUT: `^${id}$`,
              DELETE: `^${id}$`,
            }
          : collection === "/reports"
            ? { PATCH: `^${id}/status$` }
            : collection === "/users"
              ? {
                  POST: `^(${escapedRoot}|${id}/password)$`,
                  PATCH: `^${id}(/(enable|disable))?$`,
                  DELETE: `^${id}$`,
                }
              : { POST: "^/admin/payments$" };
    const rule = allowed[method as keyof typeof allowed] as string | undefined;
    if (rule && new RegExp(rule).test(path)) return response(mutation);
    throw new Error("Unexpected mocked endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
export function change(label: string, value: string) {
  fireEvent.change(
    screen.getByLabelText(label, { selector: "input,textarea,select" }),
    { target: { value } },
  );
}
export function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
export function formSubmit() {
  fireEvent.submit(document.querySelector("form")!);
}
export function writes() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
}
export function body(index = 0) {
  return JSON.parse(String(writes()[index][1]?.body));
}
export function contract(
  path: string,
  method: string,
  payload?: unknown,
  index = 0,
) {
  const [url, init] = writes()[index];
  expect(url).toBe(`${API_URL}/api/v1${path}`);
  expect(init?.method).toBe(method);
  expect(init?.headers).toEqual(
    payload === undefined
      ? { Authorization: `Bearer ${token}` }
      : {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
  );
  if (payload === undefined) expect(init?.body).toBeUndefined();
  else expect(JSON.parse(String(init?.body))).toEqual(payload);
}
export function confirm() {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "confirmAction",
    }),
  );
}
export function cancel() {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "cancel" }),
  );
}
export async function settled() {
  await waitFor(() => expectNoDialog());
}
function expectNoDialog() {
  if (screen.queryByRole("dialog")) throw new Error("Dialog still open");
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
