export type ReportPaymentStatus =
  | 'ALL'
  | 'PAGADO'
  | 'NO_PAGADO';

export interface ReportSchoolPeriod {
  id: string;
  year: number;
  status: string;
  isActive: boolean;
}

export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportPerson {
  personId: string;
  fullName: string;
  documentType: string;
  documentNumber: string | null;
}

export interface ReportPaymentTrace {
  paymentId: string;
  paymentDate: string;
  operationNumber: string | null;
  registeredAt: string;
}

export interface ReportSummary {
  schoolPeriod: ReportSchoolPeriod;
  families: number;
  students: number;

  apafa: {
    totalFamilies: number;
    paid: number;
    unpaid: number;
    paidPercentage: number;
  };

  taller: {
    totalStudents: number;
    paid: number;
    unpaid: number;
    paidPercentage: number;
  };
  classrooms: Array<{
    classroomId: string;
    classroom: string;
    apafaUnpaid: number;
    tallerUnpaid: number;
  }>;
}

export interface ApafaReportItem {
  familyId: string;
  familyCode: string | null;
  familyName: string;
  guardian: ReportPerson | null;
  studentsCount: number;

  status:
    | 'PAGADO'
    | 'NO_PAGADO';

  payment:
    ReportPaymentTrace | null;
}

export interface ApafaReportResponse {
  schoolPeriod: ReportSchoolPeriod;
  data: ApafaReportItem[];
  pagination: ReportPagination;
}

export interface TallerAcademicData {
  cycleId: string;
  cycleCode: string;
  cycleName: string;

  educationLevelId: string;
  educationLevelName: string;

  classroomId: string;
  classroomName: string;

  shiftId: string;
  shiftCode: string;
  shiftName: string;
}

export interface TallerReportItem {
  enrollmentId: string;
  enrollmentStatus: string;

  studentId: string;
  student: ReportPerson;

  family: {
    id: string;
    code: string | null;
    name: string;
  } | null;

  guardian: ReportPerson | null;

  academic:
    TallerAcademicData;

  status:
    | 'PAGADO'
    | 'NO_PAGADO';

  payment:
    ReportPaymentTrace | null;
}

export interface TallerReportResponse {
  schoolPeriod: ReportSchoolPeriod;
  data: TallerReportItem[];
  pagination: ReportPagination;
}

export interface PaymentsReportItem {
  enrollmentId: string;
  family: { id: string; code: string | null; name: string };
  guardian: (ReportPerson & { phone: string | null; email: string | null; relationship: string }) | null;
  father: (ReportPerson & { phone: string | null; email: string | null; relationship: string }) | null;
  mother: (ReportPerson & { phone: string | null; email: string | null; relationship: string }) | null;
  student: ReportPerson & { code: string | null; firstName: string; lastNameFather: string | null; lastNameMother: string | null };
  academic: TallerAcademicData;
  apafa: { status: 'PAGADO' | 'NO_PAGADO'; paymentDate: string | null };
  taller: { status: 'PAGADO' | 'NO_PAGADO'; paymentDate: string | null };
}

export interface PaymentsReportResponse {
  schoolPeriod: ReportSchoolPeriod;
  data: PaymentsReportItem[];
  statistics: {
    visibleFamilies: number; visibleStudents: number;
    apafaPaid: number; apafaUnpaid: number;
    tallerPaid: number; tallerUnpaid: number;
  };
  classrooms: Array<{ classroomId: string; classroom: string; apafaUnpaid: number; tallerUnpaid: number }>;
  pagination: ReportPagination;
}

export interface PaymentsReportParams {
  schoolPeriodId: string;
  cycleId?: string; educationLevelId?: string; classroomId?: string; shiftId?: string;
  apafaStatus?: ReportPaymentStatus; tallerStatus?: ReportPaymentStatus;
  paymentType?: 'ALL' | 'APAFA' | 'TALLER'; status?: ReportPaymentStatus;
  search?: string; page?: number; limit?: number;
}

export interface ReportSummaryParams {
  schoolPeriodId: string;
  cycleId?: string; educationLevelId?: string; classroomId?: string; shiftId?: string;
  paymentType?: 'ALL' | 'APAFA' | 'TALLER';
}

export interface ApafaReportParams {
  schoolPeriodId: string;

  status?:
    ReportPaymentStatus;

  search?: string;

  page?: number;
  limit?: number;
}

export interface TallerReportParams {
  schoolPeriodId: string;

  status?:
    ReportPaymentStatus;

  search?: string;

  educationLevelId?:
    string;

  classroomId?:
    string;

  shiftId?:
    string;

  page?: number;
  limit?: number;
}

export type ReportExportFormat =
  | 'xlsx'
  | 'pdf';
