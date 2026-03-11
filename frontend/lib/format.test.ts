import { describe, expect, test } from "bun:test";
import { formatCurrency, formatPercent, formatNumber } from "./format";

describe("formatters", () => {
  test("formatCurrency", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(1000000)).toBe("$1,000,000");
  });

  test("formatPercent", () => {
    expect(formatPercent(12.5)).toBe("12.5%");
    expect(formatPercent(5)).toBe("5.0%");
  });

  test("formatNumber", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
  });
});