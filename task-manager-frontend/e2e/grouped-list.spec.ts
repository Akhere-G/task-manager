import { dueToday, expect, test } from "./fixtures";

const group = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("region", { name, exact: true });

const stamp = (daysFromNow: number, time: string) => {
  const day = new Date(Date.now() + daysFromNow * 86_400_000);
  return `${day.toISOString().slice(0, 10)} ${time}`;
};

test.describe("grouped list", () => {
  test("puts each task under its group", async ({ page, signedIn }) => {
    await signedIn.createTask({
      title: "Due tonight",
      ...dueToday(),
    });
    await signedIn.createTask({
      title: "Missed it",
      startAt: stamp(-3, "09:00:00"),
      endAt: stamp(-3, "10:00:00"),
    });
    await signedIn.createTask({
      title: "Next month",
      startAt: stamp(30, "09:00:00"),
      endAt: stamp(30, "10:00:00"),
    });
    await signedIn.createTask({ title: "Someday" });

    await page.goto("/");

    await expect(group(page, "Overdue")).toContainText("Missed it");
    await expect(group(page, "Today")).toContainText("Due tonight");
    await expect(group(page, "Upcoming")).toContainText("Next month");
    await expect(group(page, "No date")).toContainText("Someday");
    await expect(group(page, "Completed")).toBeHidden();
  });

  test("shows ten tasks of a group and loads more as it scrolls", async ({
    page,
    signedIn,
  }) => {
    for (let number = 1; number <= 12; number++) {
      const title = `Late ${String(number).padStart(2, "0")}`;
      await signedIn.createTask({
        title,
        startAt: stamp(-5, "09:00:00"),
        endAt: stamp(-5, "10:00:00"),
      });
    }
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("group=overdue")) requests.push(request.url());
    });

    await page.goto("/");
    const overdue = group(page, "Overdue");
    await expect(overdue.getByRole("article")).toHaveCount(10);
    expect(requests[0]).toContain("limit=10");
    await expect(overdue).toContainText("Showing 10 of 12");

    await overdue.getByRole("article").last().scrollIntoViewIfNeeded();
    await expect(overdue.getByRole("article")).toHaveCount(12);
  });

  test("a group menu completes every task in the group", async ({
    page,
    signedIn,
  }) => {
    for (const title of ["Late one", "Late two", "Late three"]) {
      await signedIn.createTask({
        title,
        startAt: stamp(-2, "09:00:00"),
        endAt: stamp(-2, "10:00:00"),
      });
    }
    await page.goto("/");

    await group(page, "Overdue")
      .getByRole("button", { name: "Actions for Overdue" })
      .click();
    await page.getByRole("menuitem", { name: "Complete all 3" }).click();

    await expect(group(page, "Overdue")).toBeHidden();
    await expect(group(page, "Completed")).toContainText("Late one");
    expect((await signedIn.tasks()).every((task) => task.isCompleted)).toBe(
      true,
    );
  });

  test("the list has no completed filter", async ({ page, signedIn }) => {
    void signedIn;
    await page.goto("/");

    await page.getByRole("button", { name: "Show filters" }).click();

    await expect(page.getByRole("group", { name: "Status" })).toBeHidden();
  });
});

test.describe("sidebar", () => {
  test("has no views and lists the inbox first", async ({ page, signedIn }) => {
    await signedIn.createTask({ title: "Loose" });
    const projectId = await signedIn.createProject("Work");
    await signedIn.createTask({ title: "Filed", projectId });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Projects" });
    await expect(page.getByText("Views", { exact: true })).toBeHidden();
    await expect(nav.getByRole("button").first()).toHaveText("Inbox");

    await nav.getByRole("button", { name: "Inbox" }).click();
    await expect(page).toHaveURL(/view=inbox/);
    await expect(
      page.getByRole("article").filter({ hasText: "Loose" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article").filter({ hasText: "Filed" }),
    ).toBeHidden();

    await page.reload();
    await expect(page).toHaveURL(/view=inbox/);
  });
});
