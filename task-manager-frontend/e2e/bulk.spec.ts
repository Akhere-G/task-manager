import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test("selecting tasks completes them in one action", async ({
  page,
  signedIn,
}) => {
  await signedIn.createTask({ title: "Bulk one" });
  await signedIn.createTask({ title: "Bulk two" });
  await signedIn.createTask({ title: "Bulk three" });
  await page.goto("/");

  await card(page, "Bulk one").hover();
  await page.getByRole("checkbox", { name: "Select task: Bulk one" }).click();
  await page.getByRole("checkbox", { name: "Select task: Bulk two" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button", { name: /^Complete$/ }).click();
  await expect(page.getByRole("toolbar")).toBeHidden();

  const stored = await signedIn.tasks();
  const done = (title: string) =>
    stored.find((t) => t.title === title)?.isCompleted;
  expect(done("Bulk one")).toBe(true);
  expect(done("Bulk two")).toBe(true);
  expect(done("Bulk three")).toBe(false);
});

test("bulk delete asks first and then removes the tasks", async ({
  page,
  signedIn,
}) => {
  await signedIn.createTask({ title: "Gone one" });
  await signedIn.createTask({ title: "Gone two" });
  await page.goto("/");

  await card(page, "Gone one").hover();
  await page.getByRole("checkbox", { name: "Select task: Gone one" }).click();
  await page.getByRole("checkbox", { name: "Select task: Gone two" }).click();
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();

  await expect(card(page, "Gone one")).toBeHidden();
  await expect(card(page, "Gone two")).toBeHidden();
});
