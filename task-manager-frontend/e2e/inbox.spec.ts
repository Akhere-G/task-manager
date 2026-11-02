import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("inbox", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("captures a title-only task, then dates it from the edit form", async ({
    page,
    signedIn,
  }) => {
    const projectId = await signedIn.createProject("Work");
    await signedIn.createTask({
      title: "Filed away",
      projectId,
      startAt: "2026-03-11 08:00:00",
      endAt: "2026-03-11 08:30:00",
    });
    await page.goto("/inbox");

    await page.getByLabel("Quick capture").fill("Call the dentist");
    await page.getByRole("button", { name: "Capture" }).click();

    await expect(card(page, "Call the dentist")).toBeVisible();
    await expect(card(page, "Call the dentist")).toContainText("No date");
    await expect(card(page, "Filed away")).toBeHidden();
    const stored = (await signedIn.tasks()).find(
      (t) => t.title === "Call the dentist",
    );
    expect(stored?.startAt).toBeNull();

    await card(page, "Call the dentist")
      .getByRole("button", { name: /Edit task/ })
      .click();
    await page.getByRole("checkbox", { name: "Has a date" }).check();
    await page.getByLabel("Start At").fill("2026-03-12T09:00");
    await page.getByLabel("End At").fill("2026-03-12T09:30");
    await page.getByRole("button", { name: "Edit Task", exact: true }).click();

    await expect(card(page, "Call the dentist")).not.toContainText("No date");
    await expect
      .poll(
        async () =>
          (await signedIn.tasks()).find((t) => t.title === "Call the dentist")
            ?.startAt,
      )
      .not.toBeNull();
  });
});
