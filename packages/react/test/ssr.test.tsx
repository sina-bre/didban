// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalyticsProvider, useAnalytics } from "../src/index.js";

function Child() {
  useAnalytics().track("rendered_on_server");
  return <span>ok</span>;
}

describe("server rendering", () => {
  it("renders without browser globals and without throwing", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(
      <AnalyticsProvider endpoint="/a/e" writeKey="wk_ssr">
        <Child />
      </AnalyticsProvider>,
    );
    expect(html).toBe("<span>ok</span>");
  });
});
