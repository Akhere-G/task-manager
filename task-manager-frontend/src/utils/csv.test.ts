import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+SUM(A1)", "'+SUM(A1)"],
    ["-2", "'-2"],
    ["@cmd", "'@cmd"],
    ["\tTabbed", "'\tTabbed"],
    ["plain", "plain"],
    ["2026-03-02 10:00:00", "2026-03-02 10:00:00"],
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ["line\nbreak", '"line\nbreak"'],
    ["cr\rreturn", '"cr\rreturn"'],
    [null, ""],
    [undefined, ""],
  ])("%j -> %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });
});

describe("toCsv", () => {
  it("joins rows and quotes only where needed", () => {
    expect(toCsv([["a", "b,c"], ["=x", 1]])).toBe('a,"b,c"\n\'=x,1');
  });
});
