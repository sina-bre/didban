import { randomInt } from "node:crypto";

// ADR 0024: 4 groups of 5 characters from 54 unambiguous symbols (no 0/O, 1/l/I): ~115 bits,
// easy to read out or type once. It passes the password policy and is replaced at first login.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function newTemporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g += 1) {
    let group = "";
    for (let i = 0; i < 5; i += 1) group += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join("-");
}
