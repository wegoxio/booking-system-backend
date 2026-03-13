import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformSettingsTable1773300000000
  implements MigrationInterface
{
  name = 'CreatePlatformSettingsTable1773300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "platform_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scope" character varying NOT NULL DEFAULT 'WEGOX', "theme" jsonb NOT NULL DEFAULT '{}', "branding" jsonb NOT NULL DEFAULT '{}', "logo_key" character varying, "favicon_key" character varying, CONSTRAINT "UQ_platform_settings_scope" UNIQUE ("scope"), CONSTRAINT "PK_platform_settings_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_settings_scope" ON "platform_settings" ("scope") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_settings_scope"`,
    );
    await queryRunner.query(`DROP TABLE "platform_settings"`);
  }
}
