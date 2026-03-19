import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingReminders1774500000000
  implements MigrationInterface
{
  name = 'CreateBookingReminders1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "booking_reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "tenant_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "audience" character varying(20) NOT NULL,
        "channel" character varying(20) NOT NULL DEFAULT 'EMAIL',
        "type" character varying(40) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "target_email" character varying(255) NOT NULL,
        "scheduled_for_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
        "attempts_count" integer NOT NULL DEFAULT 0,
        "last_attempt_at" TIMESTAMP WITH TIME ZONE,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE,
        "processing_started_at" TIMESTAMP WITH TIME ZONE,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        CONSTRAINT "PK_booking_reminders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booking_reminders_delivery" UNIQUE ("booking_id", "audience", "type", "channel"),
        CONSTRAINT "FK_booking_reminders_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_booking_reminders_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_booking_reminders_booking_id" ON "booking_reminders" ("booking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_reminders_tenant_id" ON "booking_reminders" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_reminders_status_scheduled_for" ON "booking_reminders" ("status", "scheduled_for_utc")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_reminders_status_next_attempt" ON "booking_reminders" ("status", "next_attempt_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_reminders_status_next_attempt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_reminders_status_scheduled_for"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_reminders_tenant_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_reminders_booking_id"`,
    );
    await queryRunner.query(`DROP TABLE "booking_reminders"`);
  }
}
