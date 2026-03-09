import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeesAndServiceEmployees1773000000000
  implements MigrationInterface
{
  name = 'AddEmployeesAndServiceEmployees1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(30), "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_employees_tenant_email" UNIQUE ("tenant_id", "email"), CONSTRAINT "PK_b9531a98350ce6f19bf77f7e6cc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_tenant_id" ON "employees" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "service_employees" ("service_id" uuid NOT NULL, "employee_id" uuid NOT NULL, CONSTRAINT "PK_service_employees" PRIMARY KEY ("service_id", "employee_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_service_employees_service_id" ON "service_employees" ("service_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_service_employees_employee_id" ON "service_employees" ("employee_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_employees_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_employees" ADD CONSTRAINT "FK_service_employees_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_employees" ADD CONSTRAINT "FK_service_employees_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_employees" DROP CONSTRAINT "FK_service_employees_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_employees" DROP CONSTRAINT "FK_service_employees_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_employees_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_service_employees_employee_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_service_employees_service_id"`,
    );
    await queryRunner.query(`DROP TABLE "service_employees"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_employees_tenant_id"`);
    await queryRunner.query(`DROP TABLE "employees"`);
  }
}
