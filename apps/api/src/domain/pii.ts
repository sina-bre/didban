// Spec §7 step 6 "PII guard": values that look like an email address or a payment card number
// (13–19 digits, spaces or dashes allowed, Luhn-valid) are dropped when the project uses `strip`.

const EMAIL = /[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,63}/;
const DIGIT_RUN = /\d(?:[ -]?\d){12,18}/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** True when the string contains something that looks like an email or a card number. */
export function looksLikePii(value: string): boolean {
  if (EMAIL.test(value)) return true;
  for (const run of value.match(DIGIT_RUN) ?? []) {
    const digits = run.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return true;
  }
  return false;
}
