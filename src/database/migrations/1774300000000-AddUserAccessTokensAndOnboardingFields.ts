import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAccessTokensAndOnboardingFields1774300000000
  implements MigrationInterface
{
  name = 'AddUserAccessTokensAndOnboardingFields1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "invited_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "onboarding_completed_at" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_access_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "type" character varying(40) NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "email_snapshot" character varying(255) NOT NULL,
        "requested_by_user_id" uuid,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "consumed_at" TIMESTAMP WITH TIME ZONE,
        "invalidated_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        CONSTRAINT "PK_user_access_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_access_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_access_tokens_requested_by_user" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_access_tokens_token_hash" ON "user_access_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_access_tokens_user_id" ON "user_access_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_access_tokens_type" ON "user_access_tokens" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_access_tokens_consumed_at" ON "user_access_tokens" ("consumed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_access_tokens_invalidated_at" ON "user_access_tokens" ("invalidated_at")`,
    );

    await queryRunner.query(`
      UPDATE "users"
      SET
        "email_verified_at" = CASE
          WHEN "password_hash" IS NOT NULL THEN COALESCE("email_verified_at", now())
          ELSE "email_verified_at"
        END,
        "invited_at" = CASE
          WHEN "role" = 'TENANT_ADMIN' THEN COALESCE("invited_at", "created_at")
          ELSE "invited_at"
        END,
        "onboarding_completed_at" = CASE
          WHEN "password_hash" IS NOT NULL THEN COALESCE("onboarding_completed_at", now())
          ELSE "onboarding_completed_at"
        END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_access_tokens_invalidated_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_access_tokens_consumed_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_access_tokens_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_access_tokens_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_access_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE "user_access_tokens"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "onboarding_completed_at"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "invited_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
  }
}
