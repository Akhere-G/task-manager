import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test("snoozing a task to tomorrow moves it out of Today", async ({
  page,
  signedIn,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  await signedIn.createTask({
    title: "Pay the invoice",
    startAt: `${today} 23:00:00`,
    endAt: `${today} 23:30:00`,
  });
  await page.goto("/?view=today");
  await expect(card(page, "Pay the invoice")).toBeVisible();

  await card(page, "Pay the invoice")
    .getByRole("button", { name: /Snooze task/ })
    .click();
  await page.getByRole("menuitem", { name: "Tomorrow" }).click();

  await expect(card(page, "Pay the invoice")).toBeHidden();
  const stored = (await signedIn.tasks()).find(
    (t) => t.title === "Pay the invoice",
  );
  expect(stored?.startAt).not.toContain(today);
});
