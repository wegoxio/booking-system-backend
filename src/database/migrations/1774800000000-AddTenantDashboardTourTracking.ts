import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantDashboardTourTracking1774800000000
  implements MigrationInterface
{
  name = 'AddTenantDashboardTourTracking1774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "tenant_dashboard_tour_completed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "tenant_dashboard_tour_completed_at"`,
    );
  }
}
