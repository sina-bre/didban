import { readFileSync } from "node:fs";
import { PASSWORD_LIMITS } from "@didban/contracts";

// Spec §11: 12–128 characters, no composition rules, not in the bundled common-password list.
// Source of the list: SecLists 10k-most-common (MIT), see data/README.md and ADR 0017.
const LIST_FILE = new URL("../../../data/common-passwords.txt", import.meta.url);

let common: Set<string> | undefined;

function commonPasswords(): Set<string> {
  common ??= new Set(
    readFileSync(LIST_FILE, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length >= PASSWORD_LIMITS.min),
  );
  return common;
}

export type PasswordProblem = "TOO_SHORT" | "TOO_LONG" | "TOO_COMMON";

/** Length counts Unicode code points, so a Persian passphrase is measured like a Latin one. */
export function checkPassword(password: string): PasswordProblem | null {
  const length = [...password].length;
  if (length < PASSWORD_LIMITS.min) return "TOO_SHORT";
  if (length > PASSWORD_LIMITS.max) return "TOO_LONG";
  if (commonPasswords().has(password.trim().toLowerCase())) return "TOO_COMMON";
  return null;
}
