import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../test/api";
import { renderWithProviders } from "../test/render";
import Register from "./Register";

const mock = mockApi();

describe("registration terms", () => {
  it("requires agreement before creating an account", async () => {
    mock.onGet("/auth/me").reply(401);
    mock.onPost("/auth/register").reply(201, {
      message: "ok",
      user: {
        id: 1,
        firstName: "Test",
        lastName: "User",
        email: "user@example.com",
      },
    });
    renderWithProviders(<Register />, { route: "/register", withAuth: true });

    const registerButton = await screen.findByRole("button", {
      name: "Register",
    });
    expect(registerButton).toBeDisabled();
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );

    await userEvent.type(screen.getByLabelText("First Name"), "Test");
    await userEvent.type(screen.getByLabelText("Last Name"), "User");
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Sturdy-pass9");
    await userEvent.type(
      screen.getByLabelText("Confirm Password"),
      "Sturdy-pass9",
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /I agree to the Terms of Use/ }),
    );
    expect(registerButton).toBeEnabled();
    await userEvent.click(registerButton);

    await waitFor(() =>
      expect(mock.history.post.some((r) => r.url === "/auth/register")).toBe(
        true,
      ),
    );
    const registerRequest = mock.history.post.find(
      (r) => r.url === "/auth/register",
    );
    expect(JSON.parse(registerRequest?.data)).toMatchObject({
      acceptedTerms: true,
      email: "user@example.com",
    });
  });
});
