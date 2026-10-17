import type { Sql } from "../db/db.module.js";
import type { OrgRole, ProjectRole } from "../domain/org-roles.js";
import { hashSessionToken, newSessionToken } from "../modules/auth/session-token.js";

// Test fixtures written with plain SQL. Password hashes are not real: these users never log in
// with a password; `seedSession` hands out a session cookie instead.

export async function seedOrg(sql: Sql, slug: string): Promise<string> {
  const [org] = await sql<{ id: string }[]>`
    INSERT INTO organizations (name, slug) VALUES (${slug}, ${slug}) RETURNING id`;
  if (!org) throw new Error("no org row");
  return org.id;
}

export async function seedMember(
  sql: Sql,
  organizationId: string,
  email: string,
  role: OrgRole,
): Promise<string> {
  const [user] = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash) VALUES (${email}, 'unused') RETURNING id`;
  if (!user) throw new Error("no user row");
  await sql`INSERT INTO memberships (user_id, organization_id, role)
            VALUES (${user.id}, ${organizationId}, ${role})`;
  return user.id;
}

export async function seedProject(sql: Sql, organizationId: string, slug: string): Promise<string> {
  const [project] = await sql<{ id: string }[]>`
    INSERT INTO projects (organization_id, name, slug)
    VALUES (${organizationId}, ${slug}, ${slug}) RETURNING id`;
  if (!project) throw new Error("no project row");
  return project.id;
}

export async function seedProjectMember(
  sql: Sql,
  projectId: string,
  organizationId: string,
  userId: string,
  role: ProjectRole,
): Promise<void> {
  await sql`INSERT INTO project_members (project_id, organization_id, user_id, role)
            VALUES (${projectId}, ${organizationId}, ${userId}, ${role})`;
}

/** Inserts a live session and returns the matching `cookie` header value (`sid=<token>`). */
export async function seedSession(sql: Sql, userId: string): Promise<string> {
  const token = newSessionToken();
  await sql`
    INSERT INTO auth_sessions (user_id, token_hash, ua_label, ip_prefix, expires_at)
    VALUES (${userId}, ${hashSessionToken(token)}, 'test', '', now() + interval '1 day')`;
  return `sid=${token}`;
}
