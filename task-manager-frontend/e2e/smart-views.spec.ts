import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("smart views", () => {
  test("the view buttons filter the list and survive a reload", async ({
    page,
    signedIn,
  }) => {
    const stamp = (daysAgo: number, time: string) => {
      const day = new Date(Date.now() - daysAgo * 86_400_000);
      return `${day.toISOString().slice(0, 10)} ${time}`;
    };
    await signedIn.createTask({
      title: "Due today",
      startAt: stamp(0, "23:00:00"),
      endAt: stamp(0, "23:30:00"),
    });
    await signedIn.createTask({
      title: "Missed it",
      startAt: stamp(3, "09:00:00"),
      endAt: stamp(3, "10:00:00"),
    });
    await page.goto("/");
    await expect(card(page, "Due today")).toBeVisible();
    await expect(card(page, "Missed it")).toBeVisible();

    await page.getByRole("button", { name: /^Today/ }).click();
    await expect(card(page, "Due today")).toBeVisible();
    await expect(card(page, "Missed it")).toBeHidden();

    await page.getByRole("button", { name: /^Overdue/ }).click();
    await expect(card(page, "Missed it")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/view=overdue/);
    await expect(card(page, "Missed it")).toBeVisible();
  });

  test("switching layout keeps the view", async ({ page, signedIn }) => {
    void signedIn;
    await page.goto("/?view=week");

    await page.getByRole("button", { name: "Calendar" }).click();

    await expect(page).toHaveURL(/layout=calendar/);
    await expect(page).toHaveURL(/view=week/);
  });
});
