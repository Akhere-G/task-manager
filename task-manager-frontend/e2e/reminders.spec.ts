import { expect, test } from "./fixtures";

test("a task is saved with the reminders picked in the form", async ({
  page,
  signedIn,
}) => {
  await page.goto("/addtask");
  await page.getByLabel("Title").fill("Prepare the demo");
  await page.getByLabel("Description").fill("Slides and a run-through");
  await page.getByRole("button", { name: "1 hour before" }).click();
  await page.getByRole("button", { name: "Start of day" }).click();
  await page.getByRole("button", { name: "Add Task", exact: true }).click();

  await expect
    .poll(async () => {
      const task = (await signedIn.tasks()).find(
        (t) => t.title === "Prepare the demo",
      );
      return task?.reminders.map((r) => r.kind);
    })
    .toEqual(["before", "before", "clock"]);
});
