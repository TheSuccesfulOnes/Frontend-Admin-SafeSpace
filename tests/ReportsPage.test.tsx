import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReportsPage } from "../src/pages/ReportsPage";
import {
  backend,
  cancel,
  click,
  confirm,
  contract,
  deferred,
  report,
  response,
  settled,
  token,
  writes,
} from "./helpers";
async function mount(status = "NEW") {
  const fetcher = backend(
    "/reports",
    [
      { ...report, status },
      { ...report, id: 8, title: "Other report", status: "NEW" },
    ],
    { ...report, status: "CLOSED" },
  );
  render(<ReportsPage token={token} />);
  await screen.findByText(report.title);
  return fetcher;
}
function select(status: string) {
  fireEvent.change(screen.getByLabelText(`reportStatus: ${report.title}`), {
    target: { value: status },
  });
}
const states = ["NEW", "IN_REVIEW", "ADDRESSED", "CLOSED"];
const transitions = states.flatMap((from) =>
  states.filter((to) => to !== from).map((to) => [from, to]),
);
describe("[integration] src/pages/ReportsPage.tsx", () => {
  it.each(transitions)(
    "confirms supported transition %s -> %s",
    async (from, to) => {
      const fetcher = await mount(from);
      select(to);
      expect(writes()).toHaveLength(0);
      fetcher.mockResolvedValueOnce(response({ ...report, status: to }));
      confirm();
      await settled();
      contract("/reports/7/status", "PATCH", { status: to });
      expect(
        screen.getByLabelText(`reportStatus: ${report.title}`),
      ).toHaveValue(to);
    },
  );
  it("cancel preserves original status without request", async () => {
    await mount();
    select("CLOSED");
    cancel();
    expect(writes()).toHaveLength(0);
    expect(screen.getByLabelText(`reportStatus: ${report.title}`)).toHaveValue(
      "NEW",
    );
  });
  it("Escape cancels unsent change", async () => {
    await mount();
    select("CLOSED");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes()).toHaveLength(0);
  });
  it("failure retains previous status and closes dialog", async () => {
    const fetcher = await mount();
    select("CLOSED");
    fetcher.mockResolvedValueOnce(response({}, 403));
    confirm();
    await settled();
    expect(screen.getByLabelText(`reportStatus: ${report.title}`)).toHaveValue(
      "NEW",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("reportsFailed");
  });
  it("updates only selected record", async () => {
    await mount();
    select("CLOSED");
    confirm();
    await settled();
    expect(screen.getByLabelText("reportStatus: Other report")).toHaveValue(
      "NEW",
    );
  });
  it("retry after server rejection succeeds", async () => {
    const fetcher = await mount();
    select("CLOSED");
    fetcher.mockResolvedValueOnce(response({}, 500));
    confirm();
    await settled();
    select("CLOSED");
    confirm();
    await settled();
    expect(screen.getByLabelText(`reportStatus: ${report.title}`)).toHaveValue(
      "CLOSED",
    );
    expect(writes()).toHaveLength(2);
  });
  it("busy disables every status selector and cancellation", async () => {
    const fetcher = await mount();
    const pending = deferred<Response>();
    select("CLOSED");
    fetcher.mockReturnValueOnce(pending.promise);
    confirm();
    screen.getAllByRole("combobox").forEach((s) => expect(s).toBeDisabled());
    expect(screen.getByRole("button", { name: "cancel" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () =>
      pending.resolve(response({ ...report, status: "CLOSED" })),
    );
    await settled();
  });
  it("list load failure can be refreshed locally", async () => {
    const fetcher = backend("/reports", [report], report);
    fetcher.mockResolvedValueOnce(response({}, 500));
    render(<ReportsPage token={token} />);
    await screen.findByRole("alert");
    click("↻ refresh");
    await screen.findByText(report.title);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("empty list offers no mutation target", async () => {
    backend("/reports", [], report);
    render(<ReportsPage token={token} />);
    await screen.findByText("emptyUsers");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(writes()).toHaveLength(0);
  });
});
