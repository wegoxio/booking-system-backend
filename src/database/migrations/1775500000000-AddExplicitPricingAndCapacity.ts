import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExplicitPricingAndCapacity1775500000000
  implements MigrationInterface
{
  name = 'AddExplicitPricingAndCapacity1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "services" ADD "min_party_size" integer`);
    await queryRunner.query(`ALTER TABLE "services" ADD "max_party_size" integer`);
    await queryRunner.query(`ALTER TABLE "services" ADD "slot_capacity" integer`);
    await queryRunner.query(
      `ALTER TABLE "services" ADD "pricing_model" character varying(16)`,
    );
    await queryRunner.query(`
      UPDATE "services"
      SET "min_party_size" = GREATEST(COALESCE("min_capacity", 1), 1),
          "max_party_size" = GREATEST(COALESCE("max_capacity", "capacity", 1), COALESCE("min_capacity", 1), 1),
          "slot_capacity" = GREATEST(COALESCE("capacity", 1), COALESCE("max_capacity", 1), 1),
          "pricing_model" = 'FLAT'
    `);
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "min_party_size" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "max_party_size" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "slot_capacity" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "pricing_model" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "min_party_size" SET DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "max_party_size" SET DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "slot_capacity" SET DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "pricing_model" SET DEFAULT 'FLAT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "CHK_services_explicit_capacity" CHECK ("min_party_size" >= 1 AND "max_party_size" >= "min_party_size" AND "slot_capacity" >= "max_party_size" AND "slot_capacity" <= 100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "CHK_services_pricing_model" CHECK ("pricing_model" IN ('FLAT', 'PER_PERSON'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD "pricing_model_snapshot" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD "unit_price_snapshot" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD "quantity_snapshot" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD "line_total_snapshot" numeric(12,2)`,
    );
    await queryRunner.query(`
      UPDATE "booking_items" item
      SET "pricing_model_snapshot" = 'FLAT',
          "unit_price_snapshot" = item."price_snapshot",
          "quantity_snapshot" = booking."party_size",
          "line_total_snapshot" = booking."total_price"
      FROM "bookings" booking
      WHERE booking."id" = item."booking_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "booking_items" ALTER COLUMN "pricing_model_snapshot" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ALTER COLUMN "unit_price_snapshot" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ALTER COLUMN "quantity_snapshot" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ALTER COLUMN "line_total_snapshot" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ALTER COLUMN "pricing_model_snapshot" SET DEFAULT 'FLAT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ALTER COLUMN "quantity_snapshot" SET DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD CONSTRAINT "CHK_booking_items_pricing_model" CHECK ("pricing_model_snapshot" IN ('FLAT', 'PER_PERSON'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD CONSTRAINT "CHK_booking_items_quantity" CHECK ("quantity_snapshot" >= 1)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_employee_status_session" ON "bookings" ("tenant_id", "employee_id", "status", "start_at_utc", "end_at_utc")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_bookings_tenant_employee_status_session"`);
    await queryRunner.query(`ALTER TABLE "booking_items" DROP CONSTRAINT "CHK_booking_items_quantity"`);
    await queryRunner.query(`ALTER TABLE "booking_items" DROP CONSTRAINT "CHK_booking_items_pricing_model"`);
    await queryRunner.query(`ALTER TABLE "booking_items" DROP COLUMN "line_total_snapshot"`);
    await queryRunner.query(`ALTER TABLE "booking_items" DROP COLUMN "quantity_snapshot"`);
    await queryRunner.query(`ALTER TABLE "booking_items" DROP COLUMN "unit_price_snapshot"`);
    await queryRunner.query(`ALTER TABLE "booking_items" DROP COLUMN "pricing_model_snapshot"`);
    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "CHK_services_pricing_model"`);
    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "CHK_services_explicit_capacity"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "pricing_model"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "slot_capacity"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "max_party_size"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "min_party_size"`);
  }
}
