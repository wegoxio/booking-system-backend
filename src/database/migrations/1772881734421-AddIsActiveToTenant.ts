import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsActiveToTenant1772881734421 implements MigrationInterface {
    name = 'AddIsActiveToTenant1772881734421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenants" RENAME COLUMN "status" TO "is_active"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "is_active"`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "is_active" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "is_active"`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "is_active" character varying NOT NULL DEFAULT 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "tenants" RENAME COLUMN "is_active" TO "status"`);
    }

}
