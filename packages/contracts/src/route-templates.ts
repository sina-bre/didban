import { z } from "zod";

// Spec §7 step 6 + §10 `…/routes`. `:param` = one segment, trailing `*` = the rest. The server
// checks the full syntax (apps/api `domain/route-template.ts`); here it is shape only.
export const MAX_ROUTE_TEMPLATES = 200;
export const MAX_PREVIEW_PATHS = 20;

const patternSchema = z.string().min(1).max(200).startsWith("/");
const positionSchema = z.number().int().min(1).max(MAX_ROUTE_TEMPLATES);

/** `position` defaults to the end of the list; later templates move down by one. */
export const createRouteTemplateRequestSchema = z.object({
  pattern: patternSchema,
  position: positionSchema.optional(),
});
export type CreateRouteTemplateRequest = z.infer<typeof createRouteTemplateRequestSchema>;

export const updateRouteTemplateRequestSchema = z
  .object({ pattern: patternSchema, position: positionSchema })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");
export type UpdateRouteTemplateRequest = z.infer<typeof updateRouteTemplateRequestSchema>;

export const routeTemplateSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  pattern: z.string(),
  createdAt: z.iso.datetime(),
});
export type RouteTemplate = z.infer<typeof routeTemplateSchema>;

/** Ordered by `position`: the first matching template wins. */
export const routeTemplateListResponseSchema = z.object({ routes: z.array(routeTemplateSchema) });
export type RouteTemplateListResponse = z.infer<typeof routeTemplateListResponseSchema>;

/** Without `patterns` the saved templates are used; with them, unsaved ones can be tried. */
export const routePreviewRequestSchema = z.object({
  paths: z.array(z.string().min(1).max(1024).startsWith("/")).min(1).max(MAX_PREVIEW_PATHS),
  patterns: z.array(patternSchema).max(MAX_ROUTE_TEMPLATES).optional(),
});
export type RoutePreviewRequest = z.infer<typeof routePreviewRequestSchema>;

/** `template` is the matching pattern, or `null` when the path is stored as it is. */
export const routePreviewResponseSchema = z.object({
  results: z.array(z.object({ path: z.string(), template: z.string().nullable() })),
});
export type RoutePreviewResponse = z.infer<typeof routePreviewResponseSchema>;
