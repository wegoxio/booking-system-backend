import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceCapacityRangeAndBookingPartySize1775100000000 implements MigrationInterface {
  name = 'AddServiceCapacityRangeAndBookingPartySize1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" ADD "min_capacity" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD "max_capacity" integer`,
    );
    await queryRunner.query(
      `UPDATE "services" SET "min_capacity" = 1, "max_capacity" = GREATEST(COALESCE("capacity", 1), 1)`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "min_capacity" SET DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "max_capacity" SET DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "min_capacity" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "max_capacity" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "CHK_services_capacity_range" CHECK ("min_capacity" >= 1 AND "max_capacity" >= "min_capacity" AND "max_capacity" <= 100)`,
    );
    await queryRunner.query(
      `UPDATE "services" SET "capacity" = "max_capacity" WHERE "capacity" IS DISTINCT FROM "max_capacity"`,
    );

    await queryRunner.query(`ALTER TABLE "bookings" ADD "party_size" integer`);
    await queryRunner.query(`UPDATE "bookings" SET "party_size" = 1`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "party_size" SET DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "party_size" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_party_size_range" CHECK ("party_size" >= 1 AND "party_size" <= 100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_party_size_range"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "party_size"`);

    await queryRunner.query(
      `ALTER TABLE "services" DROP CONSTRAINT "CHK_services_capacity_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" DROP COLUMN "max_capacity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" DROP COLUMN "min_capacity"`,
    );
  }
}
