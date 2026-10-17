import { z } from "zod";

// Spec §9.1 environment columns. Origins are exact `scheme://host[:port]` values (ADR 0020).
// CIDR syntax needs Node's `net` module, so the server checks it; here it is shape only.

/** "https://Example.com/" → "https://example.com". `null` when it is not a bare http(s) origin. */
export function toOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const bare = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
  const web = url.protocol === "https:" || url.protocol === "http:";
  return bare && web ? url.origin : null;
}

const originSchema = z
  .string()
  .max(255)
  .refine((value) => toOrigin(value) !== null, "Not an origin")
  .transform((value) => toOrigin(value) as string);

const unique = (values: string[]) => [...new Set(values)];

export const environmentNameSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
export const identityModeSchema = z.enum(["cookieless", "persistent"]);

const environmentFields = z.object({
  identityMode: identityModeSchema,
  allowedOrigins: z.array(originSchema).max(50).transform(unique),
  excludedCidrs: z.array(z.string().trim().max(49)).max(50).transform(unique),
  trackLocalhost: z.boolean(),
});

export const createEnvironmentRequestSchema = environmentFields
  .partial()
  .extend({ name: environmentNameSchema });
export type CreateEnvironmentRequest = z.infer<typeof createEnvironmentRequestSchema>;

export const updateEnvironmentRequestSchema = environmentFields
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");
export type UpdateEnvironmentRequest = z.infer<typeof updateEnvironmentRequestSchema>;

export const environmentSchema = environmentFields.extend({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  allowedOrigins: z.array(z.string()),
  excludedCidrs: z.array(z.string()),
  createdAt: z.iso.datetime(),
});
export type Environment = z.infer<typeof environmentSchema>;

export const environmentListResponseSchema = z.object({ environments: z.array(environmentSchema) });
export type EnvironmentListResponse = z.infer<typeof environmentListResponseSchema>;
