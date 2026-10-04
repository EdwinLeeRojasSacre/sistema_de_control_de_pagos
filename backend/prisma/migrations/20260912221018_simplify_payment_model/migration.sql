/*
  Warnings:

  - You are about to drop the column `amount` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `payer_person_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_obligation_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the `charge_campaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `charge_concepts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `charge_frequencies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `charge_units` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_methods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_obligation_students` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_obligations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `student_concept_enrollments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id,school_period_id,family_group_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `family_group_id` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `school_period_id` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "sgpe"."charge_campaigns" DROP CONSTRAINT "fk_campaign_concept";

-- DropForeignKey
ALTER TABLE "sgpe"."charge_campaigns" DROP CONSTRAINT "fk_campaign_period";

-- DropForeignKey
ALTER TABLE "sgpe"."charge_concepts" DROP CONSTRAINT "fk_charge_frequency";

-- DropForeignKey
ALTER TABLE "sgpe"."charge_concepts" DROP CONSTRAINT "fk_charge_unit";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligation_students" DROP CONSTRAINT "fk_pos_obligation";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligation_students" DROP CONSTRAINT "fk_pos_student";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligations" DROP CONSTRAINT "fk_po_campaign";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligations" DROP CONSTRAINT "fk_po_concept";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligations" DROP CONSTRAINT "fk_po_family";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligations" DROP CONSTRAINT "fk_po_period";

-- DropForeignKey
ALTER TABLE "sgpe"."payment_obligations" DROP CONSTRAINT "fk_po_student";

-- DropForeignKey
ALTER TABLE "sgpe"."payments" DROP CONSTRAINT "fk_payment_method";

-- DropForeignKey
ALTER TABLE "sgpe"."payments" DROP CONSTRAINT "fk_payment_obligation";

-- DropForeignKey
ALTER TABLE "sgpe"."payments" DROP CONSTRAINT "fk_payment_person";

-- DropForeignKey
ALTER TABLE "sgpe"."student_concept_enrollments" DROP CONSTRAINT "fk_sce_concept";

-- DropForeignKey
ALTER TABLE "sgpe"."student_concept_enrollments" DROP CONSTRAINT "fk_sce_period";

-- DropForeignKey
ALTER TABLE "sgpe"."student_concept_enrollments" DROP CONSTRAINT "fk_sce_student";

-- DropIndex
DROP INDEX "sgpe"."idx_payments_obligation";

-- AlterTable
ALTER TABLE "sgpe"."payments" DROP COLUMN "amount",
DROP COLUMN "payer_person_id",
DROP COLUMN "payment_method_id",
DROP COLUMN "payment_obligation_id",
ADD COLUMN     "family_group_id" UUID NOT NULL,
ADD COLUMN     "school_period_id" UUID NOT NULL,
ALTER COLUMN "payment_date" SET DATA TYPE DATE;

-- DropTable
DROP TABLE "sgpe"."charge_campaigns";

-- DropTable
DROP TABLE "sgpe"."charge_concepts";

-- DropTable
DROP TABLE "sgpe"."charge_frequencies";

-- DropTable
DROP TABLE "sgpe"."charge_units";

-- DropTable
DROP TABLE "sgpe"."payment_methods";

-- DropTable
DROP TABLE "sgpe"."payment_obligation_students";

-- DropTable
DROP TABLE "sgpe"."payment_obligations";

-- DropTable
DROP TABLE "sgpe"."student_concept_enrollments";

-- CreateTable
CREATE TABLE "sgpe"."payment_family_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "school_period_id" UUID NOT NULL,
    "family_group_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_family_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."payment_student_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "school_period_id" UUID NOT NULL,
    "family_group_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_student_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_payment_family_items_payment" ON "sgpe"."payment_family_items"("payment_id");

-- CreateIndex
CREATE INDEX "idx_payment_family_items_family" ON "sgpe"."payment_family_items"("family_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_apafa_period_family" ON "sgpe"."payment_family_items"("school_period_id", "family_group_id");

-- CreateIndex
CREATE INDEX "idx_payment_student_items_payment" ON "sgpe"."payment_student_items"("payment_id");

-- CreateIndex
CREATE INDEX "idx_payment_student_items_family" ON "sgpe"."payment_student_items"("family_group_id");

-- CreateIndex
CREATE INDEX "idx_payment_student_items_student" ON "sgpe"."payment_student_items"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_taller_period_student" ON "sgpe"."payment_student_items"("school_period_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_payments_period" ON "sgpe"."payments"("school_period_id");

-- CreateIndex
CREATE INDEX "idx_payments_family" ON "sgpe"."payments"("family_group_id");

-- CreateIndex
CREATE INDEX "idx_payments_registered_by" ON "sgpe"."payments"("registered_by_user_id");

-- CreateIndex
CREATE INDEX "idx_payments_date" ON "sgpe"."payments"("payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_scope" ON "sgpe"."payments"("id", "school_period_id", "family_group_id");

-- CreateIndex
CREATE INDEX "idx_vouchers_payment" ON "sgpe"."vouchers"("payment_id");

-- AddForeignKey
ALTER TABLE "sgpe"."payments" ADD CONSTRAINT "fk_payment_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payments" ADD CONSTRAINT "fk_payment_family" FOREIGN KEY ("family_group_id") REFERENCES "sgpe"."family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_family_items" ADD CONSTRAINT "fk_payment_family_item_payment" FOREIGN KEY ("payment_id", "school_period_id", "family_group_id") REFERENCES "sgpe"."payments"("id", "school_period_id", "family_group_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_family_items" ADD CONSTRAINT "fk_payment_family_item_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_family_items" ADD CONSTRAINT "fk_payment_family_item_family" FOREIGN KEY ("family_group_id") REFERENCES "sgpe"."family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_student_items" ADD CONSTRAINT "fk_payment_student_item_payment" FOREIGN KEY ("payment_id", "school_period_id", "family_group_id") REFERENCES "sgpe"."payments"("id", "school_period_id", "family_group_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_student_items" ADD CONSTRAINT "fk_payment_student_item_period" FOREIGN KEY ("school_period_id") REFERENCES "sgpe"."school_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_student_items" ADD CONSTRAINT "fk_payment_student_item_family" FOREIGN KEY ("family_group_id") REFERENCES "sgpe"."family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."payment_student_items" ADD CONSTRAINT "fk_payment_student_item_student" FOREIGN KEY ("student_id") REFERENCES "sgpe"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
