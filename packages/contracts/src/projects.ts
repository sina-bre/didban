import { z } from "zod";

// Spec §9.1 project settings. Defaults live in the database (migration 0004).

/** IANA names only ("Europe/Berlin", "UTC"). Offsets like "+03:30" are refused: Postgres reads
 * POSIX offsets with the opposite sign, so they would bucket data on the wrong side of UTC. */
const IANA_ZONE = /^(UTC|[A-Z][A-Za-z_-]+(\/[A-Za-z0-9_+-]+){1,2})$/;

export function isTimeZone(value: string): boolean {
  if (!IANA_ZONE.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().max(64).refine(isTimeZone, "Unknown time zone");
export const projectNameSchema = z.string().trim().min(1).max(100);
const queryParamName = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);

export const createProjectRequestSchema = z.object({
  name: projectNameSchema,
  reportingTimezone: timeZoneSchema.optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = z
  .object({
    name: projectNameSchema,
    reportingTimezone: timeZoneSchema,
    sessionTimeoutMinutes: z.int().min(5).max(120),
    /** `null` keeps data forever. */
    retentionDays: z.int().min(7).max(3650).nullable(),
    allowIdentify: z.boolean(),
    piiGuard: z.enum(["strip", "off"]),
    urlParamAllowlist: z
      .array(queryParamName)
      .max(20)
      .transform((names) => [...new Set(names)]),
    trailingSlashPolicy: z.enum(["strip", "keep"]),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const projectSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  slug: z.string(),
  reportingTimezone: z.string(),
  sessionTimeoutMinutes: z.int(),
  retentionDays: z.int().nullable(),
  allowIdentify: z.boolean(),
  piiGuard: z.enum(["strip", "off"]),
  urlParamAllowlist: z.array(z.string()),
  trailingSlashPolicy: z.enum(["strip", "keep"]),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;

/** Org owners/admins: every project of the organization, archived ones included. */
export const organizationProjectListResponseSchema = z.object({
  projects: z.array(projectSchema.pick({ id: true, name: true, slug: true, archivedAt: true })),
});
export type OrganizationProjectListResponse = z.infer<typeof organizationProjectListResponseSchema>;

export const setProjectArchivedRequestSchema = z.object({ archived: z.boolean() });
export type SetProjectArchivedRequest = z.infer<typeof setProjectArchivedRequestSchema>;
