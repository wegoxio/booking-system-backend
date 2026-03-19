import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeAuditActorNullable1774400000000
  implements MigrationInterface
{
  name = 'MakeAuditActorNullable1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "actor_user_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "actor_user_id" SET NOT NULL`,
    );
  }
}
