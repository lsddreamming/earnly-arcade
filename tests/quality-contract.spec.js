const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const dedicatedGames = [
  'snake.html',
  'blockdrop.html',
  'taprush.html',
  'memory.html',
  'dodger.html',
  'brickbreaker.html',
  'junglehopper.html',
  'towerstack.html',
  'coincatch.html',
  'colormatch.html',
  'paddlerally.html',
  'lanerunner.html',
  'safecracker.html'
];

const expectedGameKeys = [
  'snake',
  'blockDrop',
  'tapRush',
  'memory',
  'dodger',
  'brickBreaker',
  'jungleHopper',
  'towerStack',
  'coinCatch',
  'colorMatch',
  'paddleRally',
  'laneRunner',
  'safeCracker',
  'blockGrid',
  'mergeRush',
  'perfectDrop',
  'spiralDrop',
  'shapeFit',
  'bounceRun',
  'trafficEscape'
];

function objectKeysNear(source, label) {
  const labelIndex = source.indexOf(label);
  expect(labelIndex, label + ' should exist').toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', labelIndex);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let end = -1;

  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  expect(end, label + ' object should close').toBeGreaterThan(open);
  return [...source.slice(open + 1, end).matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:/gm)]
    .map(match => match[1]);
}

test('all 20 catalog games stay registered consistently', () => {
  const arcade = read('arcade.js');
  const games = read('games.html');
  const mini = read('mini-games.js');

  const names = objectKeysNear(arcade, 'const names');
  const bestConfig = objectKeysNear(arcade, 'const bestConfig');
  const miniConfigs = objectKeysNear(mini, 'const configs');
  const catalog = [...games.matchAll(/\{\s*key:'([^']+)'/g)].map(match => match[1]);

  expect(new Set(catalog).size).toBe(20);
  expect([...catalog].sort()).toEqual([...expectedGameKeys].sort());
  expect([...names].sort()).toEqual([...expectedGameKeys].sort());
  expect([...bestConfig].sort()).toEqual([...expectedGameKeys].sort());
  expect([...miniConfigs].sort()).toEqual([
    'blockGrid',
    'bounceRun',
    'mergeRush',
    'perfectDrop',
    'shapeFit',
    'spiralDrop',
    'trafficEscape'
  ].sort());
});

test('dedicated games keep the shared play, result, and out-of-plays contract', () => {
  for (const file of dedicatedGames) {
    const source = read(file);
    expect(source, file + ' consumes exactly one play per start path').toContain('Arcade.consume(');
    expect(source, file + ' uses the shared result dialog').toContain('Arcade.gameResult(');
    expect(source, file + ' uses the shared out-of-plays flow').toContain('Arcade.out(');
    expect(source, file + ' must not use browser alert').not.toMatch(/\balert\s*\(/);
    expect(source, file + ' must not use browser confirm').not.toMatch(/\bconfirm\s*\(/);
    expect(source, file + ' loads premium styling').toMatch(/premium\.css/);
    expect(source, file + ' supports iPhone safe areas').toMatch(/viewport-fit=cover/);
  }
});

test('Neon Dodger keeps live play focused and result timing consistent', () => {
  const source = read('dodger.html');

  expect(source).toContain('body.dodger-page.game-active #arcadeBottomNav{display:none!important}');
  expect(source).toContain('body.dodger-page.game-active .topbar,body.dodger-page.game-active #startButton{display:none!important}');
  expect(source).toContain("extra:['⏱️ Time played: '+seconds+'s'");
  expect(source).not.toContain("Math.round((performance.now()-earnlyRunStartedAt-totalPausedMs)/1000)");
});

test('Lane Runner smooth steering uses physical car position for collisions', () => {
  const source = read('lanerunner.html');

  expect(source).toContain("playerX+=(lanes[targetLane]-playerX)");
  expect(source).toContain("Math.abs(lanes[o.lane]-playerX)<40");
  expect(source).not.toContain("const crossedPlayer=o.lane===lane");
  expect(source).toContain("Fixed, low-contrast lane guides avoid flicker");
  expect(source).not.toContain("ctx.setLineDash([24,20])");
});

test('gameplay clocks start after the 3-2-1 countdown', () => {
  for (const file of dedicatedGames) {
    const source = read(file);
    const startIndex = source.indexOf('function startGame');
    const countdownIndex = source.indexOf('Arcade.countdown', startIndex);

    expect(startIndex, file + ' startGame should exist').toBeGreaterThanOrEqual(0);
    expect(countdownIndex, file + ' countdown should exist').toBeGreaterThan(startIndex);

    const beforeCountdown = source.slice(startIndex, countdownIndex);
    expect(beforeCountdown, file + ' should not count countdown time').not.toMatch(
      /earnlyRunStartedAt\s*=\s*performance\.now\(\)/
    );

    const countdownBody = source.slice(countdownIndex, countdownIndex + 700);
    expect(countdownBody, file + ' should start its play clock inside countdown completion').toMatch(
      /earnlyRunStartedAt\s*=\s*performance\.now\(\)/
    );
  }

  const mini = read('mini-games.js');
  const startIndex = mini.indexOf('function startGame');
  const countdownIndex = mini.indexOf('Arcade.countdown', startIndex);
  const countdownBody = mini.slice(countdownIndex, countdownIndex + 700);
  expect(countdownBody).toMatch(/runStartedAt\s*=\s*performance\.now\(\)/);
});

test('rewarded play unlocks stay play-only and guarded against duplicate grants', () => {
  const arcade = read('arcade.js');

  expect(arcade).toContain('const FREE_PLAYS = 3;');
  expect(arcade).toContain('const PLAY_AD_BONUS = 3;');
  expect(arcade).toContain('const PLAY_AD_DAILY_LIMIT = 2;');
  expect(arcade).toContain("if (latestStatus.remaining <= 0 || remaining(g) > 0) return null;");
  expect(arcade).toContain("if (remaining(g) > 0)");
  expect(arcade).toContain("setNumber(g + 'PlayAdUnlocks', latestStatus.used + 1);");
  expect(arcade).toContain('grantPlays(g, PLAY_AD_BONUS);');

  const playAdStart = arcade.indexOf('function playAd(');
  const outStart = arcade.indexOf('function out(', playAdStart);
  const rewardedFlow = arcade.slice(playAdStart, outStart);
  expect(rewardedFlow).not.toMatch(/\bearn\s*\(/);
  expect(rewardedFlow).not.toMatch(/setNumber\(\s*['"]points['"]/);
});

test('result replay checks the live play balance before acting', () => {
  const arcade = read('arcade.js');
  const start = arcade.indexOf('function gameResult(');
  const end = arcade.indexOf('function toast(', start);
  const resultFlow = arcade.slice(start, end);

  expect(resultFlow).toContain('const livePlays = game ? remaining(game) : resultPlaysLeft;');
  expect(resultFlow).toContain("if (livePlays > 0)");
  expect(resultFlow).toContain("else if (typeof onMorePlays === 'function')");
});


test('current release keeps unreleased rewards and account deletion clear', () => {
  const rewards = read('rewards.html');
  const home = read('index.html');
  const support = read('support.html');
  const privacy = read('privacy.html');
  const account = read('account.html');
  const cloud = read('cloud.js');

  // Do not market specific payout methods that the current App Store build
  // does not actually offer.
  expect(rewards).not.toMatch(/Bitcoin|Gift Cards|Redeem later|Coin-to-dollar|COMING SOON/i);
  expect(rewards).toContain('Future reward options are being evaluated');
  expect(rewards).toContain('They are not cash, cryptocurrency, or stored value');
  expect(home).toContain('Optional rewarded ads unlock extra plays and do not directly award Coins');
  expect(support).toContain('They are not cash, cryptocurrency, or stored value');
  expect(privacy).toContain('cannot be redeemed, transferred, or withdrawn in this version');

  // Account creation must have an in-app deletion path.
  expect(account).toContain('id="cloudDeleteButton"');
  expect(account).toContain('Delete My Account');
  expect(account).toContain('EarnlyCloud.deleteAccount()');
  expect(cloud).toContain("functions.invoke('delete-account'");
  expect(cloud).toContain('body:{ confirm:true }');
  expect(cloud).toContain('Arcade.clearSyncEvents?.()');
  expect(cloud).toContain('deleteAccount,');
  expect(privacy).toContain('permanently delete their Earnly account');
});
