// Controlled end-state tests using real result and replay handlers.
// Routes local sources and isolates cloud, rewards, and demo ads from live accounts.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = process.env.EARNLY_QA_ROOT || process.cwd();
const output =
  process.env.EARNLY_QA_OUTPUT_DIR || path.join(root, "test-results/lifecycle");
const pw = require(
  process.env.EARNLY_PW_MODULE ||
    require.resolve("playwright", { paths: [root] }),
);
const engine = process.env.EARNLY_QA_ENGINE || "chromium";
const cases = [
  ["snake", "snake.html", "score=10;gameOver()"],
  ["blockDrop", "blockdrop.html", "lines=4;score=400;gameOver()"],
  ["brickBreaker", "brickbreaker.html", "totalBroken=10;finishGame()"],
  ["coinCatch", "coincatch.html", "score=10;finish()"],
  ["colorMatch", "colormatch.html", "score=10;finish()"],
  ["dodger", "dodger.html", "finishGame(10)"],
  ["jungleHopper", "junglehopper.html", "score=10;finishGame()"],
  ["laneRunner", "lanerunner.html", "seconds=10;passed=10;finish()"],
  ["memory", "memory.html", "moves=16;finishGame()"],
  ["paddleRally", "paddlerally.html", "score=10;finish()"],
  ["safeCracker", "safecracker.html", "score=10;finish()"],
  ["tapRush", "taprush.html", "hits=10;finishGame()"],
  ["towerStack", "towerstack.html", "floors=10;finishGame()"],
  ["neonMaze", "neonmaze.html", "collected=12;finish()", "closure"],
  [
    "starDefender",
    "stardefender.html",
    "score=160;kills=2;finish()",
    "closure",
  ],
  ...[
    "blockGrid",
    "mergeRush",
    "perfectDrop",
    "spiralDrop",
    "shapeFit",
    "bounceRun",
    "trafficEscape",
  ].map((g) => [g, "mini.html?game=" + g, "finish(120,5)", "mini"]),
];
const results = [];
let completions = 0;
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
async function snapshot(p, g) {
  return p.evaluate(
    (g) => ({
      plays: Arcade.remaining(g),
      used: Arcade.number(g + "GamesPlayed"),
      bonus: Arcade.number(g + "BonusPlays"),
      points: Arcade.number("points"),
      xp: Arcade.number("arcadeXP"),
      runs: Arcade.number("gameRuns_" + g),
      earn: window.__qaCounts.earn,
      records: window.__qaCounts.records,
      dialogs: document.querySelectorAll("dialog.game-result-dialog[open]")
        .length,
    }),
    g,
  );
}
async function tick(p, ms) {
  await p.clock.runFor(ms);
}
async function ready(p) {
  for (let i = 0; i < 24; i++) {
    if (
      await p
        .locator("#gameStatus")
        .evaluate(
          (e) =>
            e.classList.contains("running") &&
            !/get ready|starting/i.test(e.textContent),
        )
    )
      return;
    await tick(p, 400);
  }
  throw Error(
    "run never reached Running: " +
      (await p.locator("#gameStatus").textContent()),
  );
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const b = await pw[engine].launch(
    engine === "chromium"
      ? {
          executablePath: process.env.EARNLY_QA_CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--no-zygote",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : { headless: true },
  );
  try {
    for (const width of [390, 440])
      for (const [g, url, end, mode] of cases.filter(
        (c) =>
          !process.env.EARNLY_QA_GAME || c[0] === process.env.EARNLY_QA_GAME,
      )) {
        const c = await b.newContext({
          ...pw.devices["iPhone 14"],
          viewport: { width, height: width === 390 ? 844 : 956 },
          deviceScaleFactor: 1,
          serviceWorkers: "block",
        });
        const p = await c.newPage();
        const errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        try {
          await p.route("**/*", async (r) => {
            const u = new URL(r.request().url());
            if (u.hostname !== "earnly-qa.test") {
              await r.abort();
              return;
            }
            if (u.pathname.endsWith("/cloud.js")) {
              await r.fulfill({
                contentType: "application/javascript",
                body: "",
              });
              return;
            }
            const file = path.join(root, decodeURIComponent(u.pathname));
            try {
              let body = await fs.readFile(file);
              if (path.extname(file) === ".html") {
                let s = body.toString();
                if (mode === "closure")
                  s = s.replace(
                    "    function finish(){",
                    "    window.__qaEnd=()=>{" +
                      end +
                      "};\n    function finish(){",
                  );
                else if (mode !== "mini")
                  s = s.replace(
                    "</body>",
                    "<script>window.__qaEnd=()=>{" + end + "};</script></body>",
                  );
                body = Buffer.from(s);
              } else if (file.endsWith("/mini-games.js")) {
                body = Buffer.from(
                  body
                    .toString()
                    .replace(
                      "  function finish(metric,",
                      "  window.__qaEnd=()=>{" +
                        end +
                        "};\n  function finish(metric,",
                    ),
                );
              }
              await r.fulfill({
                status: 200,
                contentType:
                  mime[path.extname(file)] || "application/octet-stream",
                body,
              });
            } catch (e) {
              await r.fulfill({ status: 404, body: "" });
            }
          });
          await p.addInitScript(() => {
            localStorage.setItem("arcadeOnboardingSeen", "1");
            localStorage.setItem("arcadeSoundEnabled", "0");
            window.EarnlyCloud = {
              leaderboard: async () => ({ entries: [], label: "score" }),
              submitLeaderboardScore: async () => ({ ok: true }),
            };
          });
          const time = new Date("2026-10-02T12:00:00Z");
          await p.clock.install({ time });
          await p.clock.pauseAt(time);
          await p.goto("http://earnly-qa.test/" + url);
          await p.evaluate(() => {
            window.__qaCounts = { earn: 0, records: 0 };
            for (const [name, count] of [
              ["earn", "earn"],
              ["recordResult", "records"],
            ]) {
              const fn = Arcade[name];
              Arcade[name] = function (...a) {
                window.__qaCounts[count]++;
                return fn.apply(this, a);
              };
            }
          });
          assert.equal(
            await p.evaluate(() => typeof window.__qaEnd),
            "function",
            "missing end hook",
          );
          assert.equal((await snapshot(p, g)).plays, 3);
          const start = p.locator(
            g === "blockDrop" ? "#blockDropBoardStart" : "#startButton",
          );
          if (await start.isVisible()) await start.tap();
          else
            await p
              .locator("#surface,#game,.game-guide-surface,#board")
              .first()
              .tap();
          await ready(p);
          for (let round = 1; round <= 4; round++) {
            const before = await snapshot(p, g);
            assert.equal(
              before.used,
              round,
              "play consumed once before run " + round,
            );
            assert.equal(before.plays, Math.max(0, 3 - round));
            if (width === 440 && round === 2) {
              const pause = p
                .locator("#earnlyPauseButton,#pauseButton")
                .first();
              await pause.tap();
              assert.equal(
                await p.locator("#gameStatus").textContent(),
                "Paused",
              );
            }
            await p.evaluate(() => {
              __qaEnd();
              __qaEnd();
              __qaEnd();
            });
            await tick(p, 400);
            if (g === "brickBreaker") {
              const endRun = p.getByRole("button", { name: /End Run/ });
              if (await endRun.isVisible()) await endRun.tap();
              await tick(p, 400);
            }
            const dialog = p.locator("dialog.game-result-dialog[open]");
            for (let wait = 0; wait < 10 && !(await dialog.count()); wait++)
              await tick(p, 100);
            assert.equal(await dialog.count(), 1, "exactly one result dialog");
            const after = await snapshot(p, g);
            assert.equal(after.earn, before.earn + 1, "single reward call");
            assert.equal(
              after.records,
              before.records + 1,
              "single result record",
            );
            assert.equal(after.runs, round, "single completed run");
            assert.equal(after.used, round, "finish must not spend a play");
            await p.clock.fastForward(10000);
            assert.deepEqual(
              await snapshot(p, g),
              after,
              "state drift after game over",
            );
            assert.equal(
              errors.length,
              0,
              "script errors: " + errors.join(";"),
            );
            completions++;
            const primary = dialog.locator(".result-actions button").first();
            assert.match(
              await primary.textContent(),
              round < 3 ? /Play Again/ : /Watch Ad/,
            );
            if (round < 4) {
              await primary.evaluate((e) => (window.__qaReplayButton = e));
              await primary.tap();
              await p.evaluate(() => {
                __qaReplayButton.click();
                __qaReplayButton.click();
              });
              await tick(p, 500);
              assert.equal(
                await p.locator("dialog.game-result-dialog[open]").count(),
                0,
                "result dismissed before replay",
              );
              await ready(p);
              const replayed = await snapshot(p, g);
              assert.equal(
                replayed.used,
                round + 1,
                "replay consumed exactly one",
              );
              assert.equal(replayed.earn, after.earn, "no reward on restart");
              assert.equal(
                replayed.records,
                after.records,
                "no result on restart",
              );
              if (round === 3) {
                assert.equal(replayed.bonus, 1, "one rewarded play unlocked");
                assert.equal(
                  replayed.plays,
                  0,
                  "rewarded play consumed by replay",
                );
                assert.equal(
                  replayed.points,
                  after.points,
                  "ad does not award Coins",
                );
              }
            } else {
              assert.equal(after.plays, 0);
              assert.equal(after.bonus, 1);
            }
          }
          results.push({
            engine,
            game: g,
            width,
            pass: true,
            completedRuns: 4,
          });
          console.log(
            "PASS " +
              engine +
              " " +
              width +
              " " +
              g +
              " 4 end/replay cycles including rewarded replay",
          );
        } catch (e) {
          results.push({
            engine,
            game: g,
            width,
            pass: false,
            error: e.message,
            errors,
          });
          console.log(
            "FAIL " + engine + " " + width + " " + g + " " + e.message,
          );
          await p
            .screenshot({
              path: path.join(
                output,
                "failure-" + engine + "-" + width + "-" + g + ".png",
              ),
            })
            .catch(() => {});
        } finally {
          await c.close();
        }
      }
  } finally {
    await b.close();
    await fs.writeFile(
      path.join(output, "results-" + engine + ".json"),
      JSON.stringify(
        {
          engine,
          completedRuns: completions,
          passed: results.filter((r) => r.pass).length,
          failed: results.filter((r) => !r.pass).length,
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        engine,
        completedRuns: completions,
        passed: results.filter((r) => r.pass).length,
        failed: results.filter((r) => !r.pass).length,
      }),
    );
  }
  process.exitCode = results.some((r) => !r.pass) ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
