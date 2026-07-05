import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantBusinessProfileFields1775900000000 implements MigrationInterface {
  name = 'AddTenantBusinessProfileFields1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "address_line" character varying(255),
      ADD COLUMN IF NOT EXISTS "city" character varying(120),
      ADD COLUMN IF NOT EXISTS "state" character varying(120),
      ADD COLUMN IF NOT EXISTS "country" character varying(120),
      ADD COLUMN IF NOT EXISTS "postal_code" character varying(32),
      ADD COLUMN IF NOT EXISTS "phone" character varying(40),
      ADD COLUMN IF NOT EXISTS "public_email" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "public_email",
      DROP COLUMN IF EXISTS "phone",
      DROP COLUMN IF EXISTS "postal_code",
      DROP COLUMN IF EXISTS "country",
      DROP COLUMN IF EXISTS "state",
      DROP COLUMN IF EXISTS "city",
      DROP COLUMN IF EXISTS "address_line"
    `);
  }
}
