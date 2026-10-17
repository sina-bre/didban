import { type DynamicModule, Global, Module } from "@nestjs/common";
import type { Env } from "./env.js";

export const ENV = Symbol("ENV");

/** Makes the validated env injectable everywhere: `@Inject(ENV) env: Env`. */
@Global()
@Module({})
export class ConfigModule {
  static register(env: Env): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: ENV, useValue: env }], exports: [ENV] };
  }
}
