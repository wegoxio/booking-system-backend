import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserMfaAndSessionControls1775700000000 implements MigrationInterface {
  name = 'AddUserMfaAndSessionControls1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mfa_enabled_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "mfa_totp_secret_encrypted" text,
      ADD COLUMN IF NOT EXISTS "mfa_recovery_code_hashes" jsonb,
      ADD COLUMN IF NOT EXISTS "mfa_pending_secret_encrypted" text,
      ADD COLUMN IF NOT EXISTS "mfa_pending_expires_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "mfa_last_used_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_mfa_enabled_at"
      ON "users" ("mfa_enabled_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_mfa_enabled_at"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "mfa_last_used_at",
      DROP COLUMN IF EXISTS "mfa_pending_expires_at",
      DROP COLUMN IF EXISTS "mfa_pending_secret_encrypted",
      DROP COLUMN IF EXISTS "mfa_recovery_code_hashes",
      DROP COLUMN IF EXISTS "mfa_totp_secret_encrypted",
      DROP COLUMN IF EXISTS "mfa_enabled_at"
    `);
  }
}
