import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PaymentsPage } from "../src/pages/PaymentsPage";
import { API_URL } from "../src/services/api";
import {
  backend,
  cancel,
  change,
  click,
  confirm,
  deferred,
  formSubmit,
  payment,
  plans,
  response,
  settled,
  token,
  writes,
} from "./helpers";
async function mount(available = plans) {
  const fetcher = backend("/plans", available, payment);
  render(<PaymentsPage token={token} />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  if (available.length)
    await waitFor(() =>
      expect(
        screen.getByLabelText("paymentPlan", { selector: "select" }),
      ).toBeEnabled(),
    );
  return fetcher;
}
function upload(file?: File) {
  fireEvent.change(document.getElementById("payment-voucher")!, {
    target: { files: file ? [file] : [] },
  });
}
function file(name = "receipt.pdf", type = "application/pdf", size = 9) {
  const f = new File(["%PDF-1.7\n"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}
function fill() {
  change("paymentBeneficiary", "  Test Name  ");
  change("paymentPlan", "MONTHLY");
  upload(file());
}
describe("[integration] src/pages/PaymentsPage.tsx", () => {
  it.each([
    ["lowercase extension", "receipt.pdf", "application/pdf"],
    ["uppercase extension", "receipt.PDF", "application/pdf"],
    ["missing MIME", "receipt.pdf", ""],
    ["generic MIME", "receipt.pdf", "application/octet-stream"],
  ])("accepts %s", async (_name, name, type) => {
    await mount();
    upload(file(name, type));
    expect(screen.getByText(`selectedVoucher: ${name}`)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each([
    ["text", "receipt.txt", "text/plain", 9],
    ["double extension", "receipt.pdf.exe", "application/pdf", 9],
    ["oversized PDF", "receipt.pdf", "application/pdf", 700_001],
    ["legacy 10 MiB limit", "receipt.pdf", "application/pdf", 10 * 1024 * 1024],
    ["no extension", "receipt", "application/pdf", 9],
    ["wrong MIME", "receipt.pdf", "text/plain", 9],
    ["empty PDF", "receipt.pdf", "application/pdf", 0],
  ])("rejects %s", async (_name, name, type, size) => {
    await mount();
    upload(file(name, type, size));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "paymentVoucherInvalid",
    );
    expect(screen.queryByRole("button", { name: "removeVoucher" })).toBeNull();
  });
  it("accepts exactly 700000 bytes", async () => {
    await mount();
    upload(file("edge.pdf", "application/pdf", 700_000));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("selectedVoucher: edge.pdf")).toBeInTheDocument();
  });
  it("cancelled picker retains previous voucher", async () => {
    await mount();
    upload(file());
    upload();
    expect(
      screen.getByText("selectedVoucher: receipt.pdf"),
    ).toBeInTheDocument();
  });
  it("invalid replacement clears previous voucher", async () => {
    await mount();
    upload(file());
    upload(file("bad.exe", "text/plain"));
    expect(screen.queryByText("selectedVoucher: receipt.pdf")).toBeNull();
  });
  it("remove clears both selected voucher and input", async () => {
    await mount();
    upload(file());
    click("removeVoucher");
    expect(screen.queryByText("selectedVoucher: receipt.pdf")).toBeNull();
    expect(document.getElementById("payment-voucher")).toHaveValue("");
  });
  it.each(["name", "plan", "voucher", "whitespace name"])(
    "blocks incomplete %s",
    async (missing) => {
      await mount();
      fill();
      if (missing === "name") change("paymentBeneficiary", "");
      if (missing === "whitespace name") change("paymentBeneficiary", " \t ");
      if (missing === "plan") change("paymentPlan", "");
      if (missing === "voucher") click("removeVoucher");
      formSubmit();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "paymentFormIncomplete",
      );
      expect(writes()).toHaveLength(0);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );
  it("no plans disables selection", async () => {
    await mount([]);
    await waitFor(() =>
      expect(
        screen.getByLabelText("paymentPlan", { selector: "select" }),
      ).toBeDisabled(),
    );
  });
  it("trims beneficiary and sends authenticated multipart only after confirmation", async () => {
    await mount();
    fill();
    formSubmit();
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    const [url, init] = writes()[0];
    const data = init!.body as FormData;
    expect(url).toBe(`${API_URL}/api/v1/admin/payments`);
    expect(init!.method).toBe("POST");
    expect([...data.keys()]).toEqual(["beneficiary_name", "plan", "voucher"]);
    expect(data.get("beneficiary_name")).toBe("Test Name");
    expect(data.get("plan")).toBe("MONTHLY");
    expect((data.get("voucher") as File).name).toBe("receipt.pdf");
    expect(init!.headers).toEqual({ Authorization: `Bearer ${token}` });
  });
  it("annual plan is sent unchanged", async () => {
    await mount();
    fill();
    change("paymentPlan", "ANNUAL");
    formSubmit();
    confirm();
    await settled();
    expect((writes()[0][1]!.body as FormData).get("plan")).toBe("ANNUAL");
  });
  it("cancel leaves complete inputs without recording", async () => {
    await mount();
    fill();
    formSubmit();
    cancel();
    expect(writes()).toHaveLength(0);
    expect(screen.getByLabelText("paymentBeneficiary")).toHaveValue(
      "  Test Name  ",
    );
  });
  it("success clears form and exposes next due date", async () => {
    await mount();
    fill();
    formSubmit();
    confirm();
    await settled();
    expect(screen.getByLabelText("paymentBeneficiary")).toHaveValue("");
    expect(
      screen.getByLabelText("paymentPlan", { selector: "select" }),
    ).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("November 5, 2026");
  });
  it("dismiss success removes date notification", async () => {
    await mount();
    fill();
    formSubmit();
    confirm();
    await settled();
    click("dismissNotification");
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("server rejection preserves inputs and reports safe message", async () => {
    const fetcher = await mount();
    fill();
    formSubmit();
    fetcher.mockResolvedValueOnce(
      response({ message: "Rejected voucher" }, 422),
    );
    confirm();
    await settled();
    expect(screen.getByRole("alert")).toHaveTextContent("Rejected voucher");
    expect(screen.getByLabelText("paymentBeneficiary")).toHaveValue(
      "  Test Name  ",
    );
  });
  it("busy dialog blocks duplicate confirmation and cancellation", async () => {
    const fetcher = await mount();
    const pending = deferred<Response>();
    fill();
    formSubmit();
    fetcher.mockReturnValueOnce(pending.promise);
    confirm();
    expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "cancel" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => pending.resolve(response(payment)));
    await settled();
    expect(writes()).toHaveLength(1);
  });
  it("plan load failure blocks unavailable plan and reports error", async () => {
    const fetcher = backend("/plans", plans, payment);
    fetcher.mockResolvedValueOnce(response({}, 503));
    render(<PaymentsPage token={token} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "paymentPlansFailed",
    );
    expect(
      screen.getByLabelText("paymentPlan", { selector: "select" }),
    ).toBeDisabled();
  });
});
