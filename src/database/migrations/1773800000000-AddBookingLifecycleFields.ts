import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingLifecycleFields1773800000000
  implements MigrationInterface
{
  name = 'AddBookingLifecycleFields1773800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "completed_at_utc" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "completed_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "cancelled_at_utc" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "cancelled_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_completed_by_user" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_cancelled_by_user" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_cancelled_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_completed_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "cancellation_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "cancelled_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "cancelled_at_utc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "completed_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "completed_at_utc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT`,
    );
  }
}
