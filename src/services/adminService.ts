import type {
  ActivityStatus,
  AdminActivity,
  AdminSurvey,
  PaymentPlan,
  PaymentPlanCode,
  PaymentRecord,
  Report,
  ReportStatus,
  Role,
  SurveyAnswer,
  User,
} from "../types/domain";
import { API_URL, parseApiResponse } from "./api";

type ApiUser = Omit<User, "displayName" | "systemOwner"> & {
  display_name: string;
  system_owner: boolean;
};

function mapUser(user: ApiUser): User {
  return {
    ...user,
    displayName: user.display_name,
    systemOwner: user.system_owner,
  };
}

export async function getUsers(token: string): Promise<User[]> {
  const response = await fetch(`${API_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse<ApiUser[]>(response);
  return data.map(mapUser);
}

export type CreateUserInput = {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: Role;
};

export async function createUser(
  token: string,
  input: CreateUserInput,
): Promise<User> {
  const response = await fetch(`${API_URL}/api/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      password: input.password,
      display_name: input.displayName,
      role: input.role,
    }),
  });
  const data = await parseApiResponse<ApiUser>(response);
  return mapUser(data);
}

export type UpdateUserInput = Partial<
  Pick<CreateUserInput, "username" | "email" | "displayName" | "role">
>;

export async function updateUser(
  token: string,
  id: number,
  input: UpdateUserInput,
): Promise<User> {
  const response = await fetch(`${API_URL}/api/v1/admin/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(input.username !== undefined && { username: input.username }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.displayName !== undefined && {
        display_name: input.displayName,
      }),
      ...(input.role !== undefined && { role: input.role }),
    }),
  });
  return mapUser(await parseApiResponse<ApiUser>(response));
}

export async function setUserEnabled(
  token: string,
  id: number,
  enabled: boolean,
): Promise<User> {
  const response = await fetch(
    `${API_URL}/api/v1/admin/users/${id}/${enabled ? "enable" : "disable"}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return mapUser(await parseApiResponse<ApiUser>(response));
}

export async function resetUserPassword(
  token: string,
  id: number,
  newPassword: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/admin/users/${id}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ new_password: newPassword }),
  });
  await parseApiResponse<unknown>(response);
}

export async function deleteUser(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseApiResponse<unknown>(response);
}

type ApiSurvey = Omit<
  AdminSurvey,
  "allowComments" | "createdBy" | "createdAt"
> & {
  allow_comments: boolean;
  created_by: string;
  created_at: string;
};

type ApiSurveyAnswer = Omit<
  SurveyAnswer,
  "surveyId" | "displayName" | "answerText" | "createdAt"
> & {
  survey_id: number;
  display_name: string;
  answer_text: string;
  created_at: string;
};

function mapSurvey(survey: ApiSurvey): AdminSurvey {
  return {
    ...survey,
    allowComments: survey.allow_comments,
    createdBy: survey.created_by,
    createdAt: survey.created_at,
  };
}

function mapSurveyAnswer(answer: ApiSurveyAnswer): SurveyAnswer {
  return {
    ...answer,
    surveyId: answer.survey_id,
    displayName: answer.display_name,
    answerText: answer.answer_text,
    createdAt: answer.created_at,
  };
}

export type SurveyInput = {
  title: string;
  question: string;
  type: AdminSurvey["type"];
  allowComments: boolean;
};

function surveyPayload(input: SurveyInput) {
  return {
    title: input.title,
    question: input.question,
    type: input.type,
    allow_comments: input.allowComments,
  };
}

export async function getAdminSurveys(token: string): Promise<AdminSurvey[]> {
  const response = await fetch(`${API_URL}/api/v1/admin/surveys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse<ApiSurvey[]>(response);
  return data.map(mapSurvey);
}

export async function createSurvey(
  token: string,
  input: SurveyInput,
): Promise<AdminSurvey> {
  const response = await fetch(`${API_URL}/api/v1/admin/surveys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(surveyPayload(input)),
  });
  return mapSurvey(await parseApiResponse<ApiSurvey>(response));
}

