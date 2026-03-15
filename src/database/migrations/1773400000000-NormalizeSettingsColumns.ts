import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeSettingsColumns1773400000000
  implements MigrationInterface
{
  name = 'NormalizeSettingsColumns1773400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_settings"
        ADD "primary_color" character varying(9),
        ADD "secondary_color" character varying(9),
        ADD "tertiary_color" character varying(9),
        ADD "primary_hover_color" character varying(9),
        ADD "secondary_hover_color" character varying(9),
        ADD "tertiary_hover_color" character varying(9),
        ADD "text_primary_color" character varying(9),
        ADD "text_secondary_color" character varying(9),
        ADD "text_tertiary_color" character varying(9),
        ADD "app_name" character varying(120),
        ADD "window_title" character varying(160),
        ADD "logo_url" character varying(2048),
        ADD "favicon_url" character varying(2048)`,
    );

    await queryRunner.query(
      `UPDATE "tenant_settings"
        SET
          "primary_color" = COALESCE("theme"->>'primary', "theme"->>'primaryAccent', '#efc35f'),
          "secondary_color" = COALESCE("theme"->>'secondary', "theme"->>'cardBg', "theme"->>'shellBg', "theme"->>'navbarBg', '#e9e9ed'),
          "tertiary_color" = COALESCE("theme"->>'tertiary', "theme"->>'sidebarBgStart', "theme"->>'appBg', '#5f6470'),
          "primary_hover_color" = COALESCE("theme"->>'primaryHover', "theme"->>'sidebarActiveBg', "theme"->>'primaryAccent', '#d6ad50'),
          "secondary_hover_color" = COALESCE("theme"->>'secondaryHover', "theme"->>'navbarBg', "theme"->>'iconButtonBg', '#ececef'),
          "tertiary_hover_color" = COALESCE("theme"->>'tertiaryHover', "theme"->>'sidebarBgEnd', '#4a4f5b'),
          "text_primary_color" = COALESCE("theme"->>'textPrimary', "theme"->>'primaryAccentText', '#2f3543'),
          "text_secondary_color" = COALESCE("theme"->>'textSecondary', "theme"->>'textPrimary', '#2d313b'),
          "text_tertiary_color" = COALESCE("theme"->>'textTertiary', "theme"->>'textMuted', "theme"->>'iconButtonText', '#6f7380'),
          "app_name" = COALESCE("branding"->>'appName', 'wegox'),
          "window_title" = COALESCE("branding"->>'windowTitle', 'Wegox Booking System'),
          "logo_url" = COALESCE("branding"->>'logoUrl', '/wegox-logo.svg'),
          "favicon_url" = COALESCE("branding"->>'faviconUrl', '/favicon.ico')`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenant_settings"
        ALTER COLUMN "primary_color" SET NOT NULL,
        ALTER COLUMN "secondary_color" SET NOT NULL,
        ALTER COLUMN "tertiary_color" SET NOT NULL,
        ALTER COLUMN "primary_hover_color" SET NOT NULL,
        ALTER COLUMN "secondary_hover_color" SET NOT NULL,
        ALTER COLUMN "tertiary_hover_color" SET NOT NULL,
        ALTER COLUMN "text_primary_color" SET NOT NULL,
        ALTER COLUMN "text_secondary_color" SET NOT NULL,
        ALTER COLUMN "text_tertiary_color" SET NOT NULL,
        ALTER COLUMN "app_name" SET NOT NULL,
        ALTER COLUMN "window_title" SET NOT NULL,
        ALTER COLUMN "logo_url" SET NOT NULL,
        ALTER COLUMN "favicon_url" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenant_settings" DROP COLUMN "theme", DROP COLUMN "branding"`,
    );

    await queryRunner.query(
      `ALTER TABLE "platform_settings"
        ADD "primary_color" character varying(9),
        ADD "secondary_color" character varying(9),
        ADD "tertiary_color" character varying(9),
        ADD "primary_hover_color" character varying(9),
        ADD "secondary_hover_color" character varying(9),
        ADD "tertiary_hover_color" character varying(9),
        ADD "text_primary_color" character varying(9),
        ADD "text_secondary_color" character varying(9),
        ADD "text_tertiary_color" character varying(9),
        ADD "app_name" character varying(120),
        ADD "window_title" character varying(160),
        ADD "logo_url" character varying(2048),
        ADD "favicon_url" character varying(2048)`,
    );

    await queryRunner.query(
      `UPDATE "platform_settings"
        SET
          "primary_color" = COALESCE("theme"->>'primary', "theme"->>'primaryAccent', '#efc35f'),
          "secondary_color" = COALESCE("theme"->>'secondary', "theme"->>'cardBg', "theme"->>'shellBg', "theme"->>'navbarBg', '#e9e9ed'),
          "tertiary_color" = COALESCE("theme"->>'tertiary', "theme"->>'sidebarBgStart', "theme"->>'appBg', '#5f6470'),
          "primary_hover_color" = COALESCE("theme"->>'primaryHover', "theme"->>'sidebarActiveBg', "theme"->>'primaryAccent', '#d6ad50'),
          "secondary_hover_color" = COALESCE("theme"->>'secondaryHover', "theme"->>'navbarBg', "theme"->>'iconButtonBg', '#ececef'),
          "tertiary_hover_color" = COALESCE("theme"->>'tertiaryHover', "theme"->>'sidebarBgEnd', '#4a4f5b'),
          "text_primary_color" = COALESCE("theme"->>'textPrimary', "theme"->>'primaryAccentText', '#2f3543'),
          "text_secondary_color" = COALESCE("theme"->>'textSecondary', "theme"->>'textPrimary', '#2d313b'),
          "text_tertiary_color" = COALESCE("theme"->>'textTertiary', "theme"->>'textMuted', "theme"->>'iconButtonText', '#6f7380'),
          "app_name" = COALESCE("branding"->>'appName', 'wegox'),
          "window_title" = COALESCE("branding"->>'windowTitle', 'Wegox Booking System'),
          "logo_url" = COALESCE("branding"->>'logoUrl', '/wegox-logo.svg'),
          "favicon_url" = COALESCE("branding"->>'faviconUrl', '/favicon.ico')`,
    );

    await queryRunner.query(
      `ALTER TABLE "platform_settings"
        ALTER COLUMN "primary_color" SET NOT NULL,
        ALTER COLUMN "secondary_color" SET NOT NULL,
        ALTER COLUMN "tertiary_color" SET NOT NULL,
        ALTER COLUMN "primary_hover_color" SET NOT NULL,
        ALTER COLUMN "secondary_hover_color" SET NOT NULL,
        ALTER COLUMN "tertiary_hover_color" SET NOT NULL,
        ALTER COLUMN "text_primary_color" SET NOT NULL,
        ALTER COLUMN "text_secondary_color" SET NOT NULL,
        ALTER COLUMN "text_tertiary_color" SET NOT NULL,
        ALTER COLUMN "app_name" SET NOT NULL,
        ALTER COLUMN "window_title" SET NOT NULL,
        ALTER COLUMN "logo_url" SET NOT NULL,
        ALTER COLUMN "favicon_url" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN "theme", DROP COLUMN "branding"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings"
        ADD "theme" jsonb NOT NULL DEFAULT '{}',
        ADD "branding" jsonb NOT NULL DEFAULT '{}'`,
    );

    await queryRunner.query(
      `UPDATE "platform_settings"
        SET
          "theme" = jsonb_build_object(
            'primary', "primary_color",
            'secondary', "secondary_color",
            'tertiary', "tertiary_color",
            'primaryHover', "primary_hover_color",
            'secondaryHover', "secondary_hover_color",
            'tertiaryHover', "tertiary_hover_color",
            'textPrimary', "text_primary_color",
            'textSecondary', "text_secondary_color",
            'textTertiary', "text_tertiary_color"
          ),
          "branding" = jsonb_build_object(
            'appName', "app_name",
            'windowTitle', "window_title",
            'logoUrl', "logo_url",
            'faviconUrl', "favicon_url"
          )`,
    );

    await queryRunner.query(
      `ALTER TABLE "platform_settings"
        DROP COLUMN "primary_color",
        DROP COLUMN "secondary_color",
        DROP COLUMN "tertiary_color",
        DROP COLUMN "primary_hover_color",
        DROP COLUMN "secondary_hover_color",
        DROP COLUMN "tertiary_hover_color",
        DROP COLUMN "text_primary_color",
        DROP COLUMN "text_secondary_color",
        DROP COLUMN "text_tertiary_color",
        DROP COLUMN "app_name",
        DROP COLUMN "window_title",
        DROP COLUMN "logo_url",
        DROP COLUMN "favicon_url"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenant_settings"
        ADD "theme" jsonb NOT NULL DEFAULT '{}',
        ADD "branding" jsonb NOT NULL DEFAULT '{}'`,
    );

    await queryRunner.query(
      `UPDATE "tenant_settings"
        SET
          "theme" = jsonb_build_object(
            'primary', "primary_color",
            'secondary', "secondary_color",
            'tertiary', "tertiary_color",
            'primaryHover', "primary_hover_color",
            'secondaryHover', "secondary_hover_color",
            'tertiaryHover', "tertiary_hover_color",
            'textPrimary', "text_primary_color",
            'textSecondary', "text_secondary_color",
            'textTertiary', "text_tertiary_color"
          ),
          "branding" = jsonb_build_object(
            'appName', "app_name",
            'windowTitle', "window_title",
            'logoUrl', "logo_url",
            'faviconUrl', "favicon_url"
          )`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenant_settings"
        DROP COLUMN "primary_color",
        DROP COLUMN "secondary_color",
        DROP COLUMN "tertiary_color",
        DROP COLUMN "primary_hover_color",
        DROP COLUMN "secondary_hover_color",
        DROP COLUMN "tertiary_hover_color",
        DROP COLUMN "text_primary_color",
        DROP COLUMN "text_secondary_color",
        DROP COLUMN "text_tertiary_color",
        DROP COLUMN "app_name",
        DROP COLUMN "window_title",
        DROP COLUMN "logo_url",
        DROP COLUMN "favicon_url"`,
    );
  }
}
