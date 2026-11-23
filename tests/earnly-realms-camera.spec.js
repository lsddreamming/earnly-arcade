const { test, expect } = require("@playwright/test");
test("rear camera starts, textured wall tracks translation, blank view hides placement and Exit stops camera", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async (opts) => {
          window.opts = opts;
          let shift = 0;
          const pattern = document.createElement("canvas");
          pattern.width = 390;
          pattern.height = 844;
          const p = pattern.getContext("2d");
          let seed = 215;
          function random() {
            seed = (1664525 * seed + 1013904223) >>> 0;
            return seed / 4294967296;
          }
          for (let i = 0; i < 6500; i++) {
            p.fillStyle =
              "rgb(" +
              [1, 2, 3].map(() => Math.floor(random() * 255)).join(",") +
              ")";
            p.fillRect(
              random() * 390,
              random() * 844,
              3 + random() * 12,
              4 + random() * 20,
            );
          }
          const out = document.createElement("canvas");
          out.width = 390;
          out.height = 844;
          const ctx = out.getContext("2d");
          window.shift = (x) => {
            shift = x;
          };
          setInterval(() => {
            ctx.fillStyle = "#ddd";
            ctx.fillRect(0, 0, 390, 844);
            ctx.drawImage(pattern, shift, 0);
          }, 50);
          window.feed = out.captureStream(20);
          return window.feed;
        },
      },
    });
  });
  await page.goto("/earnly-realms.html");
  await page.getByRole("button", { name: /Transform my room/ }).click();
  const place = page.getByRole("button", { name: "Place here" });
  await expect(place).toBeEnabled();
  await page.waitForTimeout(300);
  await place.click();
  const overlay = page.locator(".wall-art");
  await expect(overlay).toBeVisible();
  const x = () =>
    overlay.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  const initial = await x();
  await page.evaluate(() => shift(16));
  await expect.poll(x).toBeGreaterThan(initial + 7);
  await page.getByLabel("Room effect").selectOption("Lava");
  await expect(overlay).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Outline floor" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Outline floor" }).click();
  for (const [x, y] of [
    [50, 460],
    [325, 445],
    [345, 630],
    [30, 660],
  ])
    await page.mouse.click(x, y);
  await expect(overlay).toHaveCount(1);
  await page.getByRole("button", { name: "Confirm floor" }).click();
  await expect(overlay).toHaveCount(2);
  await expect(overlay.nth(1)).toBeVisible();
  await page.getByLabel("Room effect").selectOption("Marble");
  await expect(overlay).toHaveCount(2);
  await page.evaluate(() => shift(1000));
  await expect(overlay.first()).toBeHidden();
  await expect(overlay.nth(1)).toBeHidden();
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  expect(await page.evaluate(() => feed.getTracks()[0].readyState)).toBe(
    "ended",
  );
  expect(errors).toEqual([]);
});
