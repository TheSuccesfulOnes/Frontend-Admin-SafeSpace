import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Stable keys isolate business validation from presentation translations.
const language = {
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
};
vi.mock("../src/i18n/useLanguage", () => ({ useLanguage: () => language }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  sessionStorage.clear();
  localStorage.clear();
  // Fail closed: no test can fall through to a live service.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Unconfigured test request"))),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
