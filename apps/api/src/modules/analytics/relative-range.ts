import { resolveRelativeRange } from "@didban/contracts";
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { from, type Observable, switchMap } from "rxjs";
import { SQL, type Sql } from "../../db/db.module.js";
import { AppError, notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";

type StatsRequest = FastifyRequest<{
  Params: { projectId?: string };
  Querystring: Record<string, unknown>;
}>;

/**
 * `?range=7d` on `/projects/:projectId/stats/*` becomes `from`/`to` in the project's reporting
 * zone before the query pipe validates it (ADR 0046). Interceptors run after the guards; the
 * project is still read through the AccessScope. Everything else in the query is left to the pipe.
 */
@Injectable()
export class RelativeRange implements NestInterceptor {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<StatsRequest>();
    if (request.query?.range === undefined) return next.handle();
    return from(this.resolve(request)).pipe(switchMap(() => next.handle()));
  }

  private async resolve(request: StatsRequest): Promise<void> {
    if (!request.scope) throw notFound();
    const id = (request.params.projectId ?? "").toLowerCase();
    const projectId = projectInScope(request.scope, id);
    const [project] = await this.sql<{ reportingTimezone: string }[]>`
      SELECT reporting_timezone FROM projects WHERE id = ${projectId} AND archived_at IS NULL`;
    if (!project) throw notFound();
    const query = resolveRelativeRange(request.query, project.reportingTimezone);
    if (!query) throw new AppError(400, "VALIDATION_FAILED", "Invalid request");
    request.query = query;
  }
}
