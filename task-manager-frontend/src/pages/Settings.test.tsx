import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../test/api";
import { renderWithProviders } from "../test/render";
import SettingsPage from "./Settings";

const mock = mockApi();

function mockSettingsData(isDemo: boolean) {
  mock.onGet("/auth/me").reply(200, {
    user: {
      id: 1,
      firstName: "Test",
      lastName: "User",
      email: "user@example.com",
      isDemo,
    },
  });
  mock.onGet("/projects").reply(200, { projects: [] });
  mock.onGet("/labels").reply(200, { labels: [] });
  mock.onGet("/api-tokens").reply(200, { tokens: [] });
}

describe("SettingsPage", () => {
  it("offers to connect Claude", async () => {
    mockSettingsData(false);
    renderWithProviders(<SettingsPage />, { withAuth: true });

    expect(
      await screen.findByRole("heading", { name: "Connect Claude" }),
    ).toBeInTheDocument();
  });

  it("hides it from the demo account, which cannot create tokens", async () => {
    mockSettingsData(true);
    renderWithProviders(<SettingsPage />, { withAuth: true });

    await screen.findByRole("heading", { name: "Labels" });
    expect(
      screen.queryByRole("heading", { name: "Connect Claude" }),
    ).not.toBeInTheDocument();
  });
});
