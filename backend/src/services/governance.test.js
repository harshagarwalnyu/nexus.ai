import { expect, test, describe } from "bun:test";
import { redactPII } from "./governanceService.js";

describe("PII Redaction", () => {
  test("redacts emails", () => {
    const text = "Contact me at boss@example.com";
    const { redacted, piiFound } = redactPII(text);
    expect(piiFound).toBe(true);
    expect(redacted).toBe("Contact me at [EMAIL REDACTED]");
  });

  test("redacts phone numbers", () => {
    const text = "Call 555-123-4567 or +1 (555) 987-6543";
    const { redacted, piiFound } = redactPII(text);
    expect(piiFound).toBe(true);
    expect(redacted).toContain("[PHONE REDACTED]");
  });

  test("redacts internal account IDs", () => {
    const text = "Check account ACC-0001 and ACC-9999-X";
    const { redacted, piiFound } = redactPII(text);
    expect(piiFound).toBe(true);
    expect(redacted).toContain("[INTERNAL_ACCOUNT_ID REDACTED]");
  });

  test("redacts addresses", () => {
    const text = "Located at 123 Main Street, New York";
    const { redacted, piiFound } = redactPII(text);
    expect(piiFound).toBe(true);
    expect(redacted).toContain("[ADDRESS REDACTED]");
  });

  test("does not redact safe text", () => {
    const text = "The weather is nice today in the Technology industry.";
    const { redacted, piiFound } = redactPII(text);
    expect(piiFound).toBe(false);
    expect(redacted).toBe(text);
  });
});
