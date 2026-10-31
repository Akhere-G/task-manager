import { expect, test as base, type APIRequestContext } from "@playwright/test";

const API = `http://localhost:${process.env.E2E_API_PORT ?? 5001}/api`;
export const PASSWORD = "Sturdy-pass9";

let counter = 0;
export const uniqueEmail = (label = "user") =>
  `${label}-${Date.now()}-${counter++}@example.com`;

export interface TaskInput {
  title: string;
  category?: string;
  startAt: string;
  endAt: string;
  repeatBy?: string;
  repeatUntil?: string;
}

export interface StoredTask {
  id: number;
  title: string;
  isCompleted: boolean;
  isRepeating: boolean;
  startAt: string;
  repeatDays: (number | string)[] | null;
}

/** Thin client for setting up and checking data through the real API. */
export class Api {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  private headers = { "X-Requested-With": "XMLHttpRequest" };

  async register(email = uniqueEmail()) {
    const response = await this.request.post(`${API}/auth/register`, {
      headers: this.headers,
      data: {
        firstName: "Test",
        lastName: "User",
        email,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    return email;
  }

  async createTask(task: TaskInput): Promise<number> {
    const response = await this.request.post(`${API}/tasks`, {
      headers: this.headers,
      data: { category: "work", ...task },
    });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()).id;
  }

  async tasks(): Promise<StoredTask[]> {
    const response = await this.request.get(`${API}/tasks?is_completed=all`, {
      headers: this.headers,
    });
    expect(response.status()).toBe(200);
    return (await response.json()).tasks;
  }
}

export const test = base.extend<{ api: Api; signedIn: Api }>({
  // Analytics is not under test and must never send real events from a test run.
  context: async ({ context }, provide) => {
    await context.route(/posthog\.com/, (route) => route.abort());
    await provide(context);
  },
  api: async ({ context }, provide) => {
    await provide(new Api(context.request));
  },
  signedIn: async ({ api }, provide) => {
    await api.register();
    await provide(api);
  },
});

export { expect };
