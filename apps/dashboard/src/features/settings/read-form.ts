/** How a settings form field becomes a request value. */
export type FieldKind = "text" | "number" | "optionalNumber" | "list" | "lines" | "bool";

/**
 * Plain `FormData` → request body: numbers, "forever" as `null`, comma or line lists, switches
 * (present = on). The contract schema validates the result; this only converts types.
 */
export function readForm(form: HTMLFormElement, fields: Record<string, FieldKind>) {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const split = (name: string, by: RegExp) =>
    text(name)
      .split(by)
      .map((v) => v.trim())
      .filter(Boolean);
  const read: Record<FieldKind, (name: string) => unknown> = {
    text,
    number: (name) => Number(text(name)),
    optionalNumber: (name) => (text(name) === "" ? null : Number(text(name))),
    list: (name) => split(name, /[\s,]+/),
    lines: (name) => split(name, /\n+/),
    bool: (name) => data.has(name),
  };
  return Object.fromEntries(Object.entries(fields).map(([name, kind]) => [name, read[kind](name)]));
}
