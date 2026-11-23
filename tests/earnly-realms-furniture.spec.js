const { test, expect } = require("@playwright/test");
test("the AR furniture chooser serves all three USDZ assets and previews", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token) {
      return token === "ar" || supports.call(this, token);
    };
  });
  await page.goto("/earnly-realms.html");
  await page.getByRole("button", { name: "Place furniture in AR" }).click();
  for (const name of ["Throne", "Sofa", "Recliner"]) {
    const image = page.getByRole("img", { name, exact: true });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((i) => i.naturalWidth))
      .toBeGreaterThan(0);
    const link = image.locator("..");
    await expect(link).toHaveAttribute("rel", "ar");
    const model = await request.get("/" + (await link.getAttribute("href")));
    expect(model.status()).toBe(200);
    expect((await model.body()).readUInt32LE(0)).toBe(0x04034b50);
  }
});
