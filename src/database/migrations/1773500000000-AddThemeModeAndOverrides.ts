import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThemeModeAndOverrides1773500000000
  implements MigrationInterface
{
  name = 'AddThemeModeAndOverrides1773500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_settings"
        ADD "theme_mode" character varying(16) NOT NULL DEFAULT 'AUTO',
        ADD "theme_overrides" jsonb NOT NULL DEFAULT '{}'`,
    );

    await queryRunner.query(
      `ALTER TABLE "platform_settings"
        ADD "theme_mode" character varying(16) NOT NULL DEFAULT 'AUTO',
        ADD "theme_overrides" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings"
        DROP COLUMN "theme_overrides",
        DROP COLUMN "theme_mode"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenant_settings"
        DROP COLUMN "theme_overrides",
        DROP COLUMN "theme_mode"`,
    );
  }
}
