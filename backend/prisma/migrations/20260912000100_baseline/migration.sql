-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sgpe";

-- CreateTable
CREATE TABLE "sgpe"."audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "entity_name" VARCHAR(150) NOT NULL,
    "entity_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(100),
    "device_name" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."charge_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_period_id" UUID NOT NULL,
    "charge_concept_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "generation_scope" VARCHAR(30) NOT NULL,
    "start_date" DATE,
    "due_date" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."charge_concepts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "charge_unit_id" UUID NOT NULL,
    "charge_frequency_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "reference_amount" DECIMAL(12,2),
    "allow_partial_payment" BOOLEAN NOT NULL DEFAULT true,
    "requires_due_date" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "charge_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."charge_frequencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "charge_frequencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."charge_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "charge_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."classrooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_period_id" UUID NOT NULL,
    "education_level_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."education_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "education_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."education_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cycle_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "min_age_months" INTEGER,
    "max_age_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "school_period_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "enrollment_date" DATE NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."family_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50),
    "name" VARCHAR(200) NOT NULL,
    "observations" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."family_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_group_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "relationship_type" VARCHAR(50) NOT NULL,
    "is_guardian" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."payment_obligation_students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_obligation_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "coverage_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_obligation_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."payment_obligations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "charge_campaign_id" UUID NOT NULL,
    "school_period_id" UUID NOT NULL,
    "charge_concept_id" UUID NOT NULL,
    "family_group_id" UUID,
    "student_id" UUID,
    "due_date" DATE,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_obligation_id" UUID NOT NULL,
    "payer_person_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "registered_by_user_id" UUID NOT NULL,
    "payment_date" TIMESTAMP(6) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "operation_number" VARCHAR(100),
    "observations" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."persons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_type" VARCHAR(20) NOT NULL,
    "document_number" VARCHAR(20),
    "first_name" VARCHAR(150) NOT NULL,
    "last_name_father" VARCHAR(150),
    "last_name_mother" VARCHAR(150),
    "birth_date" DATE,
    "gender" VARCHAR(20),
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."school_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."student_concept_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "charge_concept_id" UUID NOT NULL,
    "school_period_id" UUID NOT NULL,
    "enrollment_date" DATE NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "status" VARCHAR(30) NOT NULL,
    "observations" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_concept_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."student_person_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "relationship_type" VARCHAR(50) NOT NULL,
    "is_guardian" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_person_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "student_code" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "last_login" TIMESTAMP(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "physical_name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" VARCHAR(100),
    "file_size" BIGINT,
    "file_hash" TEXT,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."document_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_type" VARCHAR(50) NOT NULL,
    "period_year" INTEGER NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "sgpe"."audit_logs"("entity_name", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "charge_concepts_code_key" ON "sgpe"."charge_concepts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "charge_frequencies_code_key" ON "sgpe"."charge_frequencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "charge_units_code_key" ON "sgpe"."charge_units"("code");

-- CreateIndex
CREATE INDEX "idx_classrooms_period" ON "sgpe"."classrooms"("school_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_classroom" ON "sgpe"."classrooms"("school_period_id", "education_level_id", "shift_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "education_cycles_code_key" ON "sgpe"."education_cycles"("code");

-- CreateIndex
CREATE INDEX "idx_enrollments_student" ON "sgpe"."enrollments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment" ON "sgpe"."enrollments"("student_id", "school_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_groups_code_key" ON "sgpe"."family_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_family_member" ON "sgpe"."family_members"("family_group_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "sgpe"."payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_obligation_student" ON "sgpe"."payment_obligation_students"("payment_obligation_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_payment_obligation_family" ON "sgpe"."payment_obligations"("family_group_id");

-- CreateIndex
CREATE INDEX "idx_payment_obligation_period" ON "sgpe"."payment_obligations"("school_period_id");

-- CreateIndex
CREATE INDEX "idx_payment_obligation_student" ON "sgpe"."payment_obligations"("student_id");

-- CreateIndex
CREATE INDEX "idx_payments_obligation" ON "sgpe"."payments"("payment_obligation_id");

-- CreateIndex
CREATE INDEX "idx_person_document" ON "sgpe"."persons"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_person_document" ON "sgpe"."persons"("document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "sgpe"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "school_periods_year_key" ON "sgpe"."school_periods"("year");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_code_key" ON "sgpe"."shifts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_concept" ON "sgpe"."student_concept_enrollments"("student_id", "charge_concept_id", "school_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_person_relation" ON "sgpe"."student_person_relationships"("student_id", "person_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "students_person_id_key" ON "sgpe"."students"("person_id");

-- CreateIndex
CREATE INDEX "idx_students_person" ON "sgpe"."students"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "sgpe"."users"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "sgpe"."users"("username");

-- CreateIndex
CREATE INDEX "idx_document_sequences_type_year" ON "sgpe"."document_sequences"("document_type", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "uq_document_sequence" ON "sgpe"."document_sequences"("document_type", "period_year");

-- AddForeignKey
ALTER TABLE "sgpe"."audit_logs" ADD CONSTRAINT "fk_audit_user" FOREIGN KEY ("user_id") REFERENCES "sgpe"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."charge_campaigns" ADD CONSTRAINT "fk_campaign_concept" FOREIGN KEY ("charge_concept_id") REFERENCES "sgpe"."charge_concepts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."charge_campaigns" ADD CONSTRAINT "fk_campaign_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."charge_concepts" ADD CONSTRAINT "fk_charge_frequency" FOREIGN KEY ("charge_frequency_id") REFERENCES "sgpe"."charge_frequencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."charge_concepts" ADD CONSTRAINT "fk_charge_unit" FOREIGN KEY ("charge_unit_id") REFERENCES "sgpe"."charge_units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."classrooms" ADD CONSTRAINT "fk_classroom_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."classrooms" ADD CONSTRAINT "fk_classroom_level" FOREIGN KEY ("education_level_id") REFERENCES "sgpe"."education_levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."classrooms" ADD CONSTRAINT "fk_classroom_shift" FOREIGN KEY ("shift_id") REFERENCES "sgpe"."shifts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."education_levels" ADD CONSTRAINT "fk_level_cycle" FOREIGN KEY ("cycle_id") REFERENCES "sgpe"."education_cycles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."enrollments" ADD CONSTRAINT "fk_enrollment_classroom" FOREIGN KEY ("classroom_id") REFERENCES "sgpe"."classrooms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."enrollments" ADD CONSTRAINT "fk_enrollment_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."enrollments" ADD CONSTRAINT "fk_enrollment_student" FOREIGN KEY ("student_id") REFERENCES "sgpe"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."family_members" ADD CONSTRAINT "fk_family_member_family" FOREIGN KEY ("family_group_id") REFERENCES "sgpe"."family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."family_members" ADD CONSTRAINT "fk_family_member_person" FOREIGN KEY ("person_id") REFERENCES "sgpe"."persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligation_students" ADD CONSTRAINT "fk_pos_obligation" FOREIGN KEY ("payment_obligation_id") REFERENCES "sgpe"."payment_obligations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligation_students" ADD CONSTRAINT "fk_pos_student" FOREIGN KEY ("student_id") REFERENCES "sgpe"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligations" ADD CONSTRAINT "fk_po_campaign" FOREIGN KEY ("charge_campaign_id") REFERENCES "sgpe"."charge_campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligations" ADD CONSTRAINT "fk_po_concept" FOREIGN KEY ("charge_concept_id") REFERENCES "sgpe"."charge_concepts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligations" ADD CONSTRAINT "fk_po_family" FOREIGN KEY ("family_group_id") REFERENCES "sgpe"."family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligations" ADD CONSTRAINT "fk_po_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_obligations" ADD CONSTRAINT "fk_po_student" FOREIGN KEY ("student_id") REFERENCES "sgpe"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payments" ADD CONSTRAINT "fk_payment_method" FOREIGN KEY ("payment_method_id") REFERENCES "sgpe"."payment_methods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payments" ADD CONSTRAINT "fk_payment_obligation" FOREIGN KEY ("payment_obligation_id") REFERENCES "sgpe"."payment_obligations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payments" ADD CONSTRAINT "fk_payment_person" FOREIGN KEY ("payer_person_id") REFERENCES "sgpe"."persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payments" ADD CONSTRAINT "fk_payment_user" FOREIGN KEY ("registered_by_user_id") REFERENCES "sgpe"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."student_concept_enrollments" ADD CONSTRAINT "fk_sce_concept" FOREIGN KEY ("charge_concept_id") REFERENCES "sgpe"."charge_concepts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."student_concept_enrollments" ADD CONSTRAINT "fk_sce_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."student_concept_enrollments" ADD CONSTRAINT "fk_sce_student" FOREIGN KEY ("student_id") REFERENCES "sgpe"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."student_person_relationships" ADD CONSTRAINT "fk_spr_person" FOREIGN KEY ("person_id") REFERENCES "sgpe"."persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."student_person_relationships" ADD CONSTRAINT "fk_spr_student" FOREIGN KEY ("student_id") REFERENCES "sgpe"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."students" ADD CONSTRAINT "fk_student_person" FOREIGN KEY ("person_id") REFERENCES "sgpe"."persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."users" ADD CONSTRAINT "fk_users_person" FOREIGN KEY ("person_id") REFERENCES "sgpe"."persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."users" ADD CONSTRAINT "fk_users_role" FOREIGN KEY ("role_id") REFERENCES "sgpe"."roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."vouchers" ADD CONSTRAINT "fk_voucher_payment" FOREIGN KEY ("payment_id") REFERENCES "sgpe"."payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
