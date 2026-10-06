import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmationDialog } from "../src/components/ConfirmationDialog";
import type { ConfirmationAction } from "../src/components/ConfirmationDialog";
import { ActivitiesPage } from "../src/pages/ActivitiesPage";
import {
  activity,
  backend,
  cancel,
  click,
  confirm,
  contract,
  settled,
  token,
  writes,
} from "./helpers";
const actions: ConfirmationAction[] = [
  "create",
  "delete",
  "disable",
  "enable",
  "edit",
  "password",
  "publish",
  "close",
  "reopen",
  "status",
];
function mount(action: ConfirmationAction, busy: boolean) {
  const onConfirm = vi.fn(),
    onCancel = vi.fn();
  const view = render(
    <ConfirmationDialog
      action={action}
      subject="Target"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel, ...view };
}
describe("[unit] src/components/ConfirmationDialog.tsx", () => {
  it.each(actions)(
    "%s requires explicit confirmation and allows cancellation while idle",
    (action) => {
      const { onConfirm, onCancel } = mount(action, false);
      expect(onConfirm).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "confirmAction" }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    },
  );
  it.each(actions)("%s busy blocks clicks and Escape", (action) => {
    const { onConfirm, onCancel } = mount(action, true);
    fireEvent.click(screen.getByRole("button", { name: "saving" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
  it("Escape cancels idle dialog", () => {
    const { onCancel } = mount("delete", false);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("other keys never authorize mutation", () => {
    const { onConfirm, onCancel } = mount("delete", false);
    fireEvent.keyDown(window, { key: "x" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
  it("unmount removes Escape listener", () => {
    const { onCancel, unmount } = mount("delete", false);
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
describe("[integration] src/components/ConfirmationDialog.tsx", () => {
  it("component deletion remains unsent when confirmation is cancelled", async () => {
    backend("/activities", [activity], activity);
    render(<ActivitiesPage token={token} />);
    await screen.findByText(activity.title);
    click("deleteSurvey");
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it("explicit consent passes deletion through actual service and parser", async () => {
    backend("/activities", [activity], activity);
    render(<ActivitiesPage token={token} />);
    await screen.findByText(activity.title);
    click("deleteSurvey");
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract("/admin/activities/7", "DELETE");
  });
});
