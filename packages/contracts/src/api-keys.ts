import { z } from "zod";

// Spec §9.1 write keys. Browser keys are public by design and can only write events.
export const apiKeyKindSchema = z.enum(["write_browser", "write_server"]);
export type ApiKeyKind = z.infer<typeof apiKeyKindSchema>;

/** Active (not revoked) keys allowed per environment. */
export const MAX_ACTIVE_KEYS_PER_ENVIRONMENT = 10;

export const createApiKeyRequestSchema = z.object({ kind: apiKeyKindSchema });
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

export const apiKeySchema = z.object({
  id: z.uuid(),
  environmentId: z.uuid(),
  kind: apiKeyKindSchema,
  /** First 16 characters of the token, enough to recognize it, not to use it. */
  prefix: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});
export type ApiKey = z.infer<typeof apiKeySchema>;

/** The only response that carries the token. Only its hash is stored, so it is shown once. */
export const createdApiKeySchema = apiKeySchema.extend({ token: z.string() });
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;

export const apiKeyListResponseSchema = z.object({ keys: z.array(apiKeySchema) });
export type ApiKeyListResponse = z.infer<typeof apiKeyListResponseSchema>;
