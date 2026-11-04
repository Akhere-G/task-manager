import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("labels", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("creates a label, tags a task with it and filters by it", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/settings");
    await page.getByLabel("Label name").fill("urgent");
    await page.getByRole("button", { name: "Add label" }).click();
    await expect(
      page.getByRole("button", { name: "Edit urgent" }),
    ).toBeVisible();

    await signedIn.createTask({
      title: "Untagged",
      startAt: "2026-03-11 08:00:00",
      endAt: "2026-03-11 08:30:00",
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Add new task" }).click();
    await page.getByLabel("Title").fill("Pay invoice");
    await page
      .getByRole("group", { name: "Labels" })
      .getByRole("button", { name: "urgent" })
      .click();
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(card(page, "Pay invoice")).toContainText("urgent");
    await expect(card(page, "Untagged")).not.toContainText("urgent");

    const labelId = await signedIn.labelIdByName("urgent");
    await page.goto(`/?label=${labelId}`);

    await expect(card(page, "Pay invoice")).toBeVisible();
    await expect(card(page, "Untagged")).toBeHidden();
  });
});
