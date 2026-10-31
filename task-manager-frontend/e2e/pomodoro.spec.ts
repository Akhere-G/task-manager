import { expect, test } from "./fixtures";

test("working through a Pomodoro session completes the task and updates the stats", async ({
  page,
  signedIn,
}) => {
  await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  await signedIn.api.createTask({
    title: "Deep work",
    startAt: "2026-03-11 13:00:00",
    endAt: "2026-03-11 14:00:00",
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Start task: Deep work" }).click();
  await expect(page.getByRole("heading", { name: "Pomodoro Mode", exact: true })).toBeVisible();
  await expect(page.getByText("25:00")).toBeVisible();

  await page.getByRole("button", { name: "Play Timer" }).click();
  await expect(page.getByRole("button", { name: "Pause Timer" })).toBeVisible();
  await page.getByRole("button", { name: "Pause Timer" }).click();

  await page.getByRole("button", { name: "Finished early" }).click();
  await expect(page.getByText("Complete task: Deep work?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("button", { name: "Add new task" })).toBeVisible();
  await expect
    .poll(async () => (await signedIn.api.tasks()).map((t) => t.isCompleted))
    .toEqual([true]);

  await page.goto("/stats");
  const completionRate = page.getByRole("heading", { name: "Completion Rate" }).locator("..");
  await expect(completionRate).toContainText("100");
});
