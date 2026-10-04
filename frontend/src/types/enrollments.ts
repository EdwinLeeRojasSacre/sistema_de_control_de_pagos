export interface EnrollmentStudent {
  id: string;
  code: string | null;
  documentType: string;
  documentNumber: string | null;
  firstName: string;
  lastNameFather: string | null;
  lastNameMother: string | null;
  fullName: string;
}

export interface EnrollmentClassroom {
  id: string;
  name: string;
  capacity: number | null;
  shift: { id: string; code: string; name: string };
  educationLevel: {
    id: string;
    name: string;
    cycle: { id: string; code: string; name: string };
  };
}

export interface Enrollment {
  id: string;
  enrollmentDate: string;
  status: string;
  isHistorical: boolean;
  canChangeClassroom: boolean;
  student: EnrollmentStudent;
  schoolPeriod: { id: string; year: number; status: string };
  classroom: EnrollmentClassroom;
}

export interface EnrollmentClassroomOption extends EnrollmentClassroom {
  schoolPeriodId: string;
  educationLevel: EnrollmentClassroom['educationLevel'] & {
    minAgeMonths: number | null;
    maxAgeMonths: number | null;
  };
}

export interface EnrollmentOptions {
  schoolPeriods: Array<{
    id: string;
    year: number;
    status: string;
    startDate: string;
    endDate: string;
  }>;
  classrooms: EnrollmentClassroomOption[];
}

export interface StudentListItem {
  id: string;
  studentCode: string | null;
  documentNumber: string | null;
  fullName: string;
  birthDate: string | null;
  isActive: boolean;
}
