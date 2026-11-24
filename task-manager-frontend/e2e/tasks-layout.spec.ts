import { expect, test } from "./fixtures";

test.beforeEach(async ({ signedIn }) => {
  await signedIn.createTask({ title: "Alpha" });
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
