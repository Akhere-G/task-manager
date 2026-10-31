import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("task management", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("creates a task, completes it, and the server agrees", async ({ page, signedIn }) => {
    await page.goto("/");
    await expect(page.getByText("No tasks found. Time to relax!")).toBeVisible();

    await page.getByRole("button", { name: "Add new task" }).click();
    await page.getByLabel("Title").fill("Write quarterly report");
    await page.getByLabel("Category").selectOption("work");
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(card(page, "Write quarterly report")).toBeVisible();
    await card(page, "Write quarterly report")
      .getByRole("button", { name: "Mark task as completed" })
      .click();

    await expect(card(page, "Write quarterly report")).toBeHidden();
    await expect
      .poll(async () => (await signedIn.tasks()).map((t) => [t.title, t.isCompleted]))
      .toEqual([["Write quarterly report", true]]);
  });

  test("deletes a task after confirming", async ({ page, signedIn }) => {
    await signedIn.createTask({
      title: "Water the plants",
      startAt: "2026-03-11 09:00:00",
      endAt: "2026-03-11 09:30:00",
    });
    await signedIn.createTask({
      title: "Keep me",
      startAt: "2026-03-11 10:00:00",
      endAt: "2026-03-11 10:30:00",
    });
    await page.goto("/");

    await card(page, "Water the plants").getByRole("button", { name: /Delete task/ }).click();
    await page.getByRole("button", { name: "Delete Task", exact: true }).click();

    await expect(card(page, "Water the plants")).toBeHidden();
    await expect(card(page, "Keep me")).toBeVisible();
    expect((await signedIn.tasks()).map((t) => t.title)).toEqual(["Keep me"]);
  });

  test("explains a missing title and creates nothing", async ({ page, signedIn }) => {
    await page.goto("/addtask");

    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(page.getByText("Title is mandatory.")).toBeVisible();
    await expect(page).toHaveURL(/\/addtask/);
    expect(await signedIn.tasks()).toEqual([]);
  });

  test("keeps the form and says so when the server fails", async ({ page, signedIn }) => {
    await page.route("**/api/tasks", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, json: { error: "boom" } })
        : route.continue(),
    );
    await page.goto("/addtask");
    await page.getByLabel("Title").fill("Will not save");
    await page.getByLabel("Category").selectOption("home");

    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(page.getByText("Could not send data")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue("Will not save");
    expect(await signedIn.tasks()).toEqual([]);
  });

  test("quick-add turns a sentence into a task the user can review and save", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/addtask");

    await page.getByPlaceholder(/Fix the leaking tap/).fill("Dentist tomorrow at 3pm");
    await page.getByRole("button", { name: "Generate new task with AI" }).click();

    await expect(page.getByLabel("Title")).toHaveValue("Dentist appointment");
    await expect(page.getByLabel("Category")).toHaveValue("health");
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect
      .poll(async () => (await signedIn.tasks()).map((t) => t.title))
      .toEqual(["Dentist appointment"]);
  });
});
