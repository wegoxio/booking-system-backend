import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenBookingIntegrity1775400000000 implements MigrationInterface {
  name = 'HardenBookingIntegrity1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "idempotency_key" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "busy_start_at_utc" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "busy_end_at_utc" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`
      UPDATE "bookings" booking
      SET
        "busy_start_at_utc" = booking."start_at_utc" - make_interval(mins => COALESCE(item."buffer_before_minutes_snapshot", 0)),
        "busy_end_at_utc" = booking."start_at_utc" + make_interval(mins => COALESCE(item."buffer_before_minutes_snapshot", 0) + item."duration_minutes_snapshot" + COALESCE(item."buffer_after_minutes_snapshot", 0)),
        "end_at_utc" = booking."start_at_utc" + make_interval(mins => item."duration_minutes_snapshot"),
        "total_duration_minutes" = item."duration_minutes_snapshot"
      FROM "booking_items" item
      WHERE item."booking_id" = booking."id" AND item."sort_order" = 0
    `);
    await queryRunner.query(
      `UPDATE "bookings" SET "busy_start_at_utc" = "start_at_utc", "busy_end_at_utc" = "end_at_utc" WHERE "busy_start_at_utc" IS NULL OR "busy_end_at_utc" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "busy_start_at_utc" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "busy_end_at_utc" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_busy_time_order" CHECK ("busy_end_at_utc" > "busy_start_at_utc")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_service_within_busy_range" CHECK ("start_at_utc" >= "busy_start_at_utc" AND "end_at_utc" <= "busy_end_at_utc")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_status" CHECK ("status" IN ('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_source" CHECK ("source" IN ('ADMIN','WEB','API','MANUAL'))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bookings_tenant_idempotency_key" ON "bookings" ("tenant_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_employee_status_busy_range" ON "bookings" ("tenant_id", "employee_id", "status", "busy_start_at_utc", "busy_end_at_utc")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_tenant_employee_status_busy_range"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_bookings_tenant_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_service_within_busy_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_busy_time_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "busy_end_at_utc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "busy_start_at_utc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "idempotency_key"`,
    );
  }
}
