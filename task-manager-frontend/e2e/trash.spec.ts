import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("trash", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("a deleted task can be found in the trash and restored", async ({
    page,
    signedIn,
  }) => {
    await signedIn.createTask({
      title: "Water the plants",
      startAt: "2026-03-11 09:00:00",
      endAt: "2026-03-11 09:30:00",
    });
    await page.goto("/");

    await card(page, "Water the plants")
      .getByRole("button", { name: /Delete task/ })
      .click();
    await expect(
      page.getByText(/restore it from Trash for 30 days/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete Task", exact: true })
      .click();
    await expect(card(page, "Water the plants")).toBeHidden();

    await page.goto("/trash");
    await expect(page.getByText("Water the plants")).toBeVisible();
    await expect(page.getByText(/\d+ days left/)).toBeVisible();

    await page
      .getByRole("button", { name: "Restore task Water the plants" })
      .click();
    await expect(page.getByText("Trash is empty.")).toBeVisible();

    await page.goto("/");
    await expect(card(page, "Water the plants")).toBeVisible();
    expect((await signedIn.tasks()).map((t) => t.title)).toEqual([
      "Water the plants",
    ]);
  });
});
