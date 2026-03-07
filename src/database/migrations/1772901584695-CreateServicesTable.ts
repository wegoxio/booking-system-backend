import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateServicesTable1772901584695 implements MigrationInterface {
    name = 'CreateServicesTable1772901584695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "duration_minutes" integer NOT NULL, "buffer_before_minutes" integer NOT NULL DEFAULT '0', "buffer_after_minutes" integer NOT NULL DEFAULT '0', "capacity" integer NOT NULL DEFAULT '1', "price" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "requires_confirmation" boolean NOT NULL DEFAULT false, "min_notice_minutes" integer NOT NULL DEFAULT '0', "booking_window_days" integer NOT NULL DEFAULT '60', CONSTRAINT "UQ_services_tenant_name" UNIQUE ("tenant_id", "name"), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_services_tenant_id" ON "services" ("tenant_id") `);
        await queryRunner.query(`ALTER TABLE "services" ADD CONSTRAINT "FK_847c3b57ab049376d3380329a9c" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "FK_847c3b57ab049376d3380329a9c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_services_tenant_id"`);
        await queryRunner.query(`DROP TABLE "services"`);
    }

}
