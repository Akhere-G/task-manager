import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const TODAY = new Date("2026-03-11T12:00:00Z");
const WEEKLY_STANDUP = {
  title: "Standup",
  startAt: "2026-03-09 09:00:00",
  endAt: "2026-03-09 10:00:00",
  repeatBy: "weekly",
};

const weekOf = (day: string) =>
  `/calendar?due_date=calendar_view&view=week&current_date=${day}T00:00:00.000Z`;

async function dragToNextDay(page: Page, event: Locator) {
  await event.scrollIntoViewIfNeeded();
  const from = await event.boundingBox();
  const columns = page.locator(".rbc-time-content .rbc-day-slot");
  const firstColumn = await columns.nth(0).boundingBox();
  const secondColumn = await columns.nth(1).boundingBox();
  if (!from || !firstColumn || !secondColumn) throw new Error("Calendar is not laid out");

  const x = from.x + from.width / 2;
  const y = from.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 5 });
  await page.mouse.move(x + (secondColumn.x - firstColumn.x), y, { steps: 10 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
});

test("dragging a saved repeating task to the next day moves it without skipping a week", async ({
  page,
  signedIn,
}) => {
  await signedIn.createTask(WEEKLY_STANDUP);
  await page.goto(weekOf("2026-03-09"));
  const standup = page.locator(".rbc-event").filter({ hasText: "Standup" });
  await expect(standup).toHaveCount(1);

  await dragToNextDay(page, standup);

  await expect
    .poll(async () => (await signedIn.tasks()).map((t) => [t.startAt, t.repeatDays]))
    .toEqual([["2026-03-10T09:00:00Z", [1]]]);
});

test("dragging a ghost moves the whole series to the new weekday", async ({
  page,
  signedIn,
}) => {
  await signedIn.createTask(WEEKLY_STANDUP);
  await page.goto(weekOf("2026-03-16"));
  const standup = page.locator(".rbc-event").filter({ hasText: "Standup" });
  await expect(standup).toHaveCount(1);

  await dragToNextDay(page, standup);

  await expect
    .poll(async () => (await signedIn.tasks()).map((t) => [t.startAt, t.repeatDays]))
    .toEqual([["2026-03-10T09:00:00Z", [1]]]);
  await page.reload();
  await expect(standup).toHaveCount(1);
  await expect(page.locator(".rbc-day-slot").nth(1).locator(".rbc-event")).toHaveCount(1);
});
