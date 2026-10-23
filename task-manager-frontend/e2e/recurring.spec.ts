import { expect, test } from "./fixtures";

// Fixed "today" so the calendar always shows March 2026.
const TODAY = new Date("2026-03-11T12:00:00Z");

test("a recurring task is projected onto the calendar without being saved", async ({
  page,
  signedIn,
}) => {
  await page.clock.setFixedTime(TODAY);
  await signedIn.api.createTask({
    title: "Standup",
    startAt: "2026-03-09 09:00:00",
    endAt: "2026-03-09 09:15:00",
    repeatBy: "daily",
    repeatUntil: "2026-03-13",
  });
  const events = page.locator(".rbc-event");

  await page.goto("/calendar?due_date=calendar_view");

  // The stored task on the 9th plus an occurrence on each of the 10th to the 13th.
  await expect(events).toHaveCount(5);
  await page.reload();
  await expect(events).toHaveCount(5);
  expect(await signedIn.api.tasks()).toHaveLength(1);
});

test("completing a recurring task moves it on and never duplicates occurrences", async ({
  page,
  signedIn,
}) => {
  await page.clock.setFixedTime(TODAY);
  await signedIn.api.createTask({
    title: "Standup",
    startAt: "2026-03-09 09:00:00",
    endAt: "2026-03-09 09:15:00",
    repeatBy: "daily",
    repeatUntil: "2026-03-13",
  });
  const events = page.locator(".rbc-event");
  await page.goto("/calendar?due_date=calendar_view");
  await expect(events).toHaveCount(5);

  await events.first().click();
  await page.getByRole("button", { name: "Mark task as completed" }).click();

  // The completed occurrence leaves the open-task calendar; the series continues from the 10th.
  await expect(events).toHaveCount(4);
  await expect
    .poll(async () => (await signedIn.api.tasks()).map((t) => [t.isCompleted, t.isRepeating]).sort())
    .toEqual([
      [false, true],
      [true, false],
    ]);

  await page.reload();
  await expect(events).toHaveCount(4);
  expect(await signedIn.api.tasks()).toHaveLength(2);
});
