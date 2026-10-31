import { describe, expect, it } from "vitest";
import { validateContact } from "./schemas";

describe("validateContact", () => {
  const base = {
    fullName: "Ada",
    email: "ada@x.io",
    subject: "General Support",
    message: "Hello there, friend",
  };

  it("accepts valid input", () => {
    expect(validateContact(base)).toEqual({});
  });

  it("reports first message per field", () => {
    expect(validateContact({ ...base, message: "short" }).message).toBe(
      "Message must be at least 10 characters.",
    );
    expect(validateContact({ ...base, message: "" }).message).toBe(
      "Message content is required.",
    );
    expect(validateContact({ ...base, email: "x" }).email).toBe(
      "Please enter a valid email address.",
    );
  });
});
