import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderWithProviders } from "./test/render";
import { mockApi } from "./test/api";

vi.mock("./features/notifications/components/NotificationsPrompt", () => ({
  default: () => null,
}));

// The real Home page pulls in the calendar and charts, which makes these routing tests depend
// on machine speed. The stand-in still fetches tasks through the real service and auth client.
vi.mock("./pages/Home", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  const { taskService } = await import("./features/tasks/api");
  return {
    default: function Home() {
      useQuery({ queryKey: ["tasks"], queryFn: () => taskService.getAll() });
      return <h1>Your tasks</h1>;
    },
  };
});

const user = { id: 1, firstName: "Test", lastName: "User", email: "user@example.com", isDemo: false };

const TASKS = /^\/tasks(\?.*)?$/;
const taskRequests = () => mock.history.get.filter((r) => r.url?.startsWith("/tasks"));

const mock = mockApi();

// App loads its pages lazily. Importing them once up front keeps the tests below about routing
// rather than about how quickly a cold module graph loads on a busy machine.
beforeAll(async () => {
  await Promise.all([
    import("./pages/Register"),
    import("./pages/Login"),
    import("./pages/About"),
    import("./pages/Pomodoro"),
    import("./pages/Settings"),
    import("./pages/Stats"),
    import("./pages/CalendarView"),
    import("./pages/AddTask"),
  ]);
}, 120_000);

beforeEach(() => {
  mock.onGet(TASKS).reply(200, { tasks: [], totalTasks: 0, totalPages: 1, currentPage: 1 });
  mock.onGet("/ai/daily-brief").reply(200, { brief: "" });
  mock.onGet("/stats/dashboard").reply(200, {});
});

function renderApp(path: string) {
  return renderWithProviders(
    <Suspense fallback={<p>loading…</p>}>
      <App />
    </Suspense>,
    { route: path, withAuth: true },
  );
}

describe("route protection", () => {
  it.each(["/", "/calendar", "/stats", "/addtask", "/pomodoro/1", "/settings"])(
    "sends a signed-out visitor from %s to the login page",
    async (path) => {
      mock.onGet("/auth/me").reply(401);

      renderApp(path);

      expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
      expect(taskRequests()).toHaveLength(0);
    },
  );

  it("sends a signed-in user away from the login page", async () => {
    mock.onGet("/auth/me").reply(200, { user });

    renderApp("/login");

    expect(await screen.findByRole("heading", { name: "Your tasks" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });

  it("lets anyone read the public pages", async () => {
    mock.onGet("/auth/me").reply(401);

    renderApp("/about");

    expect(await screen.findByRole("heading", { level: 1, name: /Visualise Your/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });

  it("shows a not-found page for unknown routes", async () => {
    mock.onGet("/auth/me").reply(401);

    renderApp("/no/such/page");

    expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
  });
});

describe("signing in", () => {
  async function submitLogin(email: string, password: string) {
    await userEvent.type(await screen.findByLabelText("Email"), email);
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
  }

  it("takes the user to their tasks after a successful login", async () => {
    mock.onGet("/auth/me").reply(401);
    mock.onPost("/auth/login").reply(200, { user, message: "ok" });

    renderApp("/login");
    await submitLogin("user@example.com", "Sturdy-pass9");

    expect(await screen.findByRole("heading", { name: "Your tasks" })).toBeInTheDocument();
    await waitFor(() => expect(taskRequests().length).toBeGreaterThan(0));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      email: "user@example.com",
      password: "Sturdy-pass9",
    });
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });

  it("shows the server's message for wrong credentials and stays on the page", async () => {
    mock.onGet("/auth/me").reply(401);
    mock.onPost("/auth/login").reply(400, { errors: { general: "Invalid credentials." } });

    renderApp("/login");
    await submitLogin("user@example.com", "wrong-pass1");

    expect(await screen.findByText("Invalid credentials.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("shows a friendly message when the server is unavailable", async () => {
    mock.onGet("/auth/me").reply(401);
    mock.onPost("/auth/login").reply(500);

    renderApp("/login");
    await submitLogin("user@example.com", "Sturdy-pass9");

    expect(await screen.findByText("Sorry... Something went wrong.")).toBeInTheDocument();
  });
});

describe("a session that expires while using the app", () => {
  it("returns the user to the login page when the refresh token is also rejected", async () => {
    mock.onGet("/auth/me").reply(200, { user });
    mock.onGet(TASKS).reply(401);
    mock.onPost("/auth/refresh").reply(401);

    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
  });
});
