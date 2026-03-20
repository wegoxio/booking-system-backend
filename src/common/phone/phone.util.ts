import { BadRequestException } from '@nestjs/common';
import {
  type CountryCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

export type NormalizedPhone = {
  display: string | null;
  e164: string | null;
  countryIso2: string | null;
  nationalNumber: string | null;
  source: 'empty' | 'structured' | 'legacy-structured' | 'legacy-unstructured';
};

type NormalizePhoneInput = {
  countryIso2?: string | null;
  nationalNumber?: string | null;
  legacyPhone?: string | null;
  fieldLabel?: string;
};

const COUNTRY_ISO2_REGEX = /^[A-Z]{2}$/;
const NON_DIGIT_REGEX = /\D+/g;

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeCountryIso2(value?: string | null): string | null {
  const normalized = normalizeText(value)?.toUpperCase() ?? null;
  if (!normalized) return null;

  if (!COUNTRY_ISO2_REGEX.test(normalized)) {
    throw new BadRequestException(
      'El país del teléfono debe ser un código ISO2 válido.',
    );
  }

  return normalized;
}

function normalizeNationalNumber(value?: string | null): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const digits = normalized.replace(NON_DIGIT_REGEX, '');
  return digits.length > 0 ? digits : null;
}

function toStructuredPhone(
  nationalNumber: string,
  countryIso2: string,
  source: NormalizedPhone['source'],
  fieldLabel: string,
): NormalizedPhone {
  const parsed = parsePhoneNumberFromString(
    nationalNumber,
    countryIso2 as CountryCode,
  );

  if (!parsed || !parsed.isValid()) {
    throw new BadRequestException(`${fieldLabel} inválido`);
  }

  return {
    display: parsed.formatInternational(),
    e164: parsed.number,
    countryIso2: parsed.country?.toUpperCase() ?? countryIso2,
    nationalNumber: parsed.nationalNumber,
    source,
  };
}

export function normalizePhoneInput({
  countryIso2,
  nationalNumber,
  legacyPhone,
  fieldLabel = 'teléfono',
}: NormalizePhoneInput): NormalizedPhone {
  const normalizedCountryIso2 = normalizeCountryIso2(countryIso2);
  const normalizedNationalNumber = normalizeNationalNumber(nationalNumber);
  const normalizedLegacyPhone = normalizeText(legacyPhone);
  const hasStructuredPhoneInput =
    normalizedCountryIso2 !== null || normalizedNationalNumber !== null;

  if (hasStructuredPhoneInput) {
    if (!normalizedCountryIso2 || !normalizedNationalNumber) {
      throw new BadRequestException(
        `${fieldLabel} requiere país y número`,
      );
    }

    return toStructuredPhone(
      normalizedNationalNumber,
      normalizedCountryIso2,
      'structured',
      fieldLabel,
    );
  }

  if (!normalizedLegacyPhone) {
    return {
      display: null,
      e164: null,
      countryIso2: null,
      nationalNumber: null,
      source: 'empty',
    };
  }

  const parsed = parsePhoneNumberFromString(normalizedLegacyPhone);

  if (parsed?.isValid() && parsed.country) {
    return {
      display: parsed.formatInternational(),
      e164: parsed.number,
      countryIso2: parsed.country.toUpperCase(),
      nationalNumber: parsed.nationalNumber,
      source: 'legacy-structured',
    };
  }

  return {
    display: normalizedLegacyPhone,
    e164: null,
    countryIso2: null,
    nationalNumber: null,
    source: 'legacy-unstructured',
  };
}
