import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SurveysPage } from "../src/pages/SurveysPage";
import {
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
  survey,
  token,
  writes,
} from "./helpers";
async function mount(status = "DRAFT") {
  const fetcher = backend("/surveys", [{ ...survey, status }], survey);
  render(<SurveysPage token={token} />);
  await screen.findByText(survey.title);
  return fetcher;
}
function fill() {
  change("surveyTitle", "New survey");
  change("question", "Question?");
}
describe("[integration] src/pages/SurveysPage.tsx", () => {
  it.each(["surveyTitle", "question"])(
    "requires %s before browser submission",
    async (label) => {
      await mount();
      click("＋ createSurvey");
      expect(screen.getByLabelText(label)).toBeInvalid();
    },
  );
  it("title max boundary is 160", async () => {
    await mount();
    click("＋ createSurvey");
    expect(screen.getByLabelText("surveyTitle")).toHaveAttribute(
      "maxlength",
      "160",
    );
  });
  it("question max boundary is 500", async () => {
    await mount();
    click("＋ createSurvey");
    expect(screen.getByLabelText("question")).toHaveAttribute(
      "maxlength",
      "500",
    );
  });
  it.each(["DAILY", "WEEKLY"])(
    "creates %s survey only after confirmation",
    async (type) => {
      await mount();
      click("＋ createSurvey");
      fill();
      change("surveyType", type);
      formSubmit();
      expect(writes()).toHaveLength(0);
      confirm();
      await settled();
      contract("/admin/surveys", "POST", {
        type,
        title: "New survey",
        question: "Question?",
        allow_comments: true,
      });
    },
  );
  it("comments opt-out is sent to API", async () => {
    await mount();
    click("＋ createSurvey");
    fill();
    fireEvent.click(screen.getByLabelText("allowComments"));
    formSubmit();
    confirm();
    await settled();
    expect(body().allow_comments).toBe(false);
  });
  it("cancel create preserves draft without mutation", async () => {
    await mount();
    click("＋ createSurvey");
    fill();
    formSubmit();
    cancel();
    expect(writes()).toHaveLength(0);
    expect(screen.getByLabelText("question")).toHaveValue("Question?");
  });
  it("edit hydrates existing values and uses PUT", async () => {
    await mount();
    click("edit");
    expect(screen.getByLabelText("question")).toHaveValue(survey.question);
    change("question", "Changed?");
    formSubmit();
    confirm();
    await settled();
    contract("/admin/surveys/7", "PUT", {
      title: survey.title,
      question: "Changed?",
      type: "DAILY",
      allow_comments: true,
    });
  });
  it("cancel edit prevents changes", async () => {
    await mount();
    click("edit");
    formSubmit();
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it.each([
    ["DRAFT", "publish"],
    ["PUBLISHED", "close"],
    ["CLOSED", "reopen"],
  ])("%s selects the allowed %s transition", async (status, action) => {
    await mount(status);
    click(action);
    expect(writes()).toHaveLength(0);
    confirm();
    await settled();
    contract(`/admin/surveys/7/${action}`, "POST");
  });
  it("draft cannot close or reopen", async () => {
    await mount();
    expect(screen.queryByRole("button", { name: "close" })).toBeNull();
    expect(screen.queryByRole("button", { name: "reopen" })).toBeNull();
  });
  it("cancel transition prevents publish", async () => {
    await mount();
    click("publish");
    cancel();
    expect(writes()).toHaveLength(0);
  });
  it("confirmed delete sends DELETE", async () => {
    await mount();
    click("deleteSurvey");
    confirm();
    await settled();
    contract("/admin/surveys/7", "DELETE");
  });
  it("delete clears selected answers pane", async () => {
    await mount();
    click("viewAnswers");
    await screen.findByRole("button", { name: "closeAnswers" });
    click("deleteSurvey");
    confirm();
    await settled();
    expect(screen.queryByRole("button", { name: "closeAnswers" })).toBeNull();
  });
  it("comments failure provides retry and recovers", async () => {
    const fetcher = await mount();
    fetcher.mockResolvedValueOnce(response({}, 500));
    click("viewAnswers");
    await screen.findByRole("alert");
    click("retry");
    await screen.findByText("noComments");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("mutation failure keeps input for retry", async () => {
    const fetcher = await mount();
    click("＋ createSurvey");
    fill();
    formSubmit();
    fetcher.mockResolvedValueOnce(response({}, 409));
    confirm();
    await settled();
    expect(screen.getByLabelText("surveyTitle")).toHaveValue("New survey");
    expect(screen.getByText("surveyActionFailed")).toBeInTheDocument();
  });
  it("cancel delete keeps answers pane", async () => {
    await mount();
    click("viewAnswers");
    await screen.findByRole("button", { name: "closeAnswers" });
    click("deleteSurvey");
    cancel();
    expect(
      screen.getByRole("button", { name: "closeAnswers" }),
    ).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
});
