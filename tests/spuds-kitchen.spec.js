const { test, expect } = require("@playwright/test");
test("first order, pantry and save survive a return to the kitchen", async ({
  page,
}) => {
  await page.goto("/spuds-kitchen.html");
  const cells = page.locator("#board button");
  await expect(cells).toHaveCount(80);
  await cells.nth(18).click();
  await cells.nth(19).click();
  await page.locator("#orders button").first().click();
  await expect(page.locator("#hud")).toContainText("$6");
  await cells.nth(20).click();
  await page.getByRole("button", { name: "Store", exact: true }).click();
  await page.reload();
  await expect(page.locator("#hud")).toContainText("$6");
  await page.getByRole("button", { name: "Journal" }).click();
  await page.getByRole("button", { name: "Pantry", exact: true }).click();
  await page.getByRole("button", { name: "Wheat ear" }).click();
  await expect(page.locator("article")).toContainText("0 / 4");
});
