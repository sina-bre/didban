import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocale } from "../src/shared/lib/locale-context";
import { CodeBlock, Stepper, Switch, ToastProvider, useToast } from "../src/shared/ui";
import { renderUi } from "./render";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Notifier() {
  const notify = useToast();
  return (
    <button type="button" onClick={() => notify("Saved")}>
      save
    </button>
  );
}

describe("Toast", () => {
  it("announces in a polite region that exists before the toast, and closes after 5 s", () => {
    vi.useFakeTimers();
    renderUi(
      <ToastProvider dismissLabel="Dismiss">
        <Notifier />
      </ToastProvider>,
    );
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(region.textContent).toContain("Saved");
    act(() => vi.advanceTimersByTime(5000));
    expect(region.textContent).toBe("");
  });
});

describe("CodeBlock", () => {
  it("copies the code and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderUi(
      <CodeBlock
        title="Script tag"
        code="<script>"
        copyLabel="Copy"
        copiedLabel="Copied"
        failedLabel="Press Ctrl+C"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Copy: Script tag$/ }));
    expect(await screen.findByText("Copied")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("<script>");
  });

  it("selects the code when the clipboard refuses", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderUi(
      <CodeBlock
        title="SDK"
        code="npm i"
        copyLabel="Copy"
        copiedLabel="Copied"
        failedLabel="Press Ctrl+C"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Copy: SDK$/ }));
    expect(await screen.findByText("Press Ctrl+C")).toBeTruthy();
    expect(getSelection()?.toString()).toBe("npm i");
  });
});

function Steps() {
  const { locale } = useLocale();
  const digits = new Intl.NumberFormat(locale);
  return (
    <Stepper
      label="Setup"
      steps={["A", "B", "C"]}
      current={1}
      formatNumber={(n) => digits.format(n)}
    />
  );
}

describe("Stepper and Switch", () => {
  it("marks the current step and uses locale digits", () => {
    renderUi(<Steps />, { locale: "fa" });
    const current = screen.getByRole("listitem", { current: "step" });
    expect(current.textContent).toBe("۲B");
  });

  it("Switch exposes role switch with its state", () => {
    const onChange = vi.fn();
    renderUi(<Switch label="Compare" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Compare" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
