import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCsrfTokenHashToAuthSessions1773900000000
  implements MigrationInterface
{
  name = 'AddCsrfTokenHashToAuthSessions1773900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD "csrf_token_hash" character varying(64)`,
    );
    await queryRunner.query(
      `UPDATE "auth_sessions" SET "csrf_token_hash" = '' WHERE "csrf_token_hash" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ALTER COLUMN "csrf_token_hash" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP COLUMN "csrf_token_hash"`,
    );
  }
}