export async function updateSurvey(
  token: string,
  id: number,
  input: SurveyInput,
): Promise<AdminSurvey> {
  const response = await fetch(`${API_URL}/api/v1/admin/surveys/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(surveyPayload(input)),
  });
  return mapSurvey(await parseApiResponse<ApiSurvey>(response));
}

export type SurveyTransition = "publish" | "close" | "reopen";

export async function changeSurveyStatus(
  token: string,
  id: number,
  transition: SurveyTransition,
): Promise<AdminSurvey> {
  const response = await fetch(
    `${API_URL}/api/v1/admin/surveys/${id}/${transition}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return mapSurvey(await parseApiResponse<ApiSurvey>(response));
}

export async function deleteSurvey(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/admin/surveys/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseApiResponse<unknown>(response);
}

export async function getSurveyAnswers(
  token: string,
  id: number,
): Promise<SurveyAnswer[]> {
  const response = await fetch(
    `${API_URL}/api/v1/admin/surveys/${id}/answers`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await parseApiResponse<ApiSurveyAnswer[]>(response);
  return data.map(mapSurveyAnswer);
}

type ApiActivityOption = Omit<
  AdminActivity["options"][number],
  "percentage"
> & {
  percentage: number;
};
type ApiActivity = Omit<
  AdminActivity,
  "createdBy" | "createdAt" | "options"
> & {
  created_by: string;
  created_at: string;
  options: ApiActivityOption[];
};

function mapActivity(activity: ApiActivity): AdminActivity {
  return {
    ...activity,
    createdBy: activity.created_by,
    createdAt: activity.created_at,
  };
}

export type ActivityInput = {
  title: string;
  description: string;
  options: string[];
};

export async function getAdminActivities(
  token: string,
): Promise<AdminActivity[]> {
  const response = await fetch(`${API_URL}/api/v1/admin/activities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse<ApiActivity[]>(response);
  return data.map(mapActivity);
}

export async function createActivity(
  token: string,
  input: ActivityInput,
): Promise<AdminActivity> {
  const response = await fetch(`${API_URL}/api/v1/admin/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return mapActivity(await parseApiResponse<ApiActivity>(response));
}

export async function updateActivity(
  token: string,
  id: number,
  input: ActivityInput,
): Promise<AdminActivity> {
  const response = await fetch(`${API_URL}/api/v1/admin/activities/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return mapActivity(await parseApiResponse<ApiActivity>(response));
}

export async function changeActivityStatus(
  token: string,
  id: number,
  status: ActivityStatus,
): Promise<AdminActivity> {
  const action = status === "OPEN" ? "open" : "close";
  const response = await fetch(
    `${API_URL}/api/v1/admin/activities/${id}/${action}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return mapActivity(await parseApiResponse<ApiActivity>(response));
}

export async function deleteActivity(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/admin/activities/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseApiResponse<unknown>(response);
}

type ApiReport = Report;

export async function getReports(token: string): Promise<Report[]> {
  const response = await fetch(`${API_URL}/api/v1/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseApiResponse<ApiReport[]>(response);
}

export async function updateReportStatus(
  token: string,
  id: number,
  status: ReportStatus,
): Promise<Report> {
  const response = await fetch(`${API_URL}/api/v1/reports/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  return parseApiResponse<ApiReport>(response);
}

type ApiPaymentPlan = Omit<PaymentPlan, "durationMonths"> & {
  duration_months: number;
};

type ApiPaymentRecord = Omit<
  PaymentRecord,
  | "userId"
  | "beneficiaryName"
  | "nextPaymentDate"
  | "voucherFilename"
  | "voucherSize"
  | "createdAt"
> & {
  user_id: number | null;
  beneficiary_name: string;
  next_payment_date: string;
  voucher_filename: string;
  voucher_size: number;
  created_at: string;
};

function mapPaymentPlan(plan: ApiPaymentPlan): PaymentPlan {
  return {
    code: plan.code,
    durationMonths: plan.duration_months,
  };
}

function mapPayment(payment: ApiPaymentRecord): PaymentRecord {
  return {
    ...payment,
    userId: payment.user_id,
    beneficiaryName: payment.beneficiary_name,
    nextPaymentDate: payment.next_payment_date,
    voucherFilename: payment.voucher_filename,
    voucherSize: payment.voucher_size,
    createdAt: payment.created_at,
  };
}

export async function getPaymentPlans(token: string): Promise<PaymentPlan[]> {
  const response = await fetch(`${API_URL}/api/v1/admin/payments/plans`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse<ApiPaymentPlan[]>(response);
  return data.map(mapPaymentPlan);
}

export type RecordPaymentInput = {
  beneficiaryName: string;
  plan: PaymentPlanCode;
  voucher: File;
};

export async function recordPayment(
  token: string,
  input: RecordPaymentInput,
): Promise<PaymentRecord> {
  const formData = new FormData();
  formData.append("beneficiary_name", input.beneficiaryName);
  formData.append("plan", input.plan);
  formData.append("voucher", input.voucher, input.voucher.name);

  const response = await fetch(`${API_URL}/api/v1/admin/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return mapPayment(await parseApiResponse<ApiPaymentRecord>(response));
}

export function isSystemAdmin(role: Role) {
  return role === "SYSTEM_ADMIN";
}
