import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditMessageColumn1773700000000 implements MigrationInterface {
  name = 'AddAuditMessageColumn1773700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "message" character varying(240)`,
    );
    await queryRunner.query(
      `UPDATE "audit_logs" SET "message" = INITCAP(REPLACE("action", '_', ' ')) WHERE "message" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "message"`);
  }
}

