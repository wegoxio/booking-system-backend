import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantSettingsTable1773200000000
  implements MigrationInterface
{
  name = 'CreateTenantSettingsTable1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tenant_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "theme" jsonb NOT NULL DEFAULT '{}', "branding" jsonb NOT NULL DEFAULT '{}', "logo_key" character varying, "favicon_key" character varying, CONSTRAINT "UQ_tenant_settings_tenant_id" UNIQUE ("tenant_id"), CONSTRAINT "PK_tenant_settings_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_settings_tenant_id" ON "tenant_settings" ("tenant_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_settings" ADD CONSTRAINT "FK_tenant_settings_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_settings" DROP CONSTRAINT "FK_tenant_settings_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tenant_settings_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_settings"`);
  }
}
