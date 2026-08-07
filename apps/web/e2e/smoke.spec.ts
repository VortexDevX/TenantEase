import { expect, test } from "@playwright/test";

test("register page loads with owner auth action", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("button", { name: /send otp/i })).toBeVisible();
});

test("login page accepts a phone number", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/mobile number/i).fill("9876543210");
  await expect(page.getByLabel(/mobile number/i)).toHaveValue("9876543210");
});

test("public listing missing slug shows not found", async ({ page }) => {
  const response = await page.goto("/pg/not-a-real-listing");
  expect(response?.status()).toBeGreaterThanOrEqual(200);
  await expect(page.locator("body")).toContainText(/404|not found/i);
});

test("owner can register, complete profile, and create first property", async ({ page }) => {
  const phone = `9${Date.now().toString().slice(-9)}`;
  await page.goto("/register");
  await page.getByLabel(/mobile number/i).fill(phone);
  await page.getByRole("button", { name: /send otp/i }).click();
  await expect(page.getByText(/local debug otp/i)).toBeVisible();
  await page.getByRole("button", { name: /create owner account/i }).click();

  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await page.getByLabel(/full name/i).fill("E2E Owner");
  await page.getByLabel(/business or brand name/i).fill("E2E PG");
  await page.getByRole("button", { name: /continue to dashboard/i }).click();

  await expect(page.getByLabel(/property name/i)).toBeVisible();
  await page.getByLabel(/property name/i).fill(`E2E Property ${phone.slice(-4)}`);
  await page.getByLabel(/pin code/i).fill("560001");
  await page.getByLabel(/full address/i).fill("1 E2E Street");
  await page.getByLabel(/city/i).fill("Bengaluru");
  await page.getByLabel(/state/i).fill("Karnataka");
  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(page.getByRole("heading", { name: `E2E Property ${phone.slice(-4)}` })).toBeVisible();
});
