import { describe, expect, it } from "vitest";
import { normalizeCidr, normalizeCidrs } from "./cidr.js";

describe("normalizeCidr", () => {
  it("keeps ranges and completes bare addresses", () => {
    expect(normalizeCidr("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(normalizeCidr(" 203.0.113.7 ")).toBe("203.0.113.7/32");
    expect(normalizeCidr("2001:DB8::/32")).toBe("2001:db8::/32");
    expect(normalizeCidr("::1")).toBe("::1/128");
    expect(normalizeCidr("10.0.0.0/08")).toBe("10.0.0.0/8");
  });

  it("refuses bad addresses and prefixes", () => {
    for (const bad of ["10.0.0.0/33", "::/129", "10.0.0/8", "10.0.0.0/8/1", "10.0.0.0/", "x", ""]) {
      expect([bad, normalizeCidr(bad)]).toEqual([bad, null]);
    }
  });

  it("a list with one bad entry is refused as a whole", () => {
    expect(normalizeCidrs(["10.0.0.1", "10.0.0.1/32"])).toEqual(["10.0.0.1/32"]);
    expect(normalizeCidrs(["10.0.0.1", "nope"])).toBeNull();
  });
});
