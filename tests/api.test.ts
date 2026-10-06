import { describe, expect, it, vi } from "vitest";
import { ApiError, parseApiResponse } from "../src/services/api";
import { login } from "../src/services/authService";
import { getReports } from "../src/services/adminService";
import { response } from "./helpers";

describe("[unit] src/services/api.ts", () => {
  it.each([
    [
      "message and code",
      { message: "Denied", code: "FORBIDDEN" },
      "Denied",
      "FORBIDDEN",
    ],
    ["message only", { message: "Denied" }, "Denied", undefined],
    ["code only", { code: "CONFLICT" }, "API_REQUEST_FAILED", "CONFLICT"],
    ["empty object", {}, "API_REQUEST_FAILED", undefined],
    ["null payload", null, "API_REQUEST_FAILED", undefined],
    ["numeric message", { message: 1 }, "API_REQUEST_FAILED", undefined],
    ["boolean message", { message: false }, "API_REQUEST_FAILED", undefined],
    ["array message", { message: ["Denied"] }, "API_REQUEST_FAILED", undefined],
    [
      "object message",
      { message: { text: "Denied" } },
      "API_REQUEST_FAILED",
      undefined,
    ],
    ["null message", { message: null }, "API_REQUEST_FAILED", undefined],
    ["numeric code", { message: "Denied", code: 401 }, "Denied", undefined],
    ["boolean code", { code: true }, "API_REQUEST_FAILED", undefined],
    ["object code", { code: {} }, "API_REQUEST_FAILED", undefined],
    ["array payload", [], "API_REQUEST_FAILED", undefined],
    ["string payload", "Denied", "API_REQUEST_FAILED", undefined],
    ["empty message permitted", { message: "", code: "" }, "", ""],
  ])("%s", async (_name, payload, message, code) => {
    const error = await parseApiResponse(response(payload, 403)).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message,
      code,
      status: 403,
      name: "ApiError",
    });
  });
  it.each([400, 401, 404, 409, 422, 500])(
    "preserves HTTP status %i",
    async (status) => {
      await expect(
        parseApiResponse(response({}, status)),
      ).rejects.toMatchObject({ status });
    },
  );
  it("malformed error JSON uses safe fallback", async () => {
    await expect(
      parseApiResponse(new Response("<html>", { status: 502 })),
    ).rejects.toMatchObject({ message: "API_REQUEST_FAILED", status: 502 });
  });
  it("204 without JSON resolves null", async () =>
    expect(
      await parseApiResponse(new Response(null, { status: 204 })),
    ).toBeNull());
  it("successful JSON preserves data rather than interpreting message as error", async () => {
    expect(
      await parseApiResponse(response({ message: "Success", id: 7 })),
    ).toEqual({ message: "Success", id: 7 });
  });
});
describe("[integration] src/services/api.ts", () => {
  it("auth transport preserves safe error type and code from parser", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            { message: "Invalid credentials", code: "UNAUTHORIZED" },
            401,
          ),
        ),
    );
    await expect(login("test-user", "test-password")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  });
  it("protected list parser rejects malformed provider error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ message: { debug: "Private internals" }, code: 500 }, 503),
        ),
    );
    await expect(getReports("test-token")).rejects.toMatchObject({
      message: "API_REQUEST_FAILED",
      code: undefined,
      status: 503,
    });
  });
});
