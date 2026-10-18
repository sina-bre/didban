import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";

// Spec §4 cookieless identity: one random 32-byte salt per UTC day, shared by every process
// through `daily_salts`. Creating a day's salt deletes salts older than yesterday, so a visitor
// ID can no longer be recomputed once its salt is gone (≤ 48 h). Cached here for the day.

type Row = { salt: Buffer };

@Injectable()
export class DailySalt {
  private cached: { day: string; salt: Buffer } | null = null;

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async forDay(now: Date): Promise<Buffer> {
    const day = now.toISOString().slice(0, 10);
    if (this.cached?.day === day) return this.cached.salt;
    const salt = (await this.create(day)) ?? (await this.read(day));
    if (!salt) throw new Error("daily salt missing after insert");
    this.cached = { day, salt };
    return salt;
  }

  /** `null` when another process created the row first (its insert wins). */
  private async create(day: string): Promise<Buffer | null> {
    const [row] = await this.sql<Row[]>`
      WITH removed AS (DELETE FROM daily_salts WHERE day < ${day}::date - 1)
      INSERT INTO daily_salts (day, salt) VALUES (${day}, ${randomBytes(32)})
      ON CONFLICT (day) DO NOTHING RETURNING salt`;
    return row?.salt ?? null;
  }

  private async read(day: string): Promise<Buffer | null> {
    const [row] = await this.sql<Row[]>`SELECT salt FROM daily_salts WHERE day = ${day}`;
    return row?.salt ?? null;
  }
}
