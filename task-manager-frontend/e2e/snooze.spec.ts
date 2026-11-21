import { dueToday, expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test("snoozing a task to tomorrow moves it from Today to Upcoming", async ({
  page,
  signedIn,
}) => {
  const day = new Date().toISOString().slice(0, 10);
  await signedIn.createTask({
    title: "Pay the invoice",
    ...dueToday(),
  });
  await page.goto("/");
  const today = page.getByRole("region", { name: "Today" });
  await expect(
    today.getByRole("article").filter({ hasText: "Pay the invoice" }),
  ).toBeVisible();

  await card(page, "Pay the invoice").hover();
  await card(page, "Pay the invoice")
    .getByRole("button", { name: /Snooze task/ })
    .click();
  await page.getByRole("menuitem", { name: "Tomorrow" }).click();

  await expect(
    page
      .getByRole("region", { name: "Upcoming" })
      .getByRole("article")
      .filter({ hasText: "Pay the invoice" }),
  ).toBeVisible();
  const stored = (await signedIn.tasks()).find(
    (t) => t.title === "Pay the invoice",
  );
  expect(stored?.startAt).not.toContain(day);
});
