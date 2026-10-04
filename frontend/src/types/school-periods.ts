export type SchoolPeriodStatus = "PLANNED" | "OPEN" | "CLOSED";

export interface SchoolPeriodWarning {
  type: "NEAR_END" | "OVERDUE";
  daysRemaining: number;
  message: string;
}

export interface SchoolPeriodsResponse {
  data: SchoolPeriod[];
  currentOpenPeriod: SchoolPeriod | null;
  warning: SchoolPeriodWarning | null;
}

export interface SchoolPeriod {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  status: SchoolPeriodStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasReferences?: boolean;
}

export interface CreateSchoolPeriodRequest {
  year: number;
  startDate: string;
  endDate: string;
}

export interface UpdateSchoolPeriodRequest {
  year?: number;
  startDate?: string;
  endDate?: string;
}
