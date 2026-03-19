import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualBookingServicesAndEmployeeAvatars1774600000000
  implements MigrationInterface
{
  name = 'AddManualBookingServicesAndEmployeeAvatars1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" ADD "instructions" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "avatar_url" character varying(2048)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "avatar_key" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD "instructions_snapshot" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_items" DROP COLUMN "instructions_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN "avatar_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN "avatar_url"`,
    );
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "instructions"`);
  }
}
