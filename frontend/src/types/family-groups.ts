export interface SchoolPeriodOption {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
}

export interface RelationshipTypeOption {
  code: string;
  name: string;
}

export interface FamilyGroupCreateOptions {
  schoolPeriods: SchoolPeriodOption[];
  classrooms: Array<{
    id: string;
    schoolPeriodId: string;
    name: string;
    capacity: number | null;
    educationLevel: {
      id: string;
      name: string;
      cycle: { id: string; code: string; name: string };
    };
    shift: { id: string; code: string; name: string };
  }>;
  relationshipTypes: RelationshipTypeOption[];
}

export interface AdultForm {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  relationshipType: string;
  isGuardian: boolean;
}

export interface StudentForm {
  educationLevelId: string;
  classroomId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
}

export interface CreateFamilyAdultRequest {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather?: string;
  lastNameMother?: string;
  birthDate: string;
  phone?: string;
  email?: string;
  address?: string;
  relationshipType: string;
  isGuardian: boolean;
}

export interface CreateFamilyStudentRequest {
  classroomId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
}

export interface AddFamilyStudentRequest {
  schoolPeriodId: string;
  classroomId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
}

export interface CreateFamilyGroupRequest {
  schoolPeriodId: string;
  observations?: string;
  students: CreateFamilyStudentRequest[];
  adults: CreateFamilyAdultRequest[];
}

export interface PersonLookupFamily {
  familyGroupId: string;
  code: string | null;
  name: string;
  relationshipType: string;
  isGuardian: boolean;
  isActive: boolean;
}

export interface PersonLookupPerson {
  id: string;
  documentType: string;
  documentNumber: string | null;
  firstName: string;
  lastNameFather: string | null;
  lastNameMother: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface PersonLookupResponse {
  exists: boolean;
  person: PersonLookupPerson | null;
  families: PersonLookupFamily[];
  student: {
    id: string;
    isActive: boolean;
  } | null;
}

export interface FamilyGroupMemberDetail {
  id: string;
  personId: string;
  fullName: string;
  documentType: string;
  documentNumber: string | null;
  relationship: string;
  isGuardian: boolean;
}

export interface FamilyGroupDetail {
  id: string;
  code: string | null;
  name: string;
  createdAt?: string;
  observations: string | null;
  isActive: boolean;
  members: FamilyGroupMemberDetail[];
}

export interface UpdateFamilyGroupStudentRequest {
  memberId: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
}

export interface UpdateFamilyGroupAdultRequest {
  memberId?: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather?: string;
  lastNameMother?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  relationshipType: string;
  isGuardian: boolean;
}

export interface UpdateFamilyGroupRequest {
  observations?: string;
  students: UpdateFamilyGroupStudentRequest[];
  adults: UpdateFamilyGroupAdultRequest[];
}
