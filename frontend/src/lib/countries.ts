import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export const countryName = (code?: string) => (code ? countries.getName(code, "en", { select: "alias" }) || code : "Unknown");

export const alpha2ToNumeric = (code: string) => countries.alpha2ToNumeric(code);

export const flag = (code?: string) =>
  code && /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "🏳️";
