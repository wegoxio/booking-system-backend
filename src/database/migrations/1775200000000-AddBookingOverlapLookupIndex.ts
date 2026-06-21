import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingOverlapLookupIndex1775200000000 implements MigrationInterface {
  name = 'AddBookingOverlapLookupIndex1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_employee_status_range" ON "bookings" ("tenant_id", "employee_id", "status", "start_at_utc", "end_at_utc")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_tenant_employee_status_range"`,
    );
  }
}
