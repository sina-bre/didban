import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { TimeSeriesChart } from "../src/shared/components";
import { renderUi } from "./render";

// Stage 5f (Lighthouse mobile): a chart below the fold does not fetch Recharts until it is near.
const points = [1, 2, 3].map((d) => ({ date: new Date(2026, 9, d), value: d }));
const plotted = () => document.querySelector(".recharts-surface") !== null;

describe("TimeSeriesChart below the fold", () => {
  it("draws the plot only once it scrolls into view", async () => {
    await page.viewport(360, 740);
    renderUi(
      <div>
        <div style={{ height: 3000 }} />
        <TimeSeriesChart title="Visitors over time" valueLabel="Visitors" points={points} />
      </div>,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(plotted()).toBe(false);
    document.querySelector("figure")?.scrollIntoView();
    await waitFor(() => expect(plotted()).toBe(true), { timeout: 5000 });
  });
});
