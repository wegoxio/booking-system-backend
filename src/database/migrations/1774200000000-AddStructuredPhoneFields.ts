import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { MigrationInterface, QueryRunner } from 'typeorm';

type LegacyPhoneRow = {
  id: string;
  phone: string | null;
};

export class AddStructuredPhoneFields1774200000000
  implements MigrationInterface
{
  name = 'AddStructuredPhoneFields1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "phone_country_iso2" character varying(2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "phone_national_number" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "phone_e164" character varying(20)`,
    );

    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "customer_phone_country_iso2" character varying(2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "customer_phone_national_number" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "customer_phone_e164" character varying(20)`,
    );

    await this.backfillEmployees(queryRunner);
    await this.backfillBookings(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "customer_phone_e164"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "customer_phone_national_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "customer_phone_country_iso2"`,
    );

    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "phone_e164"`);
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN "phone_national_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN "phone_country_iso2"`,
    );
  }

  private async backfillEmployees(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "phone" FROM "employees" WHERE "phone" IS NOT NULL`,
    )) as LegacyPhoneRow[];

    for (const row of rows) {
      const normalizedPhone = this.normalizeLegacyPhone(row.phone);
      if (!normalizedPhone) {
        continue;
      }

      await queryRunner.query(
        `UPDATE "employees"
         SET "phone" = $1,
             "phone_country_iso2" = $2,
             "phone_national_number" = $3,
             "phone_e164" = $4
         WHERE "id" = $5`,
        [
          normalizedPhone.display,
          normalizedPhone.countryIso2,
          normalizedPhone.nationalNumber,
          normalizedPhone.e164,
          row.id,
        ],
      );
    }
  }

  private async backfillBookings(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "customer_phone" AS "phone"
       FROM "bookings"
       WHERE "customer_phone" IS NOT NULL`,
    )) as LegacyPhoneRow[];

    for (const row of rows) {
      const normalizedPhone = this.normalizeLegacyPhone(row.phone);
      if (!normalizedPhone) {
        continue;
      }

      await queryRunner.query(
        `UPDATE "bookings"
         SET "customer_phone" = $1,
             "customer_phone_country_iso2" = $2,
             "customer_phone_national_number" = $3,
             "customer_phone_e164" = $4
         WHERE "id" = $5`,
        [
          normalizedPhone.display,
          normalizedPhone.countryIso2,
          normalizedPhone.nationalNumber,
          normalizedPhone.e164,
          row.id,
        ],
      );
    }
  }

  private normalizeLegacyPhone(rawPhone: string | null): {
    display: string;
    countryIso2: string;
    nationalNumber: string;
    e164: string;
  } | null {
    const normalizedPhone = rawPhone?.trim() ?? '';
    if (!normalizedPhone) {
      return null;
    }

    const parsed = parsePhoneNumberFromString(normalizedPhone);
    if (!parsed?.isValid() || !parsed.country) {
      return null;
    }

    return {
      display: parsed.formatInternational(),
      countryIso2: parsed.country.toUpperCase(),
      nationalNumber: parsed.nationalNumber,
      e164: parsed.number,
    };
  }
}
