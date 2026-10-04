const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('iOS archive replaces the generated placeholder with the branded opaque icon', () => {
  const png=fs.readFileSync(path.join(ROOT,'ios-icon-1024.png'));
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(1024);
  expect(png[25]).toBe(2); // RGB, no alpha channel
  expect(read('scripts/configure-ios.mjs')).toContain('await copyFile(iconSource, iconDestination)');
});

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
  'safecracker.html',
  'stardefender.html',
  'neonmaze.html'
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
  'neonDrift',
  'mergeRush',
  'perfectDrop',
  'spiralDrop',
  'shapeFit',
  'bounceRun',
  'trafficEscape',
  'starDefender',
  'neonBreach',
  'neonMaze'
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

test('all 23 catalog games stay registered consistently', () => {
  const arcade = read('arcade.js');
  const games = read('games.html');
  const mini = read('mini-games.js');

  const names = objectKeysNear(arcade, 'const names');
  const bestConfig = objectKeysNear(arcade, 'const bestConfig');
  const miniConfigs = objectKeysNear(mini, 'const configs');
  const catalog = [...games.matchAll(/\{\s*key:'([^']+)'/g)].map(match => match[1]);

  expect(new Set(catalog).size).toBe(23);
  expect([...catalog].sort()).toEqual([...expectedGameKeys].sort());
  expect([...names].sort()).toEqual([...expectedGameKeys].sort());
  expect([...bestConfig].sort()).toEqual([...expectedGameKeys].sort());
  expect([...miniConfigs].sort()).toEqual([
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

test('all mobile game screens hide the fixed app nav during live play', () => {
  const css = read('arcade.css');

  expect(css).toContain('body.game-active #arcadeBottomNav');
  expect(css).toContain('body.game-active .topbar');
  expect(css).toContain('display:none!important');
  expect(css).toContain('body.game-active.has-app-nav .container');
  expect(css).toContain('padding-bottom:max(18px,calc(env(safe-area-inset-bottom) + 10px))!important');
});

test('Traffic Escape hides safe answers and keeps late roads difficult', () => {
  const source = read('mini-games.js');
  const html = read('mini.html');

  expect(source).toContain("const roundSeconds=()=>[0,16,14,12,10,9,8,7]");
  expect(source).toContain('const boardsNeeded=()=>1;');
  expect(source).toContain("const targetCars=[0,6,7,8,9,9,10,10]");
  expect(source).toContain("const minBlocked=Math.min(targetCars-1,[0,4,5,6,7,7,8,8]");
  expect(source).toContain("const maxInitiallyFree=2");
  expect(source).toContain("for(let attempt=0;attempt<400;attempt++)");
  expect(source).toContain("const fallback=level>=4?[");
  expect(source).toContain("if(!alive||miniPaused){lastTickAt=performance.now();return;}");
  expect(source).toContain("b.className='traffic-car';");
  expect(source).not.toContain("' clear-path':'')");
  expect(html).not.toContain('.traffic-car.clear-path');
});

test('Neon Dodger runs until collision with fair triple-shift traffic', () => {
  const source = read('dodger.html');

  expect(source).toContain('function difficultyFor(seconds)');
  const progression=require('../dodger-progression.js');
  expect(progression.progress(20).level).toBe(2);
  expect(progression.difficulty(80).speed).toBeGreaterThan(progression.difficulty(0).speed);
  expect(source).toContain('return DodgerProgression.difficulty(seconds);');
  expect(source).toContain('const paired=Math.random()<stage.pairChance;');
  expect(source).toContain('Math.random()<stage.farShiftChance');
  expect(source).toContain('lanes=[Math.max(0,Math.min(2,Math.floor((player.x+player.w/2)/laneWidth)))];');
  expect(source).toContain('const followUpY=-32-stage.speed*stage.followUpGapMs/16.667;');
  expect(source).toContain('addTrafficRow([0,1,2].filter(lane=>lane!==followUpOpen),followUpY,stage.blockWidth');
  expect(source).toContain('addTrafficRow([0,1,2].filter(lane=>lane!==thirdOpen),thirdY,stage.blockWidth');
  expect(source).toContain('lanes=[0,1,2].filter(lane=>lane!==next);');
  expect(source).toContain('function spawnDelayFor(seconds)');
  expect(source).toContain('nextSpawnAt=now+spawnDelayFor(seconds)+followUpGapMs;');
  expect(source).toContain('nextSpawnAt=now+560');
  expect(source).toContain('const seconds=Math.floor(elapsed/1000);');
  expect(source).not.toContain('if(elapsed>=60000)');
  expect(source).toContain('finishGame(seconds);');
  expect(source).toContain('arcadeDodgerTopLevel');
  expect(source).toContain('LEVEL '+"'"+'+runLevel');
});

test('Neon Dodger keeps live play focused and result timing consistent', () => {
  const source = read('dodger.html');

  expect(source).toContain('body.dodger-page.game-active #arcadeBottomNav{display:none!important}');
  expect(source).toContain('body.dodger-page.game-active .topbar,body.dodger-page.game-active #startButton{display:none!important}');
  expect(source).toContain("extra:['⏱️ Time played: '+seconds+'s'");
  expect(source).not.toContain("Math.round((performance.now()-earnlyRunStartedAt-totalPausedMs)/1000)");
});

test('Neon Dodger keeps Quit out of active swipes and stores district progress', () => {
  const source=read('dodger.html');
  expect(source).toContain('game-active:not(.earnly-game-paused) #earnlyQuitButton{display:none!important}');
  expect(source).toContain('id="swipeZone"');
  expect(source).toContain('id="levelGoal"');
  expect(source).toContain("localStorage.setItem('arcadeDodgerTopLevel',String(bestLevel))");
});

test('the mobile pause dock covers dedicated, mini, and Paddle Rally games without breaking bottom swipes', () => {
  const css = read('arcade.css');
  const shared = read('arcade.js');
  const minis = read('mini-games.js');
  const rally = read('paddlerally.html');
  expect(css).toContain('html body.game-active:not(.pause-in-header) #earnlyPauseButton');
  expect(css).toContain('html body.paddlerally-page #pauseButton:not([hidden])');
  expect(css).toContain('bottom:calc(18px + env(safe-area-inset-bottom))!important;');
  expect(shared).toContain("document.body.append(button);");
  for (const game of dedicatedGames.filter(file => file !== 'paddlerally.html')) {
    expect(read(game), game).toContain('Arcade.installPauseControl(');
  }
  expect(minis).toContain('Arcade.installPauseControl(');
  expect(rally).toContain("document.body.append(pauseButton);");
  for (const game of ['coincatch.html', 'brickbreaker.html']) {
    const source = read(game);
    expect(source, game).toContain('pauseBottom<boardTop?pauseBottom+4:Math.max(0,boardTop-110)');
  }
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
    const modern = file === 'stardefender.html' || file === 'neonmaze.html';
    const startIndex = source.indexOf(modern ? 'function start()' : 'function startGame');
    const countdownIndex = source.indexOf('Arcade.countdown', startIndex);

    expect(startIndex, file + ' startGame should exist').toBeGreaterThanOrEqual(0);
    expect(countdownIndex, file + ' countdown should exist').toBeGreaterThan(startIndex);

    const beforeCountdown = source.slice(startIndex, countdownIndex);
    expect(beforeCountdown, file + ' should not count countdown time').not.toMatch(
      modern ? /startedAt\s*=\s*performance\.now\(\)/ : /earnlyRunStartedAt\s*=\s*performance\.now\(\)/
    );

    const countdownBody = source.slice(countdownIndex, countdownIndex + 700);
    expect(countdownBody, file + ' should start its play clock inside countdown completion').toMatch(
      modern ? /startedAt\s*=\s*performance\.now\(\)/ : /earnlyRunStartedAt\s*=\s*performance\.now\(\)/
    );
  }

  const mini = read('mini-games.js');
  const startIndex = mini.indexOf('function startGame');
  const countdownIndex = mini.indexOf('Arcade.countdown', startIndex);
  const countdownBody = mini.slice(countdownIndex, countdownIndex + 700);
  expect(countdownBody).toMatch(/runStartedAt\s*=\s*performance\.now\(\)/);
});

test('native rewarded ads stay play-only in the current release', () => {
  const nativeAds = read('native-ads-entry.js');
  const arcade = read('arcade.js');

  expect(nativeAds).toContain("extraPlays: 'ca-app-pub-8864401806510610/8249888009'");
  expect(nativeAds).not.toContain('bonusCoins');
  expect(arcade).toContain("nativeAds.showRewarded('extraPlays')");
  expect(arcade).not.toContain("showRewarded('bonusCoins')");
});

test('rewarded play unlocks stay play-only and guarded against duplicate grants', () => {
  const arcade = read('arcade.js');

  expect(arcade).toContain('const FREE_PLAYS = 3;');
  expect(arcade).toContain('const PLAY_AD_BONUS = 1;');
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
  expect(resultFlow).toContain("playAd(game, onReplay)");
  expect(resultFlow).toContain("else if (typeof onMorePlays === 'function')");
});

test('result screen shows level progress and a single-play rewarded replay', () => {
  const arcade = read('arcade.js');
  const games = read('games.html');
  const rewards = read('rewards.html');
  expect(arcade).toContain("levelProgress.className = 'result-level-progress'");
  expect(arcade).toContain("'📺 Watch Ad · +1 Play & Replay'");
  expect(arcade).toContain('const PLAY_AD_BONUS = 1;');
  expect(games).toContain('📺 Watch Ad · +1 Play');
  expect(games).not.toContain('+3 Plays');
  expect(rewards).toContain('voluntary +1-play unlocks');
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
  expect(rewards).toContain('not cash, cryptocurrency, or stored value');
  expect(rewards).toContain('eligible in-game features such as Continue');
  expect(home).toContain('Optional rewarded ads unlock extra plays and do not directly award Coins');
  expect(support).toContain('not cash, cryptocurrency, or stored value');
  expect(support).toContain('Some game features can spend Coins');
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


test('iOS release pipeline keeps AdMob mode explicit and SKAdNetwork coverage guarded', () => {
  const configure = read('scripts/configure-ios.mjs');
  const workflow = read('.github/workflows/ios-signed-build.yml');
  const arcadeVersionSource = read('arcade.js');

  expect(configure).toContain('cstr6suwn9.skadnetwork');
  expect(configure).toContain('4fzdc2evr5.skadnetwork');
  expect(configure).toContain('3qcr597p9d.skadnetwork');
  expect(configure).toContain('const skAdNetworkBlock');
  expect(configure).toContain('NSUserTrackingUsageDescription');

  expect(workflow).toContain("contains(github.event.head_commit.message, '[live]')");
  expect(workflow).toContain("inputs.admob_mode == 'live'");
  expect(workflow).toContain('Run release contract tests');
  expect(workflow).toContain('Verify native release mode');
  expect(workflow).toContain('earnly-arcade-ios-signed-${{ env.BUILD_ADMOB_MODE }}');
  expect(workflow).toContain('MARKETING_VERSION=1.0');
  expect(arcadeVersionSource).toContain("const APP_VERSION = '1.1.0';");
});


test('results use game-specific leaderboard gap copy without duplicate best text', () => {
  const arcade = read('arcade.js');
  const nativeArcade = read('www/arcade.js');

  for (const source of [arcade, nativeArcade]) {
    expect(source).toContain("Previous best beaten!");
    expect(source).toContain("function leaderboardUnitLabel(label, value)");
    expect(source).toContain("compactLeaderboardGap(localBest, thirdScore, data?.label)");
    expect(source).toContain("away from Top 3 · View leaderboard →");
    expect(source).not.toContain("Previous best beaten · New best:");
    expect(source).not.toContain("footer.textContent = '🔥 ' + (third - mine).toLocaleString() + ' from Top 3 · View leaderboard →';");
    expect(source).not.toContain("return '🔥 ' + (target - mine).toLocaleString() + ' points from Top 3';");
  }
});


test('Snake keeps most apples inside, occasionally uses the wall row, and draws the true playable boundary', () => {
  for (const source of [read('snake.html'), read('www/snake.html')]) {
    expect(source).toContain('(1 + Math.floor(Math.random() * 18)) * box');
    expect(source).toContain('score - lastWallAppleScore >= 5');
    expect(source).toContain('Math.floor(Math.random() * 20) * box');
    expect(source).toContain('Math.max(120, 180 - Math.floor(score / 3) * 6)');
    expect(source).toContain("ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3)");
    expect(source).toContain('snakeX >= canvas.width');
    expect(source).toContain('snakeY >= canvas.height');
  }
});
