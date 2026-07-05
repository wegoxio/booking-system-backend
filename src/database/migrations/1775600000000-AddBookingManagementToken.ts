import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingManagementToken1775600000000
  implements MigrationInterface
{
  name = 'AddBookingManagementToken1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "management_token_hash" character varying(128),
      ADD COLUMN IF NOT EXISTS "management_token_expires_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bookings_management_token_hash"
      ON "bookings" ("management_token_hash")
      WHERE "management_token_hash" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_management_token_expires_at"
      ON "bookings" ("management_token_expires_at")
      WHERE "management_token_expires_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_bookings_management_token_expires_at"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_bookings_management_token_hash"
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "management_token_expires_at",
      DROP COLUMN IF EXISTS "management_token_hash"
    `);
  }
}
