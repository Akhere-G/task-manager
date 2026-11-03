import { expect, test } from "./fixtures";

test("a dragged card keeps its new place after a reload", async ({
  page,
  signedIn,
}) => {
  for (const title of ["Gamma", "Beta", "Alpha"]) {
    await signedIn.createTask({ title });
  }
  await page.goto("/?sort_by=manual");
  const titles = () => page.getByRole("article").getByRole("heading");
  await expect(titles()).toHaveText(["Alpha", "Beta", "Gamma"]);

  const last = page.getByRole("article").filter({ hasText: "Gamma" });
  const first = page.getByRole("article").filter({ hasText: "Alpha" });
  const from = await last.boundingBox();
  const to = await first.boundingBox();
  if (!from || !to) throw new Error("Cards are not laid out");
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 30, {
    steps: 4,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + 10, { steps: 12 });
  const frames = await page.evaluateHandle(() => {
    const seen: string[] = [];
    const sample = () => {
      const order = [...document.querySelectorAll("article h2, article h3")];
      seen.push(order.map((heading) => heading.textContent).join(","));
      requestAnimationFrame(sample);
    };
    sample();
    return seen;
  });
  const released = await frames.evaluate((seen) => seen.length);
  await page.mouse.up();
  await page.waitForTimeout(300);

  const afterDrop = (await frames.jsonValue()).slice(released + 1);
  expect(afterDrop.filter((order) => order !== afterDrop.at(-1))).toEqual([]);
  await expect(titles()).toHaveText(["Gamma", "Alpha", "Beta"]);
  await page.reload();
  await expect(titles()).toHaveText(["Gamma", "Alpha", "Beta"]);
});
