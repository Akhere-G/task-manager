import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("projects", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("creates a project and a sub-project, files a task in it and filters by the parent", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/settings");
    await page.getByLabel("Project name").fill("Work");
    await page.getByRole("button", { name: "Add project" }).click();
    await expect(page.getByRole("button", { name: "Edit Work" })).toBeVisible();

    await page.getByLabel("Project name").fill("Reports");
    await page.getByLabel("Parent project").selectOption({ label: "Work" });
    await page.getByRole("button", { name: "Add project" }).click();
    await expect(
      page.getByRole("button", { name: "Edit Reports" }),
    ).toBeVisible();

    await signedIn.createTask({
      title: "Loose end",
      startAt: "2026-03-11 08:00:00",
      endAt: "2026-03-11 08:30:00",
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Add new task" }).click();
    await page.getByLabel("Title").fill("Quarterly numbers");
    await page.getByRole("combobox", { name: "Project" }).click();
    await page.getByRole("option", { name: "Work / Reports" }).click();
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(card(page, "Quarterly numbers")).toBeVisible();
    await expect(card(page, "Quarterly numbers")).toContainText(
      "Work / Reports",
    );
    await expect(card(page, "Loose end")).toContainText("Inbox");

    await page.reload();
    await page.getByRole("button", { name: "Work", exact: true }).click();

    await expect(card(page, "Quarterly numbers")).toBeVisible();
    await expect(card(page, "Loose end")).toBeHidden();
  });
});
