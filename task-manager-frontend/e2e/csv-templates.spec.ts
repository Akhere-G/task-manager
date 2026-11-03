import { expect, test } from "./fixtures";

const TEMPLATES = [
  { name: "Download simple template", rows: 8 },
  { name: "Download Advanced template", rows: 12 },
];

test.describe("csv templates", () => {
  for (const { name, rows } of TEMPLATES) {
    test(`the ${name} uploads as it is`, async ({ page, signedIn }) => {
      await page.goto("/addtask");

      const download = page.waitForEvent("download");
      await page.getByRole("button", { name, exact: false }).click();
      const file = await (await download).path();

      await page.locator('input[type="file"]').setInputFiles(file);

      await expect(page.getByText("Upload Failed")).toBeHidden();
      await expect.poll(async () => (await signedIn.tasks()).length).toBe(rows);
      const tasks = await signedIn.tasks();
      expect(tasks.filter((task) => task.startAt === null)).toHaveLength(1);
      expect(tasks.filter((task) => task.isRepeating)).not.toHaveLength(0);
    });
  }
});
