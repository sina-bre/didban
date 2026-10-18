import { expect, it } from "vitest";
import { toCsv } from "./csv.js";

it("csv: quotes, BOM, CRLF, null as empty, formula cells neutralised", () => {
  const csv = toCsv(
    ["value", "visitors"],
    [
      { value: 'a,"b"', visitors: 2 },
      { value: '=HYPERLINK("http://evil")', visitors: 1 },
      { value: null, visitors: 0 },
      { value: "-1+1", visitors: 0 },
      { value: "/مقاله", visitors: 3 },
    ],
  );
  expect(csv).toBe(
    `${String.fromCharCode(0xfeff)}value,visitors` +
      '\r\n"a,""b""",2\r\n"\'=HYPERLINK(""http://evil"")",1\r\n,0\r\n\'-1+1,0\r\n/مقاله,3\r\n',
  );
});
