import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import AiAddTaskForm from "./components/AiAddTaskForm";
import DailyBrief from "./components/DailyBrief";
import PrioritySuggestions from "./components/PrioritySuggestions";
import { mockApi } from "../../test/api";

const mock = mockApi();

describe("natural-language quick add", () => {
  const parsed = {
    title: "Dentist",
    description: null,
    projectId: 4,
    startAt: "2026-03-02 15:00:00",
    endAt: "2026-03-02 16:00:00",
    isRepeating: false,
    repeatBy: null,
    repeatUntil: "",
  };

  async function ask(text: string) {
    await userEvent.type(screen.getByRole("textbox"), text);
    await userEvent.click(
      screen.getByRole("button", { name: "Generate new task with AI" }),
    );
  }

  it("sends the text and hands the parsed task to the form", async () => {
    mock.onPost("/ai/parse-task").reply(200, parsed);
    const onParsed = vi.fn();
    renderWithProviders(<AiAddTaskForm onParsed={onParsed} />);

    await ask("Dentist at 3pm");

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      text: "Dentist at 3pm",
    });
    expect(onParsed.mock.calls[0][0]).toMatchObject({
      title: "Dentist",
      projectId: 4,
      repeatUntil: null,
    });
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("cannot be submitted while empty", () => {
    renderWithProviders(<AiAddTaskForm onParsed={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Generate new task with AI" }),
    ).toBeDisabled();
  });

  it.each([
    ["a server error", () => mock.onPost("/ai/parse-task").reply(500)],
    ["a rate limit", () => mock.onPost("/ai/parse-task").reply(429)],
    ["a network failure", () => mock.onPost("/ai/parse-task").networkError()],
  ])("keeps the text and stays usable after %s", async (_name, arrange) => {
    arrange();
    const onParsed = vi.fn();
    renderWithProviders(<AiAddTaskForm onParsed={onParsed} />);

    await ask("Dentist at 3pm");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate new task with AI" }),
      ).toBeEnabled(),
    );
    expect(onParsed).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Dentist at 3pm");
  });
});

describe("daily brief", () => {
  it("renders the generated brief as formatted text", async () => {
    mock
      .onGet("/ai/daily-brief")
      .reply(200, { brief: "## Today\n\nStart with **the report**." });
    renderWithProviders(<DailyBrief />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open daily brief" }),
    );

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("the report").tagName).toBe("STRONG");
    expect(mock.history.get[0].params).toHaveProperty("tz");
  });

  it("does not render raw HTML from the model", async () => {
    mock
      .onGet("/ai/daily-brief")
      .reply(200, { brief: "Hello <img src=x onerror=alert(1)> there" });
    const { container } = renderWithProviders(<DailyBrief />);

    await screen.findByRole("button", { name: "Open daily brief" });

    expect(container.querySelector("img")).toBeNull();
  });

  it("reloads on request", async () => {
    mock
      .onGet("/ai/daily-brief")
      .replyOnce(200, { brief: "First" })
      .onGet("/ai/daily-brief")
      .reply(200, { brief: "Second" });
    renderWithProviders(<DailyBrief />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Open daily brief" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Reload daily brief" }),
    );

    expect(await screen.findByText("Second")).toBeInTheDocument();
  });

  it("shows an error message when the brief cannot be loaded", async () => {
    mock.onGet("/ai/daily-brief").reply(500);
    renderWithProviders(<DailyBrief />);

    expect(
      await screen.findByText("Error loading brief..."),
    ).toBeInTheDocument();
  });

  it("renders nothing when the brief is empty", async () => {
    mock.onGet("/ai/daily-brief").reply(200, { brief: "" });
    renderWithProviders(<DailyBrief />);

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Open daily brief" }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("priority suggestions", () => {
  const suggestion = {
    taskId: 7,
    title: "Pay rent",
    currentPriority: 4,
    suggestedPriority: 1,
    reason: "Due tomorrow",
  };

  const requestSuggestions = () =>
    userEvent.click(screen.getByRole("button", { name: "Suggest priorities" }));

  it("lists the suggested changes with their reasons", async () => {
    mock.onPost("/ai/suggest-priorities").reply(200, { suggestions: [suggestion] });
    renderWithProviders(<PrioritySuggestions />);

    await requestSuggestions();

    expect(await screen.findByText("Pay rent")).toBeInTheDocument();
    expect(screen.getByText(/P4 → P1\. Due tomorrow/)).toBeInTheDocument();
  });

  it("applies an accepted suggestion and removes it from the list", async () => {
    mock.onPost("/ai/suggest-priorities").reply(200, { suggestions: [suggestion] });
    mock.onPatch("/tasks/7").reply(200, {});
    renderWithProviders(<PrioritySuggestions />);
    await requestSuggestions();

    await userEvent.click(await screen.findByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(screen.queryByText("Pay rent")).not.toBeInTheDocument(),
    );
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ priority: 1 });
  });

  it("dismisses a suggestion without changing the task", async () => {
    mock.onPost("/ai/suggest-priorities").reply(200, { suggestions: [suggestion] });
    renderWithProviders(<PrioritySuggestions />);
    await requestSuggestions();

    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Pay rent")).not.toBeInTheDocument();
    expect(mock.history.patch).toHaveLength(0);
  });

  it("says when nothing needs changing", async () => {
    mock.onPost("/ai/suggest-priorities").reply(200, { suggestions: [] });
    renderWithProviders(<PrioritySuggestions />);

    await requestSuggestions();

    expect(
      await screen.findByText("No priority changes suggested."),
    ).toBeInTheDocument();
  });

  it("shows an error and stays usable when the request fails", async () => {
    mock.onPost("/ai/suggest-priorities").reply(502);
    renderWithProviders(<PrioritySuggestions />);

    await requestSuggestions();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not get suggestions",
    );
    expect(
      screen.getByRole("button", { name: "Suggest priorities" }),
    ).toBeEnabled();
  });
});
