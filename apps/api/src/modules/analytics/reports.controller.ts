import * as c from "@didban/contracts";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { getEventProperties, getEvents } from "./events-report.js";
import { getDevices, getGeo } from "./geo-devices.js";
import { getSources } from "./sources.js";

type Rows<Row> = Promise<c.BreakdownResponse<Row>>;

// Spec §10 breakdowns besides pages. Read access (`project:view`) for every role on the project.
@Controller("projects/:projectId/stats")
export class ReportsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("project:view")
  @Get("sources")
  sources(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(c.sourcesQuerySchema)) query: c.SourcesQuery,
  ): Rows<c.VisitRow> {
    return getSources(this.sql, scope, { projectId, query });
  }

  @Requires("project:view")
  @Get("geo")
  geo(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(c.geoQuerySchema)) query: c.GeoQuery,
  ): Rows<c.EventRow> {
    return getGeo(this.sql, scope, { projectId, query });
  }

  @Requires("project:view")
  @Get("devices")
  devices(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(c.devicesQuerySchema)) query: c.DevicesQuery,
  ): Rows<c.EventRow> {
    return getDevices(this.sql, scope, { projectId, query });
  }

  @Requires("project:view")
  @Get("events")
  events(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(c.eventsQuerySchema)) query: c.EventsQuery,
  ): Rows<c.EventRow> {
    return getEvents(this.sql, scope, { projectId, query });
  }

  @Requires("project:view")
  @Get("events/:name/properties")
  properties(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("name") name: string,
    @Query(new ZodPipe(c.eventPropertiesQuerySchema)) query: c.EventPropertiesQuery,
  ): Rows<c.EventRow> {
    return getEventProperties(this.sql, scope, { projectId, query, name });
  }
}
