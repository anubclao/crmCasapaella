/**
 * Phone number normalization.
 * Casa Paella serves Colombia → default country +57.
 * All DB lookups go through normalizePhone() to avoid duplicates.
 */
import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";
import { env } from "./env";

export type NormalizedPhone = {
  e164: string; // +573138818822
  national: string; // 313 881 8822
  country: CountryCode;
  valid: boolean;
};

/**
 * Normalize any of these into E.164:
 *   "3138818822"      → "+573138818822"
 *   "+57 313 881 88 22" → "+573138818822"
 *   "57 313 881 8822" → "+573138818822"
 *
 * Returns { valid: false, e164: original } if it can't be parsed.
 */
export function normalizePhone(input: string, defaultCountry: CountryCode = "CO"): NormalizedPhone {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { e164: "", national: "", country: defaultCountry, valid: false };
  }

  // If the input has a +, libphonenumber-js parses it without needing a country.
  // Otherwise it falls back to the default country.
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (parsed && parsed.isValid()) {
    return {
      e164: parsed.number, // +573138818822
      national: parsed.formatNational(),
      country: parsed.country ?? defaultCountry,
      valid: true,
    };
  }

  // Fallback: prepend default country code if user typed a national number.
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 15) {
    const fallback = `${env.DEFAULT_COUNTRY_CODE}${digits.replace(/^57/, "")}`;
    const reparsed = parsePhoneNumberFromString(fallback);
    if (reparsed && reparsed.isValid()) {
      return {
        e164: reparsed.number,
        national: reparsed.formatNational(),
        country: "CO",
        valid: true,
      };
    }
  }

  return { e164: trimmed, national: trimmed, country: defaultCountry, valid: false };
}
