const { test, expect } = require("@playwright/test");

test("room depth preserves foreground pixels and seat swaps retain one anchor", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/earnly-realms.html");
  await page.evaluate(async () => {
    const T = await import("/realms-three.js");
    const { openRoomTracking } = await import("/realms-native.js");
    const renderer = new T.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(96, 96);
    renderer.setPixelRatio(1);
    const canvas = renderer.domElement;
    document.body.append(canvas);
    const camera = new T.PerspectiveCamera(60, 1, 0.03, 50);
    const pose = new T.Matrix4().makeTranslation(0, 0, -2).toArray();
    const mesh = {
      vertices: [-3, -3, 0, 3, -3, 0, 3, 3, 0, -3, 3, 0],
      indices: [0, 1, 2, 0, 2, 3],
    };
    const values = new Uint8Array(96 * 96 * 2);
    for (let i = 0; i < 96 * 96; i++) {
      const cm = i % 96 < 48 ? 80 : 450;
      values[i * 2] = cm & 255;
      values[i * 2 + 1] = cm >> 8;
    }
    const depth = btoa(String.fromCharCode(...values));
    let wall, seat;
    window.seatPlacements = 0;
    window.Capacitor = {
      Plugins: {
        EarnlyRealms: {
          async open() {
            return { hasDepth: true };
          },
          async frame() {
            return {
              depth,
              tracking: true,
              light: 1000,
              projection: camera.projectionMatrix.toArray(),
              view: new T.Matrix4().toArray(),
              wallAnchor: wall,
              seats: seat ? { A: pose } : {},
            };
          },
          async place(args) {
            if (args.surface === "wallFinish") {
              wall = pose;
              return mesh;
            }
            if (args.surface === "seat") {
              seat = true;
              window.seatPlacements++;
              return { id: "A" };
            }
          },
          async saveMap() {},
          async close() {},
          async removeSeat() {
            seat = false;
          },
        },
      },
    };
    window.probe = () => {
      const gl = renderer.getContext(),
        out = [];
      for (const x of [24, 72]) {
        const rgba = new Uint8Array(4);
        gl.readPixels(x, 48, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        out.push(rgba[3]);
      }
      return out;
    };
    await openRoomTracking({
      world: { id: "depth-qa", style: "Reef", wall: "Stone", floor: "Marble" },
      renderer,
      canvas,
      exit: () => renderer.dispose(),
    });
  });
  const mode = page.getByLabel("Placement type");
  await mode.selectOption("Wall");
  await page.getByRole("button", { name: "Place on wall" }).click();
  await expect.poll(() => page.evaluate(() => probe())).toEqual([0, 255]);
  await mode.selectOption("Chair");
  await page.getByRole("button", { name: "Place on seat" }).click();
  await page.getByLabel("Replacement chair").selectOption("Sofa");
  await page.getByRole("button", { name: "Turn chair" }).click();
  await page.getByRole("button", { name: "Save placement" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("earnly.realms.ar.depth-qa")),
  );
  expect(saved.seats).toHaveLength(1);
  expect(saved.seats[0].style).toBe("Sofa");
  expect(saved.seats[0].angle).toBeGreaterThan(0);
  expect(await page.evaluate(() => seatPlacements)).toBe(1);
  await page.getByRole("button", { name: "Restore real chair" }).click();
  await page.getByRole("button", { name: "Save placement" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("earnly.realms.ar.depth-qa")).seats,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Exit AR" }).click();
  expect(errors).toEqual([]);
});
