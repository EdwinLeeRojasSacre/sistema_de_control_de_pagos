export type PaymentStatus =
  | 'PAGADO'
  | 'NO_PAGADO';

export type SchoolPeriodStatus =
  | 'PLANNED'
  | 'OPEN'
  | 'CLOSED';

export type VoucherFileMode =
  | 'view'
  | 'download';

export interface PaymentSchoolPeriod {
  id: string;
  year: number;
}

export interface PaymentFamily {
  id: string;
  code: string | null;
  name: string;
  guardianName: string;
}

export interface PaymentRegisteredBy {
  id: string;
  username: string;
  fullName: string;
}

export interface PaymentTallerItem {
  itemId: string;
  studentId: string;
  studentName: string;
}

export interface PaymentVoucher {
  id: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  fileHash: string | null;
  uploadedAt: string;
}

export interface Payment {
  id: string;

  schoolPeriod:
    PaymentSchoolPeriod;

  family:
    PaymentFamily;

  registeredBy:
    PaymentRegisteredBy;

  paymentDate: string;

  operationNumber:
    string | null;

  observations:
    string | null;

  createdAt: string;

  apafa: {
    included: boolean;
  };

  talleres:
    PaymentTallerItem[];

  vouchers:
    PaymentVoucher[];
}

export interface PaymentsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaymentsResponse {
  data: Payment[];

  pagination:
    PaymentsPagination;
}

export interface GetPaymentsParams {
  schoolPeriodId?: string;
  familyGroupId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaymentStatusEnrollment {
  id: string;
  classroomId: string;
  status: string;
  classroom: {
    id: string;
    name: string;
    shift: {
      id: string;
      code: string;
      name: string;
    };
    level: {
      id: string;
      name: string;
      cycle: {
        id: string;
        code: string;
        name: string;
      };
    };
  };
}

export interface FamilyPaymentStudentStatus {
  studentId: string;
  personId: string;
  fullName: string;

  enrolledInPeriod:
    boolean;

  enrollment:
    PaymentStatusEnrollment | null;

  taller: {
    status:
      PaymentStatus;

    paymentId:
      string | null;

    paymentDate:
      string | null;
  };
}

export interface FamilyPaymentStatus {
  schoolPeriod: {
    id: string;
    year: number;
    status:
      SchoolPeriodStatus;
    isActive: boolean;
  };

  family: {
    id: string;
    code: string | null;
    name: string;
    isActive: boolean;
  };

  apafa: {
    status:
      PaymentStatus;

    paymentId:
      string | null;

    paymentDate:
      string | null;
  };

  students:
    FamilyPaymentStudentStatus[];
}

export interface CreatePaymentInput {
  schoolPeriodId: string;
  familyGroupId: string;
  paymentDate: string;

  includeApafa: boolean;

  studentIds: string[];

  operationNumber?: string;

  observations?: string;

  vouchers: File[];

  voucherAssociations:
    VoucherAssociationInput[];
}

export interface VoucherAssociationInput {
  includeApafa: boolean;
  studentIds: string[];
}

export interface PaymentVoucherLinks {
  voucherId: string;
  paymentId: string;
  includeApafa: boolean;
  students: Array<{
    studentId: string;
    studentName: string;
  }>;
}

export interface UpdatePaymentVoucherLinksInput {
  includeApafa: boolean;
  studentIds: string[];
}
