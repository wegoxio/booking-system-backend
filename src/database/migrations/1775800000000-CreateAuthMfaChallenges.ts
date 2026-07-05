import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthMfaChallenges1775800000000
  implements MigrationInterface
{
  name = 'CreateAuthMfaChallenges1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_mfa_challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "token_jti_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "failed_attempts" integer NOT NULL DEFAULT 0,
        "ip" character varying(64),
        "user_agent" character varying(512),
        CONSTRAINT "PK_auth_mfa_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_mfa_challenges_token_jti_hash" UNIQUE ("token_jti_hash"),
        CONSTRAINT "FK_auth_mfa_challenges_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_mfa_challenges_user_id"
      ON "auth_mfa_challenges" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_mfa_challenges_expires_at"
      ON "auth_mfa_challenges" ("expires_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_mfa_challenges_used_at"
      ON "auth_mfa_challenges" ("used_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_mfa_challenges_used_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_mfa_challenges_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_mfa_challenges_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_mfa_challenges"`);
  }
}
