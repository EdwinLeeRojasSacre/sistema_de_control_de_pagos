/*
  Warnings:

  - A unique constraint covering the columns `[id,payment_id]` on the table `payment_family_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,payment_id]` on the table `payment_student_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,payment_id]` on the table `vouchers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "sgpe"."voucher_family_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "voucher_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "payment_family_item_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_family_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgpe"."voucher_student_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "voucher_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "payment_student_item_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_student_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_voucher_family_items_voucher" ON "sgpe"."voucher_family_items"("voucher_id");

-- CreateIndex
CREATE INDEX "idx_voucher_family_items_item" ON "sgpe"."voucher_family_items"("payment_family_item_id");

-- CreateIndex
CREATE INDEX "idx_voucher_family_items_payment" ON "sgpe"."voucher_family_items"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_voucher_family_item" ON "sgpe"."voucher_family_items"("voucher_id", "payment_family_item_id");

-- CreateIndex
CREATE INDEX "idx_voucher_student_items_voucher" ON "sgpe"."voucher_student_items"("voucher_id");

-- CreateIndex
CREATE INDEX "idx_voucher_student_items_item" ON "sgpe"."voucher_student_items"("payment_student_item_id");

-- CreateIndex
CREATE INDEX "idx_voucher_student_items_payment" ON "sgpe"."voucher_student_items"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_voucher_student_item" ON "sgpe"."voucher_student_items"("voucher_id", "payment_student_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_family_item_payment_scope" ON "sgpe"."payment_family_items"("id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_student_item_payment_scope" ON "sgpe"."payment_student_items"("id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_voucher_payment_scope" ON "sgpe"."vouchers"("id", "payment_id");

-- AddForeignKey
ALTER TABLE "sgpe"."voucher_family_items" ADD CONSTRAINT "fk_voucher_family_item_voucher" FOREIGN KEY ("voucher_id", "payment_id") REFERENCES "sgpe"."vouchers"("id", "payment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."voucher_family_items" ADD CONSTRAINT "fk_voucher_family_item_family_item" FOREIGN KEY ("payment_family_item_id", "payment_id") REFERENCES "sgpe"."payment_family_items"("id", "payment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."voucher_student_items" ADD CONSTRAINT "fk_voucher_student_item_voucher" FOREIGN KEY ("voucher_id", "payment_id") REFERENCES "sgpe"."vouchers"("id", "payment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sgpe"."voucher_student_items" ADD CONSTRAINT "fk_voucher_student_item_student_item" FOREIGN KEY ("payment_student_item_id", "payment_id") REFERENCES "sgpe"."payment_student_items"("id", "payment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
