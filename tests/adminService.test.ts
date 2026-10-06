import { describe, expect, it, vi } from "vitest";
import * as service from "../src/services/adminService";
import { API_URL } from "../src/services/api";
import type { Role } from "../src/types/domain";
import { activity, apiUser, payment, response, survey, token } from "./helpers";

describe("[unit] src/services/adminService.ts", () => {
  it.each([
    ["SYSTEM_ADMIN", true],
    ["EMPLOYEE", false],
    ["HR_MEMBER", false],
    ["system_admin", false],
    ["", false],
    ["ADMIN", false],
  ])("administrator guard %s -> %s", (role, allowed) =>
    expect(service.isSystemAdmin(role as Role)).toBe(allowed),
  );
});
describe("[integration] src/services/adminService.ts", () => {
  const userInput = {
    username: "user",
    email: "user@example.test",
    displayName: "Name",
    password: "Password123",
    role: "EMPLOYEE" as const,
  };
  const surveyInput = {
    title: "Title",
    question: "Question",
    type: "WEEKLY" as const,
    allowComments: false,
  };
  const activityInput = {
    title: "Title",
    description: "Description",
    options: ["One", "Two"],
  };
  const cases = [
    {
      name: "create user snake case contract",
      run: () => service.createUser(token, userInput),
      path: "/admin/users",
      method: "POST",
      body: {
        username: "user",
        email: "user@example.test",
        display_name: "Name",
        password: "Password123",
        role: "EMPLOYEE",
      },
      data: apiUser,
    },
    {
      name: "update only supplied fields",
      run: () => service.updateUser(token, 7, { email: "new@example.test" }),
      path: "/admin/users/7",
      method: "PATCH",
      body: { email: "new@example.test" },
      data: apiUser,
    },
    {
      name: "update explicit blank display name is not omitted",
      run: () => service.updateUser(token, 7, { displayName: "" }),
      path: "/admin/users/7",
      method: "PATCH",
      body: { display_name: "" },
      data: apiUser,
    },
    {
      name: "enable account",
      run: () => service.setUserEnabled(token, 7, true),
      path: "/admin/users/7/enable",
      method: "PATCH",
      data: apiUser,
    },
    {
      name: "disable account",
      run: () => service.setUserEnabled(token, 7, false),
      path: "/admin/users/7/disable",
      method: "PATCH",
      data: apiUser,
    },
    {
      name: "reset password contract",
      run: () => service.resetUserPassword(token, 7, "Secret123"),
      path: "/admin/users/7/password",
      method: "POST",
      body: { new_password: "Secret123" },
      data: {},
    },
    {
      name: "delete user",
      run: () => service.deleteUser(token, 7),
      path: "/admin/users/7",
      method: "DELETE",
      data: {},
    },
    {
      name: "create survey comment flag",
      run: () => service.createSurvey(token, surveyInput),
      path: "/admin/surveys",
      method: "POST",
      body: {
        title: "Title",
        question: "Question",
        type: "WEEKLY",
        allow_comments: false,
      },
      data: survey,
    },
    {
      name: "update survey",
      run: () => service.updateSurvey(token, 7, surveyInput),
      path: "/admin/surveys/7",
      method: "PUT",
      body: {
        title: "Title",
        question: "Question",
        type: "WEEKLY",
        allow_comments: false,
      },
      data: survey,
    },
    ...(["publish", "close", "reopen"] as const).map((transition) => ({
      name: `survey ${transition}`,
      run: () => service.changeSurveyStatus(token, 7, transition),
      path: `/admin/surveys/7/${transition}`,
      method: "POST",
      data: survey,
    })),
    {
      name: "delete survey",
      run: () => service.deleteSurvey(token, 7),
      path: "/admin/surveys/7",
      method: "DELETE",
      data: {},
    },
    {
      name: "create activity options",
      run: () => service.createActivity(token, activityInput),
      path: "/admin/activities",
      method: "POST",
      body: activityInput,
      data: activity,
    },
    {
      name: "update activity",
      run: () => service.updateActivity(token, 7, activityInput),
      path: "/admin/activities/7",
      method: "PUT",
      body: activityInput,
      data: activity,
    },
    ...(["OPEN", "CLOSED"] as const).map((status) => ({
      name: `activity ${status}`,
      run: () => service.changeActivityStatus(token, 7, status),
      path: `/admin/activities/7/${status === "OPEN" ? "open" : "close"}`,
      method: "PATCH",
      data: activity,
    })),
    {
      name: "delete activity",
      run: () => service.deleteActivity(token, 7),
      path: "/admin/activities/7",
      method: "DELETE",
      data: {},
    },
    {
      name: "report status contract",
      run: () => service.updateReportStatus(token, 7, "ADDRESSED"),
      path: "/reports/7/status",
      method: "PATCH",
      body: { status: "ADDRESSED" },
      data: {},
    },
  ];
  it.each(cases)("$name", async (test) => {
    const fetcher = vi.fn().mockResolvedValue(response(test.data));
    vi.stubGlobal("fetch", fetcher);
    await test.run();
    const payload = "body" in test ? test.body : undefined;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${API_URL}/api/v1${test.path}`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: test.method,
      headers: payload
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : { Authorization: `Bearer ${token}` },
    });
    if (payload)
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(payload);
    else expect(fetcher.mock.calls[0][1].body).toBeUndefined();
  });
  it("recursive comments preserve replies and default absent replies to empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response([
            {
              id: 1,
              content: "Parent",
              likes: 0,
              created_at: "2026-01-01",
              replies: [
                { id: 2, content: "Child", likes: 1, created_at: "2026-01-02" },
              ],
            },
          ]),
        ),
    );
    expect(await service.getSurveyComments(token, 7)).toEqual([
      {
        id: 1,
        content: "Parent",
        likes: 0,
        createdAt: "2026-01-01",
        replies: [
          {
            id: 2,
            content: "Child",
            likes: 1,
            createdAt: "2026-01-02",
            replies: [],
          },
        ],
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/v1/surveys/7/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
  it("multipart payment leaves content type for browser boundary", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(payment));
    vi.stubGlobal("fetch", fetcher);
    const voucher = new File(["%PDF-1.7\n"], "receipt.pdf", {
      type: "application/pdf",
    });
    expect(
      await service.recordPayment(token, {
        beneficiaryName: "Name",
        plan: "ANNUAL",
        voucher,
      }),
    ).toMatchObject({
      beneficiaryName: payment.beneficiary_name,
      nextPaymentDate: payment.next_payment_date,
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/v1/admin/payments`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: `Bearer ${token}` });
    expect([...init.body.keys()]).toEqual([
      "beneficiary_name",
      "plan",
      "voucher",
    ]);
    expect(init.body.get("beneficiary_name")).toBe("Name");
    expect(init.body.get("plan")).toBe("ANNUAL");
    expect(init.body.get("voucher").name).toBe("receipt.pdf");
  });
  it("forbidden response never returns a mapped administrator", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ message: "Forbidden", code: "DENIED" }, 403),
        ),
    );
    await expect(service.createUser(token, userInput)).rejects.toMatchObject({
      status: 403,
      code: "DENIED",
    });
  });
});
