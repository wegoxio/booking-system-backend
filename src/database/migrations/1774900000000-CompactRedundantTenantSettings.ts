import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompactRedundantTenantSettings1774900000000 implements MigrationInterface {
  name = 'CompactRedundantTenantSettings1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "tenant_settings" ts
      USING "platform_settings" ps
      WHERE
        ps."scope" = 'WEGOX'
        AND ts."logo_key" IS NULL
        AND ts."favicon_key" IS NULL
        AND ts."primary_color" = ps."primary_color"
        AND ts."secondary_color" = ps."secondary_color"
        AND ts."tertiary_color" = ps."tertiary_color"
        AND ts."primary_hover_color" = ps."primary_hover_color"
        AND ts."secondary_hover_color" = ps."secondary_hover_color"
        AND ts."tertiary_hover_color" = ps."tertiary_hover_color"
        AND ts."text_primary_color" = ps."text_primary_color"
        AND ts."text_secondary_color" = ps."text_secondary_color"
        AND ts."text_tertiary_color" = ps."text_tertiary_color"
        AND ts."theme_mode" = ps."theme_mode"
        AND COALESCE(ts."theme_overrides", '{}'::jsonb) = COALESCE(ps."theme_overrides", '{}'::jsonb)
        AND ts."app_name" = ps."app_name"
        AND ts."window_title" = ps."window_title"
        AND ts."logo_url" = ps."logo_url"
        AND ts."favicon_url" = ps."favicon_url"
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op. Deleted redundant rows cannot be restored safely.
  }
}
