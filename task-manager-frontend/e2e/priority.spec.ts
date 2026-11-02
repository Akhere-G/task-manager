import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("priority", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("a P1 task added through the form sorts above earlier tasks", async ({
    page,
    signedIn,
  }) => {
    await signedIn.createTask({
      title: "Routine check-in",
      startAt: "2026-03-11 08:00:00",
      endAt: "2026-03-11 08:30:00",
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Add new task" }).click();
    await page.getByLabel("Title").fill("Fix the outage");
    await page.getByLabel("Priority").selectOption("1");
    await page.getByRole("button", { name: "Add Task", exact: true }).click();

    await expect(card(page, "Fix the outage")).toBeVisible();
    await expect
      .poll(async () =>
        (await signedIn.tasks()).map((t) => [t.title, t.priority]),
      )
      .toContainEqual(["Fix the outage", 1]);

    await page.goto("/?sort_by=priority&order=asc");

    await expect(page.getByRole("article").locator("h3").first()).toHaveText(
      "Fix the outage",
    );
    await expect(
      card(page, "Fix the outage").getByRole("img", { name: "Priority 1" }),
    ).toBeVisible();
    await expect(
      card(page, "Routine check-in").getByRole("img", { name: /Priority/ }),
    ).toHaveCount(0);
  });
});
