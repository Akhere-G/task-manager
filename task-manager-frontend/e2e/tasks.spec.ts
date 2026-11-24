import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("task management", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("creates a task, completes it, and the server agrees", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("No tasks found. Time to relax!"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Add new task" }).click();
    await page.getByLabel("Title").fill("Write quarterly report");
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(card(page, "Write quarterly report")).toBeVisible();
    await card(page, "Write quarterly report")
      .getByRole("button", { name: "Mark task as completed" })
      .click();

    await expect(
      page
        .getByRole("region", { name: "Completed" })
        .getByRole("article")
        .filter({ hasText: "Write quarterly report" }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await signedIn.tasks()).map((t) => [t.title, t.isCompleted]),
      )
      .toEqual([["Write quarterly report", true]]);
  });

  test("quick-add turns a sentence into a task the user can review and save", async ({
    page,
    signedIn,
  }) => {
    await signedIn.createProject("Health");
    await page.goto("/addtask");

    await page
      .getByPlaceholder(/Fix the leaking tap/)
      .fill("Dentist tomorrow at 3pm");
    await page
      .getByRole("button", { name: "Generate new task with AI" })
      .click();

    await expect(page.getByLabel("Title")).toHaveValue("Dentist appointment");
    await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue(
      "Health",
    );
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect
      .poll(async () => (await signedIn.tasks()).map((t) => t.title))
      .toEqual(["Dentist appointment"]);
  });
});
