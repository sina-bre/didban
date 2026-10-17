import type { Sql } from "../db/db.module.js";
import { AppError } from "../http/app-error.js";
import { CreateOwnerError, createOwner } from "../modules/users/create-owner.js";
import { createPrompter } from "./prompt.js";

/** `pnpm cli create-owner`: interactive; nothing secret is accepted on the command line. */
export async function createOwnerCommand(sql: Sql): Promise<number> {
  const prompt = createPrompter();
  try {
    if (!prompt.terminal) console.warn("stdin is not a terminal: reading answers from the pipe.");
    const email = await prompt.ask("Owner email: ");
    const organizationName = await prompt.ask("Organization name: ");
    const password = await prompt.ask("Password (12-128 characters): ", true);
    const repeat = await prompt.ask("Repeat password: ", true);
    if (password !== repeat) {
      console.error("Passwords do not match. Nothing was created.");
      return 1;
    }
    const result = await createOwner(sql, { email, password, organizationName });
    console.log(`Created owner ${email.trim().toLowerCase()} of organization "${result.slug}".`);
    return 0;
  } catch (error) {
    if (!(error instanceof CreateOwnerError || error instanceof AppError)) throw error;
    console.error(`${error.message} Nothing was created.`);
    return 1;
  } finally {
    prompt.close();
  }
}
