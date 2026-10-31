import { describe, expect, it } from "vitest";
import {
  validateLogin,
  validateRegister,
  validateResetPassword,
} from "./schemas";

describe("auth schemas", () => {
  it("requires login fields", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Email is required.",
      password: "Password is required.",
    });
  });

  it("validates registration", () => {
    const base = {
      firstName: "A",
      lastName: "B",
      email: "a@b.co",
      password: "abcdefg1",
      confirmPassword: "abcdefg1",
    };
    expect(validateRegister(base)).toEqual({});
    expect(validateRegister({ ...base, password: "abcdefgh" }).password).toBe(
      "Password must contain both letters and numbers.",
    );
    expect(validateRegister({ ...base, confirmPassword: "x" })).toEqual({
      confirmPassword: "Passwords do not match.",
    });
    expect(validateRegister({ ...base, email: "nope" }).email).toBe(
      "Invalid email address.",
    );
  });

  it("validates password reset", () => {
    expect(
      validateResetPassword({ password: "short", confirmPassword: "" }),
    ).toEqual({
      password: "Password must be at least 8 characters.",
      confirmPassword: "Confirm password is required.",
    });
  });
});
