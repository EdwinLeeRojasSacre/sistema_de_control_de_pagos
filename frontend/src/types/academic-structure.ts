export interface AcademicPeriodOption {
  id: string;
  year: number;
  status: "PLANNED" | "OPEN" | "CLOSED";
  is_active: boolean;
}

export interface AcademicLevelOption {
  id: string;
  name: string;
  education_cycles: { id: string; code: string; name: string };
}

export interface ShiftOption {
  id: string;
  code: string;
  name: string;
}

export interface AcademicStructureOptions {
  periods: AcademicPeriodOption[];
  levels: AcademicLevelOption[];
  shifts: ShiftOption[];
}

export interface AcademicClassroom {
  id: string;
  schoolPeriodId: string;
  educationLevelId: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  shift: ShiftOption;
}

export interface AcademicLevel {
  id: string;
  name: string;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  classrooms: AcademicClassroom[];
}

export interface AcademicCycle {
  id: string;
  code: string;
  name: string;
  levels: AcademicLevel[];
}

export interface AcademicStructure {
  period: {
    id: string;
    year: number;
    status: "PLANNED" | "OPEN" | "CLOSED";
    isActive: boolean;
    isReadOnly: boolean;
  };
  cycles: AcademicCycle[];
}

export interface CreateClassroomRequest {
  schoolPeriodId: string;
  educationLevelId: string;
  shiftId: string;
  name: string;
  capacity?: number;
}
