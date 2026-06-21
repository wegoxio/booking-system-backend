import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateBukkyDefaultPalette1775000000000 implements MigrationInterface {
  name = 'UpdateBukkyDefaultPalette1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "platform_settings"
      SET
        "primary_color" = '#9759ef',
        "secondary_color" = '#e9e9ed',
        "tertiary_color" = '#1e1e1e',
        "primary_hover_color" = '#844ed2',
        "secondary_hover_color" = '#ececef',
        "tertiary_hover_color" = '#3d3d3d',
        "text_primary_color" = '#2f3543',
        "text_secondary_color" = '#2d313b',
        "text_tertiary_color" = '#6f7380',
        "app_name" = 'Bukky',
        "window_title" = 'Bukky Booking System',
        "logo_url" = '/bukky-logo.svg'
      WHERE
        "scope" = 'WEGOX'
        AND "primary_color" = '#efc35f'
        AND "secondary_color" = '#e9e9ed'
        AND "tertiary_color" = '#5f6470'
        AND "primary_hover_color" = '#d6ad50'
        AND "secondary_hover_color" = '#ececef'
        AND "tertiary_hover_color" = '#4a4f5b'
        AND "text_primary_color" = '#2f3543'
        AND "text_secondary_color" = '#2d313b'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "platform_settings"
      SET
        "primary_color" = '#efc35f',
        "secondary_color" = '#e9e9ed',
        "tertiary_color" = '#5f6470',
        "primary_hover_color" = '#d6ad50',
        "secondary_hover_color" = '#ececef',
        "tertiary_hover_color" = '#4a4f5b',
        "text_primary_color" = '#2f3543',
        "text_secondary_color" = '#2d313b',
        "text_tertiary_color" = '#6f7380',
        "app_name" = 'wegox',
        "window_title" = 'Wegox Booking System',
        "logo_url" = '/wegox-logo.svg'
      WHERE
        "scope" = 'WEGOX'
        AND "primary_color" = '#9759ef'
        AND "secondary_color" = '#e9e9ed'
        AND "tertiary_color" = '#1e1e1e'
        AND "primary_hover_color" = '#844ed2'
        AND "secondary_hover_color" = '#ececef'
        AND "tertiary_hover_color" = '#3d3d3d'
        AND "text_primary_color" = '#2f3543'
        AND "text_secondary_color" = '#2d313b'
    `);
  }
}
