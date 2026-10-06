import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActivitiesPage } from "../src/pages/ActivitiesPage";
import {
  activity,
  backend,
  body,
  cancel,
  change,
  click,
  confirm,
  contract,
  formSubmit,
  response,
  settled,
  token,
  writes,
} from "./helpers";

async function mount(status = "OPEN") {
  const fetcher = backend("/activities", [{ ...activity, status }], activity);
  render(<ActivitiesPage token={token} />);
  await screen.findByText(activity.title);
  return fetcher;
}
function fill(options = [" First ", " Second "]) {
  change("activityTitle", "New activity");
  change("description", "Description");
  const inputs = screen.getAllByPlaceholderText("optionPlaceholder");
  options.forEach((value, i) =>
    fireEvent.change(inputs[i], { target: { value } }),
  );
}
describe("[integration] src/pages/ActivitiesPage.tsx", () => {
  it.each([
    ["empty", ["", ""]],
    ["one option", ["A", ""]],
    ["spaces", [" ", "  "]],
    ["one trimmed", [" A ", "\t"]],
  ])("blocks %s option set", async (_name, options) => {
    await mount();
    click("＋ createActivity");
    fill(options);
    formSubmit();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
  it("trims both options before confirmed create", async () => {
    await mount();
    click("＋ createActivity");
    fill();
    formSubmit();
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract("/admin/activities", "POST", {
      title: "New activity",
      description: "Description",
      options: ["First", "Second"],
    });
  });
  it("three valid options are retained", async () => {
    await mount();
    click("＋ createActivity");
    click("＋ addOption");
    fill(["A", "B", "C"]);
    formSubmit();
    confirm();
    await settled();
    expect(body().options).toEqual(["A", "B", "C"]);
  });
  it("blank additional option is filtered at submit", async () => {
    await mount();
    click("＋ createActivity");
    click("＋ addOption");
    fill(["A", "B", " "]);
    formSubmit();
    confirm();
    await settled();
    expect(body().options).toEqual(["A", "B"]);
  });
  it("two minimum options cannot be removed", async () => {
    await mount();
    click("＋ createActivity");
    expect(screen.queryByRole("button", { name: "removeOption" })).toBeNull();
  });
  it("removing an extra option preserves order", async () => {
    await mount();
    click("＋ createActivity");
    click("＋ addOption");
    fill(["A", "B", "C"]);
    fireEvent.click(screen.getAllByRole("button", { name: "removeOption" })[1]);
    formSubmit();
    confirm();
    await settled();
    expect(body().options).toEqual(["A", "C"]);
  });
  it("required empty title is browser-invalid", async () => {
    await mount();
    click("＋ createActivity");
    expect(screen.getByLabelText("activityTitle")).toBeInvalid();
  });
  it("title, description and option input boundaries are declared", async () => {
    await mount();
    click("＋ createActivity");
    fill();
    expect(screen.getByLabelText("activityTitle")).toHaveAttribute(
      "maxlength",
      "160",
    );
    expect(screen.getByLabelText("description")).toHaveAttribute(
      "maxlength",
      "500",
    );
    expect(
      screen.getAllByPlaceholderText("optionPlaceholder")[0],
    ).toHaveAttribute("maxlength", "160");
  });
  it("cancel create preserves input without network mutation", async () => {
    await mount();
    click("＋ createActivity");
    fill();
    formSubmit();
    cancel();
    expect(writes()).toHaveLength(0);
    expect(screen.getByLabelText("activityTitle")).toHaveValue("New activity");
  });
  it("confirmed edit uses PUT and existing id", async () => {
    await mount();
    click("edit");
    change("activityTitle", "Changed");
    formSubmit();
    confirm();
    await settled();
    contract("/admin/activities/7", "PUT", {
      title: "Changed",
      description: activity.description,
      options: ["First", "Second"],
    });
  });
  it("cancel edit leaves server untouched", async () => {
    await mount();
    click("edit");
    formSubmit();
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it.each([
    ["OPEN", "close", "close"],
    ["CLOSED", "reopen", "open"],
  ])("%s lifecycle confirms %s", async (status, action, endpoint) => {
    await mount(status);
    click(action);
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract(`/admin/activities/7/${endpoint}`, "PATCH");
  });
  it("delete requires confirmation", async () => {
    await mount();
    click("deleteSurvey");
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract("/admin/activities/7", "DELETE");
  });
  it("cancel delete prevents deletion", async () => {
    await mount();
    click("deleteSurvey");
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it("failed mutation keeps create inputs for retry", async () => {
    const fetcher = await mount();
    click("＋ createActivity");
    fill();
    formSubmit();
    fetcher.mockResolvedValueOnce(response({}, 500));
    confirm();
    await settled();
    expect(screen.getByLabelText("activityTitle")).toHaveValue("New activity");
    expect(screen.getByText("activityActionFailed")).toBeInTheDocument();
  });
  it("successful mutation refreshes the protected list", async () => {
    const fetcher = await mount();
    click("deleteSurvey");
    confirm();
    await settled();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(fetcher.mock.calls[2][1]?.headers).toEqual({
      Authorization: `Bearer ${token}`,
    });
  });
});
