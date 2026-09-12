export type Role = "EMPLOYEE" | "HR_MEMBER" | "SYSTEM_ADMIN";

export type PageKey =
  | "overview"
  | "administrators"
  | "employees"
  | "hrMembers"
  | "surveys"
  | "activities"
  | "reports"
  | "payments";

export type User = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  systemOwner: boolean;
};

export type AuthResponse = {
  token: string;
  username: string;
  displayName: string;
  role: Role;
};

export type SurveyType = "DAILY" | "WEEKLY";
export type SurveyStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export type AdminSurvey = {
  id: number;
  title: string;
  question: string;
  type: SurveyType;
  status: SurveyStatus;
  allowComments: boolean;
  answers: number;
  createdBy: string;
  createdAt: string;
};

export type SurveyComment = {
  id: number;
  content: string;
  likes: number;
  createdAt: string;
  replies: SurveyComment[];
};

export type ActivityStatus = "OPEN" | "CLOSED";

export type ActivityOption = {
  id: number;
  label: string;
  votes: number;
  percentage: number;
};

export type AdminActivity = {
  id: number;
  title: string;
  description: string;
  status: ActivityStatus;
  options: ActivityOption[];
  createdBy: string;
  createdAt: string;
};

export type ReportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ReportStatus = "NEW" | "IN_REVIEW" | "ADDRESSED" | "CLOSED";

export type Report = {
  id: number;
  category: string;
  title: string;
  description: string;
  priority: ReportPriority;
  status: ReportStatus;
  anonymous: boolean;
};

export type PaymentPlanCode = "MONTHLY" | "ANNUAL";

export type PaymentPlan = {
  code: PaymentPlanCode;
  durationMonths: number;
};

export type PaymentRecord = {
  id: number;
  userId: number | null;
  beneficiaryName: string;
  plan: PaymentPlanCode;
  nextPaymentDate: string;
  voucherFilename: string;
  voucherSize: number;
  createdAt: string;
};
