import { Api, expect, PASSWORD, test, uniqueEmail } from "./fixtures";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("registers, signs out, and signs back in", async ({ page }) => {
  const email = uniqueEmail("journey");
  await page.goto("/register");

  await page.getByLabel("First Name").fill("Ada");
  await page.getByLabel("Last Name").fill("Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText("No tasks found. Time to relax!")).toBeVisible();

  await page.getByRole("button", { name: "Maybe later" }).click();
  await page.getByRole("button", { name: "Account Menu" }).click();
  await page.locator('button[aria-label="Logout"]:visible').click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("No tasks found. Time to relax!")).toBeVisible();
});

test("rejects a wrong password", async ({ page, api }) => {
  const email = await api.register();
  await page.context().clearCookies();
  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Wrong-pass1");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Invalid credentials.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("one user cannot open another user's task", async ({ browser, baseURL, signedIn, page }) => {
  const taskId = await signedIn.api.createTask({
    title: "Private plan",
    startAt: "2026-03-11 09:00:00",
    endAt: "2026-03-11 10:00:00",
  });
  await page.goto(`/pomodoro/${taskId}`);
  await expect(page.getByText("Private plan")).toBeVisible();

  const intruder = await browser.newContext({ baseURL });
  const intruderPage = await intruder.newPage();
  await new Api(intruder.request).register();
  await intruderPage.goto(`/pomodoro/${taskId}`);

  // A 404 is retried by TanStack Query's defaults before the page gives up, hence the wait.
  await expect(intruderPage.getByText("This task doesn't exist")).toBeVisible({ timeout: 20_000 });
  await expect(intruderPage.getByText("Private plan")).toBeHidden();
  await intruder.close();
});
