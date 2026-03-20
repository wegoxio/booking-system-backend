import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportingIndexes1774700000000 implements MigrationInterface {
  name = 'AddReportingIndexes1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_status_start" ON "bookings" ("tenant_id", "status", "start_at_utc")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_source_start" ON "bookings" ("tenant_id", "source", "start_at_utc")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_items_booking_service" ON "booking_items" ("booking_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_items_service_booking" ON "booking_items" ("service_id", "booking_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_items_service_booking"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_items_booking_service"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_tenant_source_start"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_tenant_status_start"`,
    );
  }
}
