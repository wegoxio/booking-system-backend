import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportingAndAuditLookupIndexes1775300000000 implements MigrationInterface {
  name = 'AddReportingAndAuditLookupIndexes1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_tenant_created_at" ON "audit_logs" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor_created_at" ON "audit_logs" ("actor_user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_entity_entity_id" ON "audit_logs" ("entity", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_tenant_role_active" ON "users" ("tenant_id", "role", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_tenant_active_name" ON "employees" ("tenant_id", "is_active", "name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employees_tenant_active_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_users_tenant_role_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_entity_entity_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_actor_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_tenant_created_at"`,
    );
  }
}
