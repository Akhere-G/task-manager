import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("article").filter({ hasText: title });

test.describe("subtasks", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    void signedIn;
    await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  });

  test("a breakdown becomes subtasks that only show in the task details", async ({
    page,
    signedIn,
  }) => {
    await signedIn.createTask({
      title: "Plan launch",
      startAt: "2026-03-11 14:00:00",
      endAt: "2026-03-11 15:00:00",
    });
    await page.goto("/");

    await card(page, "Plan launch")
      .getByRole("button", { name: /Break down task/ })
      .click();
    await page
      .getByRole("button", { name: "Break down tasks into subtasks" })
      .click();
    await expect(page.getByText("Step 3")).toBeVisible();
    await page.getByRole("button", { name: "Save all subtasks" }).click();

    await expect(page).toHaveURL(/\/\?task=\d+/);
    const checklist = page.getByRole("region", { name: "Subtasks" });
    await expect(checklist.getByRole("checkbox")).toHaveCount(3);
    await expect(checklist.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );

    for (const step of ["Step 1", "Step 2", "Step 3"]) {
      const checkbox = checklist.getByRole("checkbox", { name: step });
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    }
    await expect(checklist.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );

    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/task=/);
    await expect(card(page, "Plan launch")).toContainText("3/3");
    await expect(card(page, "Step 1")).toBeHidden();
  });
});
