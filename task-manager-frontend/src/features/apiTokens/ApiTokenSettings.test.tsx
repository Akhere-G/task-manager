import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../test/api";
import { renderWithProviders } from "../../test/render";
import { ApiTokenSettings } from "./ApiTokenSettings";

const mock = mockApi();
const laptop = {
  id: 1,
  name: "laptop",
  scope: "write",
  prefix: "tm_abcde",
  createdAt: "2026-11-01T09:00:00Z",
  lastUsedAt: null,
};

describe("ApiTokenSettings", () => {
  it("lists tokens without ever showing their secret", async () => {
    mock.onGet("/api-tokens").reply(200, { tokens: [laptop] });
    renderWithProviders(<ApiTokenSettings />);

    expect(await screen.findByText("laptop")).toBeInTheDocument();
    expect(screen.getByText(/tm_abcde/)).toBeInTheDocument();
    expect(screen.getByText(/Never used/)).toBeInTheDocument();
  });

  it("creates a token with the chosen access and shows the connect command once", async () => {
    mock.onGet("/api-tokens").reply(200, { tokens: [] });
    mock
      .onPost("/api-tokens")
      .reply(201, { ...laptop, scope: "read", token: "tm_secret-value" });
    renderWithProviders(<ApiTokenSettings />);

    await userEvent.type(screen.getByLabelText("Token name"), "laptop");
    await userEvent.selectOptions(screen.getByLabelText("Access"), "read");
    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      name: "laptop",
      scope: "read",
    });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      "claude mcp add --transport http taskflow",
    );
    expect(notice).toHaveTextContent("Authorization: Bearer tm_secret-value");
    expect(notice).toHaveTextContent("Claude on the web");
    expect(notice).toHaveTextContent("Header valueBearer tm_secret-value");

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText(/tm_secret-value/)).not.toBeInTheDocument();
  });

  it("shows the server's message when creating fails", async () => {
    mock.onGet("/api-tokens").reply(200, { tokens: [] });
    mock.onPost("/api-tokens").reply(400, {
      errors: { name: "Name must be 1 to 100 characters." },
    });
    renderWithProviders(<ApiTokenSettings />);

    await userEvent.type(screen.getByLabelText("Token name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name must be 1 to 100 characters.",
    );
  });

  it("revokes a token after confirming", async () => {
    mock.onGet("/api-tokens").reply(200, { tokens: [laptop] });
    mock.onDelete("/api-tokens/1").reply(200, {});
    window.confirm = () => true;
    renderWithProviders(<ApiTokenSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Revoke laptop" }),
    );

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });

  it("does not revoke when the confirmation is declined", async () => {
    mock.onGet("/api-tokens").reply(200, { tokens: [laptop] });
    window.confirm = () => false;
    renderWithProviders(<ApiTokenSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Revoke laptop" }),
    );

    expect(mock.history.delete).toHaveLength(0);
  });
});
