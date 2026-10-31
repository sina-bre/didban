import { type FormEvent, useState } from "react";
import type { z } from "zod";
import { useLocale } from "../../shared/lib/locale-context";
import { failureText } from "./failure-text";
import { type FieldKind, readForm } from "./read-form";

interface Options<T> {
  fields: Record<string, FieldKind>;
  /** The contract's request schema: the same rules the API applies. */
  schema: z.ZodType<T, unknown>;
  send: (body: T) => Promise<unknown>;
  /** The message for an invalid field. */
  invalid: (field: string) => string;
  /** Adjusts the read values before the schema sees them (a date field → an instant). */
  prepare?: (raw: Record<string, unknown>) => Record<string, unknown>;
  onDone?: (form: HTMLFormElement) => void;
}

export type FormErrors = Record<string, string | undefined>;

/** Reads, checks (contract schema), sends; field errors per input, server errors on the form. */
export function useSettingsForm<T>(options: Options<T>) {
  const { fields, schema, send, invalid, prepare = (raw) => raw, onDone } = options;
  const { t } = useLocale();
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = schema.safeParse(prepare(readForm(form, fields)));
    if (!parsed.success) {
      const names = parsed.error.issues.map((issue) => String(issue.path[0] ?? "form"));
      setErrors(Object.fromEntries(names.map((name) => [name, invalid(name)])));
      return;
    }
    setPending(true);
    try {
      await send(parsed.data);
      setErrors({});
      onDone?.(form);
    } catch (error) {
      setErrors({ form: failureText(t, error) });
    } finally {
      setPending(false);
    }
  };
  return { errors, pending, onSubmit };
}
