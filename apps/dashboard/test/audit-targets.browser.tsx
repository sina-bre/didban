import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { FilterLink } from "../src/features/report/filter-link";
import { OrgProjectSwitcher } from "../src/shared/components";
import { SelectField } from "../src/shared/ui";
import { renderUi } from "./render";

// Stage 5f axe/target audit at 360 px (e2e/tests/dashboard-a11y.spec.ts), in real Chrome with our CSS.
const box = (el: Element) => el.getBoundingClientRect();
afterEach(cleanup);

describe("audit fixes at 360 px", () => {
  it("a short breakdown label is still a 44 x 44 px filter link", async () => {
    await page.viewport(360, 740);
    renderUi(<FilterLink field="referrer" value="t.co" label="t.co" />);
    const link = screen.getByRole("link", { name: "Filter by t.co" });
    expect(box(link).width).toBeGreaterThanOrEqual(44);
    expect(box(link).height).toBeGreaterThanOrEqual(44);
  });

  it("a select squeezed by a table column keeps room for its options", async () => {
    await page.viewport(360, 740);
    renderUi(
      <table style={{ width: 360 }}>
        <tbody>
          <tr>
            <td style={{ width: "100%" }}>owner-with-a-long-address@example.com</td>
            <td>
              <SelectField label="Role" hideLabel defaultValue="owner">
                <option value="owner">Owner</option>
              </SelectField>
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(box(screen.getByRole("combobox", { name: "Role" })).width).toBeGreaterThanOrEqual(112);
  });

  it("the switcher's name is its content, so it holds the visible text (WCAG 2.5.3)", async () => {
    await page.viewport(360, 740);
    const orgs = [{ id: "o", name: "Acme", projects: [{ id: "p", name: "Shop" }] }];
    renderUi(<OrgProjectSwitcher orgs={orgs} currentProjectId="p" />);
    const trigger = screen.getByRole("button", {
      name: "Switch organization and project: Shop Acme",
    });
    expect(trigger.hasAttribute("aria-label")).toBe(false);
    expect(trigger.textContent).toBe("Switch organization and project: Shop Acme");
  });
});
