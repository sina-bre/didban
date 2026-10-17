import { type BeforeApplicationShutdown, Injectable } from "@nestjs/common";

/** Flips readiness to false as soon as shutdown starts, so the proxy stops routing to us. */
@Injectable()
export class ShutdownState implements BeforeApplicationShutdown {
  private shuttingDown = false;

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }
}
