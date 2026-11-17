import { expect, test } from "./fixtures";

test.beforeEach(async ({ signedIn }) => {
  await signedIn.createTask({ title: "Alpha" });
});

test("on desktop the tasks sit to the right of the sidebar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("article").first().waitFor();
  const sidebar = await page
    .getByRole("navigation", { name: "Projects" })
    .boundingBox();
  const card = await page.getByRole("article").first().boundingBox();
  if (!sidebar || !card) throw new Error("Page is not laid out");

  expect(card.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
  expect(card.y).toBeLessThan(sidebar.y + sidebar.height);
});

test("on mobile the sidebar is a button above the tasks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.getByText("Alpha").first().waitFor();
  const button = page.getByRole("button", { name: "Projects", exact: true });
  await expect(page.getByRole("navigation", { name: "Projects" })).toBeHidden();
  const box = await button.boundingBox();
  const card = await page.getByText("Alpha").first().boundingBox();
  if (!box || !card) throw new Error("Page is not laid out");

  expect(card.y).toBeGreaterThan(box.y + box.height);
});

test("hovering a task does not change the height of any row", async ({
  page,
  signedIn,
}) => {
  await signedIn.createTask({ title: "Beta" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const rows = page.getByRole("article");
  await rows.nth(1).waitFor();

  const heights = async () => {
    const boxes = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
    return boxes;
  };
  const before = await heights();
  await rows.first().hover();
  expect(await heights()).toEqual(before);
});
