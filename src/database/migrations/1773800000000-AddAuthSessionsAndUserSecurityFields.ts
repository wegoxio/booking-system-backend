import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSessionsAndUserSecurityFields1773800000000
  implements MigrationInterface
{
  name = 'AddAuthSessionsAndUserSecurityFields1773800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "failed_login_attempts" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_failed_login_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "locked_until" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_login_at" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_jti" uuid NOT NULL, "refresh_token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revocation_reason" character varying(40), "replaced_by_session_id" uuid, "ip" character varying(64), "user_agent" character varying(512), "last_used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_auth_sessions_token_jti" UNIQUE ("token_jti"), CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_expires_at" ON "auth_sessions" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_revoked_at" ON "auth_sessions" ("revoked_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_user_revoked_expires" ON "auth_sessions" ("user_id", "revoked_at", "expires_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_auth_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_auth_sessions_replaced_by" FOREIGN KEY ("replaced_by_session_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_auth_sessions_replaced_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_auth_sessions_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_user_revoked_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_revoked_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "auth_sessions"`);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locked_until"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "last_failed_login_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "failed_login_attempts"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
  }
}
