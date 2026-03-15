import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingsAndEmployeeSchedules1773600000000
  implements MigrationInterface
{
  name = 'CreateBookingsAndEmployeeSchedules1773600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "schedule_timezone" character varying(64) NOT NULL DEFAULT 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "slot_interval_minutes" integer NOT NULL DEFAULT '15'`,
    );

    await queryRunner.query(
      `CREATE TABLE "employee_schedule_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "day_of_week" smallint NOT NULL, "start_time_local" TIME NOT NULL, "end_time_local" TIME NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_employee_schedule_rules_day_of_week" CHECK ("day_of_week" >= 0 AND "day_of_week" <= 6), CONSTRAINT "CHK_employee_schedule_rules_time_order" CHECK ("end_time_local" > "start_time_local"), CONSTRAINT "UQ_employee_schedule_rule" UNIQUE ("tenant_id", "employee_id", "day_of_week", "start_time_local", "end_time_local"), CONSTRAINT "PK_employee_schedule_rules" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_schedule_rules_tenant_id" ON "employee_schedule_rules" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_schedule_rules_employee_id" ON "employee_schedule_rules" ("employee_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedule_rules" ADD CONSTRAINT "FK_employee_schedule_rules_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedule_rules" ADD CONSTRAINT "FK_employee_schedule_rules_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "employee_schedule_breaks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "day_of_week" smallint NOT NULL, "start_time_local" TIME NOT NULL, "end_time_local" TIME NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_employee_schedule_breaks_day_of_week" CHECK ("day_of_week" >= 0 AND "day_of_week" <= 6), CONSTRAINT "CHK_employee_schedule_breaks_time_order" CHECK ("end_time_local" > "start_time_local"), CONSTRAINT "UQ_employee_schedule_break" UNIQUE ("tenant_id", "employee_id", "day_of_week", "start_time_local", "end_time_local"), CONSTRAINT "PK_employee_schedule_breaks" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_schedule_breaks_tenant_id" ON "employee_schedule_breaks" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_schedule_breaks_employee_id" ON "employee_schedule_breaks" ("employee_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedule_breaks" ADD CONSTRAINT "FK_employee_schedule_breaks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedule_breaks" ADD CONSTRAINT "FK_employee_schedule_breaks_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "employee_time_off" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "start_at_utc" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at_utc" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" text, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_employee_time_off_time_order" CHECK ("end_at_utc" > "start_at_utc"), CONSTRAINT "PK_employee_time_off" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_time_off_tenant_id" ON "employee_time_off" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_time_off_employee_id" ON "employee_time_off" ("employee_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employee_time_off_range" ON "employee_time_off" ("tenant_id", "employee_id", "start_at_utc", "end_at_utc") `,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_time_off" ADD CONSTRAINT "FK_employee_time_off_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_time_off" ADD CONSTRAINT "FK_employee_time_off_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "start_at_utc" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at_utc" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(20) NOT NULL, "total_duration_minutes" integer NOT NULL, "total_price" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "customer_name" character varying(120) NOT NULL, "customer_email" character varying(255), "customer_phone" character varying(30), "notes" text, "source" character varying(20) NOT NULL DEFAULT 'ADMIN', "created_by_user_id" uuid, CONSTRAINT "CHK_bookings_time_order" CHECK ("end_at_utc" > "start_at_utc"), CONSTRAINT "CHK_bookings_duration_positive" CHECK ("total_duration_minutes" > 0), CONSTRAINT "PK_bookings" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_start" ON "bookings" ("tenant_id", "start_at_utc") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_tenant_employee_start" ON "bookings" ("tenant_id", "employee_id", "start_at_utc") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_employee_id" ON "bookings" ("employee_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_status" ON "bookings" ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_created_by_user" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "booking_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "booking_id" uuid NOT NULL, "service_id" uuid NOT NULL, "service_name_snapshot" character varying(120) NOT NULL, "duration_minutes_snapshot" integer NOT NULL, "buffer_before_minutes_snapshot" integer NOT NULL DEFAULT '0', "buffer_after_minutes_snapshot" integer NOT NULL DEFAULT '0', "price_snapshot" numeric(10,2) NOT NULL, "currency_snapshot" character varying(3) NOT NULL DEFAULT 'USD', "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_booking_items_duration_positive" CHECK ("duration_minutes_snapshot" > 0), CONSTRAINT "UQ_booking_items_booking_sort_order" UNIQUE ("booking_id", "sort_order"), CONSTRAINT "PK_booking_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_items_booking_id" ON "booking_items" ("booking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_items_service_id" ON "booking_items" ("service_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD CONSTRAINT "FK_booking_items_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" ADD CONSTRAINT "FK_booking_items_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_items" DROP CONSTRAINT "FK_booking_items_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_items" DROP CONSTRAINT "FK_booking_items_booking"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_items_service_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_booking_items_booking_id"`,
    );
    await queryRunner.query(`DROP TABLE "booking_items"`);

    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_created_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_tenant"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_bookings_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_employee_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_tenant_employee_start"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_tenant_start"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);

    await queryRunner.query(
      `ALTER TABLE "employee_time_off" DROP CONSTRAINT "FK_employee_time_off_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_time_off" DROP CONSTRAINT "FK_employee_time_off_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_time_off_range"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_time_off_employee_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_time_off_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE "employee_time_off"`);

    await queryRunner.query(
      `ALTER TABLE "employee_schedule_breaks" DROP CONSTRAINT "FK_employee_schedule_breaks_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedule_breaks" DROP CONSTRAINT "FK_employee_schedule_breaks_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_schedule_breaks_employee_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_schedule_breaks_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE "employee_schedule_breaks"`);

    await queryRunner.query(
      `ALTER TABLE "employee_schedule_rules" DROP CONSTRAINT "FK_employee_schedule_rules_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedule_rules" DROP CONSTRAINT "FK_employee_schedule_rules_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_schedule_rules_employee_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_employee_schedule_rules_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE "employee_schedule_rules"`);

    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN "slot_interval_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN "schedule_timezone"`,
    );
  }
}
