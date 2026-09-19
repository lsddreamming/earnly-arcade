// Earnly prototype storage only. No real ad SDK or cash-out system is connected yet.
const Arcade = (() => {
  const names = {
    snake: 'Snake',
    blockDrop: 'Block Drop',
    tapRush: 'Tap Rush',
    memory: 'Memory Match',
    dodger: 'Neon Dodger',
    brickBreaker: 'Brick Breaker',
    jungleHopper: 'Jungle Hopper',
    towerStack: 'Tower Stack',
    coinCatch: 'Coin Catch',
    colorMatch: 'Color Match',
    paddleRally: 'Paddle Rally',
    laneRunner: 'Lane Runner',
    safeCracker: 'Safe Cracker',
    blockGrid: 'Block Grid',
    mergeRush: 'Merge Rush',
    perfectDrop: 'Perfect Drop',
    spiralDrop: 'Spiral Drop',
    shapeFit: 'Shape Fit',
    bounceRun: 'Bounce Run',
    trafficEscape: 'Traffic Escape'
  };

  const bestConfig = {
    snake: { key: 'snakeBest', label: 'apples', lower: false },
    blockDrop: { key: 'blockDropBestLines', label: 'lines', lower: false },
    tapRush: { key: 'tapRushBest', label: 'hits', lower: false },
    memory: { key: 'memoryBestMoves', label: 'moves', lower: true },
    dodger: { key: 'dodgerBest', label: 'seconds', lower: false },
    brickBreaker: { key: 'brickBreakerBest', label: 'bricks', lower: false },
    jungleHopper: { key: 'jungleHopperBest', label: 'vines', lower: false },
    towerStack: { key: 'towerStackBest', label: 'floors', lower: false },
    coinCatch: { key: 'coinCatchBest', label: 'catches', lower: false },
    colorMatch: { key: 'colorMatchBest', label: 'matches', lower: false },
    paddleRally: { key: 'paddleRallyBest', label: 'rallies', lower: false },
    laneRunner: { key: 'laneRunnerBest', label: 'seconds', lower: false },
    safeCracker: { key: 'safeCrackerBest', label: 'locks', lower: false },
    blockGrid: { key: 'blockGridBest', label: 'points', lower: false },
    mergeRush: { key: 'mergeRushBest', label: 'points', lower: false },
    perfectDrop: { key: 'perfectDropBest', label: 'hits', lower: false },
    spiralDrop: { key: 'spiralDropBest', label: 'rows', lower: false },
    shapeFit: { key: 'shapeFitBest', label: 'correct', lower: false },
    bounceRun: { key: 'bounceRunBest', label: 'distance', lower: false },
    trafficEscape: { key: 'trafficEscapeBest', label: 'cars', lower: false }
  };

  const FREE_PLAYS = 3;
  const PLAY_AD_BONUS = 3;
  const PLAY_AD_DAILY_LIMIT = 2;
  const DAILY_BONUS = 10;
  const CHALLENGE_VERSION = '5';
  const BASE_GAME_XP = 10;
  const ACHIEVEMENT_XP = 25;
  const WEEKLY_ALL_CLEAR_XP = 100;
  const DATA_SCHEMA_VERSION = 1;
  const APP_VERSION = '0.17.0';

  const streakRewardDefinitions = [
    { days:3, icon:'🔥', title:'3-Day Streak', rewardXP:25 },
    { days:7, icon:'📅', title:'7-Day Streak', rewardXP:50 },
    { days:14, icon:'⚡', title:'14-Day Streak', rewardXP:100 }
  ];

  const weeklyMissionDefinitions = [
    { id:'games10', icon:'🎮', title:'Arcade Regular', description:'Finish 10 games this week', goal:10, rewardXP:40, type:'games' },
    { id:'variety4', icon:'🗺️', title:'Mix It Up', description:'Finish 4 different games this week', goal:4, rewardXP:50, type:'variety' },
    { id:'jungle20', icon:'🐸', title:'Jungle Trek', description:'Pass 20 total vines in Jungle Hopper', goal:20, rewardXP:50, type:'metric', game:'jungleHopper' },
    { id:'tower25', icon:'🏗️', title:'Sky Builder', description:'Stack 25 total Tower Stack floors', goal:25, rewardXP:50, type:'metric', game:'towerStack' }
  ];

  const challengeDefinitions = [
    { id:'variety', title:'🎮 Arcade Explorer', description:'Finish 2 different games today', goal:2, reward:8, type:'variety' },
    { id:'snake10', title:'🐍 Snake Run', description:'Eat 10 apples in one Snake run', goal:10, reward:10, type:'score', game:'snake' },
    { id:'block3', title:'🧱 Line Clearer', description:'Clear 3 lines in one Block Drop game', goal:3, reward:8, type:'score', game:'blockDrop' },
    { id:'tap20', title:'🎯 Quick Fingers', description:'Hit 20 targets in one Tap Rush game', goal:20, reward:8, type:'score', game:'tapRush' },
    { id:'dodger15', title:'🚗 Stay Alive', description:'Survive 15 seconds in Neon Dodger', goal:15, reward:8, type:'score', game:'dodger' },
    { id:'brick15', title:'💥 Brick Smasher', description:'Break 15 bricks in one Brick Breaker run', goal:15, reward:8, type:'score', game:'brickBreaker' },
    { id:'jungle8', title:'🐸 Vine Hopper', description:'Pass 8 vines in Jungle Hopper', goal:8, reward:10, type:'score', game:'jungleHopper' },
    { id:'tower10', title:'🏗️ High Rise', description:'Stack 10 floors in Tower Stack', goal:10, reward:10, type:'score', game:'towerStack' },
    { id:'memory', title:'🧠 Memory Master', description:'Finish one Memory Match board today', goal:1, reward:8, type:'complete', game:'memory' },
    { id:'coinCatch15', title:'💰 Coin Magnet', description:'Catch 15 coins in one Coin Catch run', goal:15, reward:10, type:'score', game:'coinCatch' },
    { id:'colorMatch18', title:'🎨 Color Brain', description:'Get 18 correct matches in Color Match', goal:18, reward:10, type:'score', game:'colorMatch' },
    { id:'paddleRally12', title:'🏓 Rally Time', description:'Return 12 balls in one Paddle Rally run', goal:12, reward:10, type:'score', game:'paddleRally' },
    { id:'laneRunner20', title:'🏎️ Highway Run', description:'Survive 20 seconds in Lane Runner', goal:20, reward:10, type:'score', game:'laneRunner' },
    { id:'safeCracker8', title:'🔐 Crack the Safe', description:'Crack 8 locks in one Safe Cracker run', goal:8, reward:10, type:'score', game:'safeCracker' },
    { id:'blockGrid250', title:'🧩 Grid Builder', description:'Score 250 points in Block Grid', goal:250, reward:10, type:'score', game:'blockGrid' },
    { id:'mergeRush800', title:'🔢 Merge Machine', description:'Score 800 points in Merge Rush', goal:800, reward:10, type:'score', game:'mergeRush' },
    { id:'perfectDrop10', title:'🎯 Drop Zone', description:'Land 10 hits in Perfect Drop', goal:10, reward:10, type:'score', game:'perfectDrop' },
    { id:'spiralDrop10', title:'🌀 Spiral Dive', description:'Pass 10 rows in Spiral Drop', goal:10, reward:10, type:'score', game:'spiralDrop' },
    { id:'shapeFit10', title:'🧠 Shape Solver', description:'Get 10 correct in Shape Fit', goal:10, reward:10, type:'score', game:'shapeFit' },
    { id:'bounceRun100', title:'⚪ Bounce Distance', description:'Reach 100 distance in Bounce Run', goal:100, reward:10, type:'score', game:'bounceRun' },
    { id:'trafficEscape10', title:'🚦 Traffic Clear', description:'Clear 10 cars in Traffic Escape', goal:10, reward:10, type:'score', game:'trafficEscape' }
  ];

  function dateKey(date = new Date()) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }

  function number(key) {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  function setNumber(key, value) {
    localStorage.setItem(key, String(Math.max(0, Math.floor(Number(value) || 0))));
  }

  function applyServerWallet(wallet) {
    if (!wallet || typeof wallet !== 'object') return null;

    const balance = Math.max(0, Math.floor(Number(wallet.balance) || 0));
    const lifetime = Math.max(
      balance,
      Math.max(0, Math.floor(Number(wallet.lifetime_earned) || 0))
    );
    const before = {
      balance:number('points'),
      lifetime:number('lifetimePoints')
    };

    setNumber('points', balance);
    setNumber('lifetimePoints', lifetime);

    const detail = {
      balance,
      lifetime,
      previousBalance:before.balance,
      previousLifetime:before.lifetime
    };
    window.dispatchEvent(new CustomEvent('earnly-wallet-change', { detail }));
    return detail;
  }

  const textScaleOptions = {
    compact:100,
    comfortable:110,
    large:120,
    xlarge:130
  };

  function textScale() {
    const saved = localStorage.getItem('arcadeTextScale');
    return Object.prototype.hasOwnProperty.call(textScaleOptions, saved) ? saved : 'comfortable';
  }

  function textScalePercent() {
    return textScaleOptions[textScale()];
  }

  function applyTextScale() {
    const scale = textScale();
    const percent = textScaleOptions[scale];
    document.documentElement.style.setProperty('-webkit-text-size-adjust', percent + '%');
    document.documentElement.style.setProperty('text-size-adjust', percent + '%');
    document.documentElement.dataset.textScale = scale;
    return { scale, percent };
  }

  function setTextScale(scale) {
    if (!Object.prototype.hasOwnProperty.call(textScaleOptions, scale)) return applyTextScale();
    localStorage.setItem('arcadeTextScale', scale);
    const result = applyTextScale();
    queueEvent('text_scale_changed', result);
    window.dispatchEvent(new CustomEvent('earnly-text-scale-change', { detail:result }));
    return result;
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(value))));
  }

  function randomId(prefix = 'evt') {
    if (crypto && typeof crypto.randomUUID === 'function') {
      return prefix + '_' + crypto.randomUUID();
    }
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function deviceId() {
    let id = localStorage.getItem('arcadeDeviceId');
    if (!id) {
      id = randomId('device');
      localStorage.setItem('arcadeDeviceId', id);
    }
    return id;
  }

  function pendingSyncEvents() {
    try {
      const events = JSON.parse(localStorage.getItem('arcadeSyncQueue') || '[]');
      return Array.isArray(events) ? events : [];
    } catch {
      return [];
    }
  }

  function queueEvent(type, payload = {}) {
    const events = pendingSyncEvents();
    events.push({
      id:randomId('event'),
      type:String(type || 'activity'),
      deviceId:deviceId(),
      createdAt:new Date().toISOString(),
      schemaVersion:DATA_SCHEMA_VERSION,
      payload
    });
    localStorage.setItem('arcadeSyncQueue', JSON.stringify(events.slice(-250)));
    const queued = events[events.length - 1];
    window.dispatchEvent(new CustomEvent('earnly-data-change', {
      detail:{ type:queued.type, payload:queued.payload, eventId:queued.id }
    }));
    return queued;
  }

  function syncStatus() {
    const events = pendingSyncEvents();
    return {
      deviceId:deviceId(),
      pending:events.length,
      oldest:events.length ? events[0].createdAt : null,
      backendConnected:false
    };
  }

  function clearSyncEvents(ids = null) {
    if (!ids) {
      localStorage.setItem('arcadeSyncQueue', '[]');
      return 0;
    }
    const remove = new Set(Array.isArray(ids) ? ids : [ids]);
    const remainingEvents = pendingSyncEvents().filter(event => !remove.has(event.id));
    localStorage.setItem('arcadeSyncQueue', JSON.stringify(remainingEvents));
    return remainingEvents.length;
  }

  function isEarnlyDataKey(key) {
    if (!key) return false;
    if (['points','lifetimePoints','gamesCompletedEver','dailyStreak','lastDailyBonusDate','streakRewardClaims'].includes(key)) return true;
    if (key.startsWith('arcade')) return true;
    if (key.startsWith('weekly')) return true;
    if (key.startsWith('gameRuns_') || key.startsWith('gameMetricTotal_')) return true;

    return Object.keys(names).some(game =>
      key === game + 'Best' ||
      key === game + 'BestLines' ||
      key === game + 'BestMoves' ||
      key === game + 'GamesPlayed' ||
      key === game + 'BonusPlays' ||
      key === game + 'PlayAdUnlocks'
    );
  }

  const deviceOnlyKeys = new Set([
    'arcadeDeviceId',
    'arcadeSyncQueue',
    'arcadeInstalled',
    'arcadeOnboardingSeen',
    'arcadeTransferDismissed',
    'arcadeTransferRestored',
    'arcadeLastCloudSave',
    'arcadeLastCloudRestore',
    'arcadeLastCloudHash',
    'arcadeCloudConflict',
    'arcadeCloudSyncError',
    'arcadeFreshDeviceRestoreDone'
  ]);

  function snapshotData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isEarnlyDataKey(key) || deviceOnlyKeys.has(key)) continue;
      data[key] = localStorage.getItem(key);
    }

    return {
      app:'Earnly Arcade',
      schemaVersion:DATA_SCHEMA_VERSION,
      exportedAt:new Date().toISOString(),
      deviceId:deviceId(),
      data
    };
  }

  const TRANSFER_PREFIX = 'EARNLY1.';

  function hasMeaningfulProgress() {
    if (
      number('points') > 0 ||
      number('lifetimePoints') > 0 ||
      number('arcadeXP') > 0 ||
      number('gamesCompletedEver') > 0 ||
      number('dailyStreak') > 0
    ) return true;

    const customName = (localStorage.getItem('arcadeProfileName') || '').trim();
    if (customName && customName !== 'Player') return true;
    if (readArray('arcadeRecentGames').length || readArray('arcadeHistory').length) return true;

    return Object.values(bestConfig).some(config => number(config.key) > 0);
  }

  function encodeTransferPayload(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeTransferPayload(value) {
    let base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function transferCode() {
    return TRANSFER_PREFIX + encodeTransferPayload(JSON.stringify(snapshotData()));
  }

  async function copyTransferCode() {
    const code = transferCode();
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return { copied:false, code, saved:Object.keys(snapshotData().data).length };
    }
    await navigator.clipboard.writeText(code);
    const snapshot = snapshotData();
    logActivity('backup', 'Progress transfer code copied', Object.keys(snapshot.data).length + ' saved data items');
    return { copied:true, code, saved:Object.keys(snapshot.data).length };
  }

  function restoreTransferCode(code) {
    const cleaned = String(code || '').trim();
    if (!cleaned.startsWith(TRANSFER_PREFIX)) {
      throw new Error('That is not a valid Earnly progress code.');
    }

    let snapshot;
    try {
      snapshot = JSON.parse(decodeTransferPayload(cleaned.slice(TRANSFER_PREFIX.length)));
    } catch {
      throw new Error('That Earnly progress code could not be read.');
    }

    const result = restoreSnapshot(snapshot);
    localStorage.setItem('arcadeTransferRestored', '1');
    localStorage.removeItem('arcadeTransferDismissed');
    return result;
  }

  async function restoreTransferFromClipboard() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      throw new Error('Clipboard access is not available here. Paste the code on Account & Data instead.');
    }
    const code = await navigator.clipboard.readText();
    if (!code) throw new Error('No Earnly progress code was found on the clipboard.');
    return restoreTransferCode(code);
  }

  function downloadBackup() {
    const snapshot = snapshotData();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'earnly-backup-' + dateKey() + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    logActivity('backup', 'Progress backup created', Object.keys(snapshot.data).length + ' saved data items');
    return snapshot;
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.app !== 'Earnly Arcade' || !snapshot.data || typeof snapshot.data !== 'object') {
      throw new Error('That file is not a valid Earnly backup.');
    }

    if (Number(snapshot.schemaVersion) > DATA_SCHEMA_VERSION) {
      throw new Error('This backup was created by a newer Earnly version.');
    }

    const keepDeviceId = deviceId();
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isEarnlyDataKey(key) && !deviceOnlyKeys.has(key)) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    let restored = 0;
    Object.entries(snapshot.data).forEach(([key, value]) => {
      if (!isEarnlyDataKey(key) || deviceOnlyKeys.has(key)) return;
      if (typeof value !== 'string') return;
      localStorage.setItem(key, value);
      restored += 1;
    });

    localStorage.setItem('arcadeDeviceId', keepDeviceId);
    queueEvent('backup_restored', {
      sourceExportedAt:snapshot.exportedAt || null,
      restoredKeys:restored
    });
    logActivity('backup', 'Progress backup restored', restored + ' data items restored');

    return { restored, deviceId:keepDeviceId };
  }

  async function restoreBackupFile(file) {
    if (!file || typeof file.text !== 'function') throw new Error('Choose an Earnly backup file first.');
    const text = await file.text();
    let snapshot;
    try {
      snapshot = JSON.parse(text);
    } catch {
      throw new Error('That backup file could not be read.');
    }
    return restoreSnapshot(snapshot);
  }

  function weekKey(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return dateKey(d);
  }

  function nextWeekDate() {
    const d = new Date();
    const day = d.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(0,0,0,0);
    return d;
  }

  function refreshWeekly() {
    const key = weekKey();
    if (localStorage.getItem('arcadeWeekKey') === key) return;

    localStorage.setItem('arcadeWeekKey', key);
    setNumber('weeklyGamesCompleted', 0);
    localStorage.setItem('weeklyDistinctGames', '[]');
    localStorage.setItem('weeklyClaimedMissions', '[]');
    localStorage.setItem('weeklyAllClearClaimed', '0');

    Object.keys(names).forEach(game => {
      setNumber('weeklyMetric_' + game, 0);
    });
  }

  function logActivity(type, title, detail = '') {
    let items = [];
    try {
      items = JSON.parse(localStorage.getItem('arcadeActivity') || '[]');
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    items.unshift({
      type:String(type || 'activity'),
      title:String(title || 'Arcade activity'),
      detail:String(detail || ''),
      time:new Date().toISOString()
    });

    localStorage.setItem('arcadeActivity', JSON.stringify(items.slice(0, 40)));
  }

  function activity() {
    try {
      const items = JSON.parse(localStorage.getItem('arcadeActivity') || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function updateWeekly(game, metric) {
    refreshWeekly();

    setNumber('weeklyGamesCompleted', number('weeklyGamesCompleted') + 1);

    const distinct = readArray('weeklyDistinctGames');
    if (!distinct.includes(game)) {
      distinct.push(game);
      writeArray('weeklyDistinctGames', distinct);
    }

    const amount = Math.max(0, Math.floor(Number(metric) || 0));
    if (amount) {
      setNumber('weeklyMetric_' + game, number('weeklyMetric_' + game) + amount);
    }
  }

  function weeklyProgressFor(mission) {
    refreshWeekly();

    if (mission.type === 'games') return number('weeklyGamesCompleted');
    if (mission.type === 'variety') return readArray('weeklyDistinctGames').length;
    if (mission.type === 'metric') return number('weeklyMetric_' + mission.game);
    return 0;
  }

  function weeklyStatus() {
    refreshWeekly();
    const claimed = new Set(readArray('weeklyClaimedMissions'));
    const missions = weeklyMissionDefinitions.map(mission => {
      const rawProgress = weeklyProgressFor(mission);
      const progress = Math.min(mission.goal, rawProgress);
      return {
        ...mission,
        progress,
        complete:progress >= mission.goal,
        claimed:claimed.has(mission.id)
      };
    });

    const completed = missions.filter(mission => mission.complete).length;
    const claimedCount = missions.filter(mission => mission.claimed).length;

    return {
      weekKey:weekKey(),
      missions,
      completed,
      claimedCount,
      total:missions.length,
      allComplete:completed === missions.length,
      allClaimed:claimedCount === missions.length,
      allClearClaimed:localStorage.getItem('weeklyAllClearClaimed') === '1',
      allClearRewardXP:WEEKLY_ALL_CLEAR_XP,
      nextReset:nextWeekDate().toISOString()
    };
  }

  function claimWeeklyMission(id) {
    const status = weeklyStatus();
    const mission = status.missions.find(item => item.id === id);
    if (!mission || !mission.complete || mission.claimed) return false;

    const claimed = readArray('weeklyClaimedMissions');
    claimed.push(id);
    writeArray('weeklyClaimedMissions', claimed);

    const xpResult = addXP(mission.rewardXP);
    logActivity('weekly', mission.title + ' claimed', '+' + mission.rewardXP + ' XP');

    const after = weeklyStatus();
    let allClearXP = 0;
    let weeklyBadgeUnlocked = false;

    if (after.allClaimed && !after.allClearClaimed) {
      localStorage.setItem('weeklyAllClearClaimed', '1');
      setNumber('weeklyClearsEver', number('weeklyClearsEver') + 1);
      const bonus = addXP(WEEKLY_ALL_CLEAR_XP);
      allClearXP = WEEKLY_ALL_CLEAR_XP;
      weeklyBadgeUnlocked = number('weeklyClearsEver') === 1;
      logActivity('weekly', '🏅 Weekly Sweep completed', '+' + WEEKLY_ALL_CLEAR_XP + ' bonus XP');
      feedback(weeklyBadgeUnlocked ? 'achievement' : 'level');
      toast('🏅 Weekly Sweep! +' + WEEKLY_ALL_CLEAR_XP + ' bonus XP');
      return {
        mission,
        xp:mission.rewardXP,
        leveledUp:xpResult.leveledUp || bonus.leveledUp,
        level:bonus.status.level,
        allClearXP,
        weeklyBadgeUnlocked
      };
    }

    feedback(xpResult.leveledUp ? 'level' : 'success');
    toast(mission.icon + ' Mission claimed · +' + mission.rewardXP + ' XP');

    return {
      mission,
      xp:mission.rewardXP,
      leveledUp:xpResult.leveledUp,
      level:xpResult.status.level,
      allClearXP,
      weeklyBadgeUnlocked
    };
  }

  function profileName() {
    const value = (localStorage.getItem('arcadeProfileName') || 'Player').trim();
    return value || 'Player';
  }

  function setProfileName(value) {
    const cleaned = String(value || '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 18);
    localStorage.setItem('arcadeProfileName', cleaned || 'Player');
    queueEvent('profile_name_changed', { name:profileName() });
    return profileName();
  }

  function ensureXPMigration() {
    if (localStorage.getItem('arcadeXPMigrated') === '1') return;

    if (localStorage.getItem('arcadeXP') === null) {
      const legacyAchievements = achievementDefinitions().filter(item => item.unlocked).length;
      const legacyXP =
        number('gamesCompletedEver') * BASE_GAME_XP +
        legacyAchievements * ACHIEVEMENT_XP;
      setNumber('arcadeXP', legacyXP);
    }

    localStorage.setItem('arcadeXPMigrated', '1');
  }

  function xpStatus() {
    ensureXPMigration();
    const xp = number('arcadeXP');
    let level = 1;
    let spent = 0;
    let needed = 100;

    while (xp >= spent + needed) {
      spent += needed;
      level += 1;
      needed = 100 + (level - 1) * 50;
    }

    const current = xp - spent;
    return {
      xp,
      level,
      current,
      needed,
      progress: needed ? Math.min(100, current / needed * 100) : 100
    };
  }

  function addXP(amount) {
    amount = Math.max(0, Math.floor(Number(amount) || 0));
    const before = xpStatus();
    if (amount) setNumber('arcadeXP', before.xp + amount);
    const after = xpStatus();
    if (amount) {
      queueEvent('xp_award', {
        amount,
        beforeLevel:before.level,
        afterLevel:after.level,
        totalXP:after.xp
      });
    }
    return {
      amount,
      beforeLevel: before.level,
      afterLevel: after.level,
      leveledUp: after.level > before.level,
      status: after
    };
  }

  function favorites() {
    return readArray('arcadeFavorites').filter(game => names[game]);
  }

  function isFavorite(game) {
    return favorites().includes(game);
  }

  function toggleFavorite(game) {
    if (!names[game]) return favorites();
    const list = favorites();
    const index = list.indexOf(game);
    if (index >= 0) list.splice(index, 1);
    else list.unshift(game);
    writeArray('arcadeFavorites', list.slice(0, 8));
    const updated = favorites();
    queueEvent('favorite_changed', { game, favorite:updated.includes(game) });
    return updated;
  }

  function markRecent(game) {
    if (!names[game]) return recentGames();
    const list = readArray('arcadeRecentGames').filter(item => item !== game && names[item]);
    list.unshift(game);
    localStorage.setItem('arcadeRecentGames', JSON.stringify(list.slice(0, 4)));
    return list.slice(0, 4);
  }

  function recentGames() {
    return readArray('arcadeRecentGames').filter(game => names[game]).slice(0, 4);
  }

  function repairGameStats() {
    const repairKey = 'arcadeGameStatsRepairV1';
    if (localStorage.getItem(repairKey) === '1') return { repaired:false, reason:'already-done' };

    const trackedRuns = Object.keys(names).reduce(
      (sum, game) => sum + number('gameRuns_' + game),
      0
    );

    // v0.15.9 and earlier recorded completed games in Activity but did not
    // increment the per-game run counters used by Profile/Stats.
    if (trackedRuns > 0) {
      localStorage.setItem(repairKey, '1');
      return { repaired:false, reason:'already-tracked', trackedRuns };
    }

    const gameItems = activity().filter(item =>
      item &&
      item.type === 'game' &&
      / finished$/i.test(String(item.title || '').trim())
    );

    if (!gameItems.length) {
      localStorage.setItem(repairKey, '1');
      return { repaired:false, reason:'no-history' };
    }

    const nameToGame = Object.fromEntries(
      Object.entries(names).map(([game, name]) => [name, game])
    );
    const rebuilt = {};

    Object.keys(names).forEach(game => {
      rebuilt[game] = { runs:0, metricTotal:0 };
    });

    gameItems.forEach(item => {
      const title = String(item.title || '').replace(/ finished$/i, '').trim();
      const game = nameToGame[title];
      if (!game) return;

      const metricMatch = String(item.detail || '').trim().match(/^(\d+)/);
      const metric = metricMatch ? Math.max(0, Math.floor(Number(metricMatch[1]) || 0)) : 0;

      rebuilt[game].runs += 1;
      rebuilt[game].metricTotal += metric;
    });

    let rebuiltRuns = 0;
    Object.entries(rebuilt).forEach(([game, stats]) => {
      setNumber('gameRuns_' + game, stats.runs);
      setNumber('gameMetricTotal_' + game, stats.metricTotal);
      rebuiltRuns += stats.runs;
    });

    localStorage.setItem(repairKey, '1');
    queueEvent('game_stats_repaired', {
      rebuiltRuns,
      completedGames:number('gamesCompletedEver')
    });

    return { repaired:true, rebuiltRuns, rebuilt };
  }

  function gameStats(game) {
    if (!names[game]) {
      return { game, name:'Game', runs:0, metricTotal:0, average:0, best:{ value:0, display:'No score yet' } };
    }

    const runs = number('gameRuns_' + game);
    const metricTotal = number('gameMetricTotal_' + game);
    const average = runs ? Math.round(metricTotal / runs * 10) / 10 : 0;

    return {
      game,
      name:names[game],
      runs,
      metricTotal,
      average,
      best:best(game)
    };
  }

  function allGameStats() {
    return Object.keys(names).map(gameStats);
  }

  function mostPlayedGame() {
    const sorted = allGameStats()
      .filter(item => item.runs > 0)
      .sort((a,b) => b.runs - a.runs || b.best.value - a.best.value);
    return sorted[0] || null;
  }

  function streakRewardStatus() {
    const streak = number('dailyStreak');
    const claimed = new Set(readArray('streakRewardClaims').map(String));

    const rewards = streakRewardDefinitions.map(item => ({
      ...item,
      reached:streak >= item.days,
      claimed:claimed.has(String(item.days))
    }));

    return {
      streak,
      rewards,
      ready:rewards.filter(item => item.reached && !item.claimed).length,
      claimed:rewards.filter(item => item.claimed).length,
      total:rewards.length
    };
  }

  function claimStreakReward(days) {
    const status = streakRewardStatus();
    const reward = status.rewards.find(item => item.days === Number(days));
    if (!reward || !reward.reached || reward.claimed) return false;

    const claims = readArray('streakRewardClaims').map(String);
    claims.push(String(reward.days));
    writeArray('streakRewardClaims', claims);

    const xpResult = addXP(reward.rewardXP);
    logActivity('streak', reward.title + ' reward claimed', '+' + reward.rewardXP + ' XP');
    feedback(xpResult.leveledUp ? 'level' : 'success');
    toast(reward.icon + ' ' + reward.title + ' · +' + reward.rewardXP + ' XP');

    return {
      reward,
      xp:reward.rewardXP,
      leveledUp:xpResult.leveledUp,
      level:xpResult.status.level
    };
  }

  function repairLifetimeCounters() {
    // A lifetime-earned counter can never be lower than the current balance.
    // Older prototype saves could drift out of sync while the reward system was evolving.
    const currentCoins = number('points');
    const lifetimeCoins = number('lifetimePoints');
    if (lifetimeCoins < currentCoins) {
      setNumber('lifetimePoints', currentCoins);
      queueEvent('lifetime_coin_counter_repaired', {
        previous:lifetimeCoins,
        repaired:currentCoins
      });
    }

    // Compatibility repair for saves/transfers created before gamesCompletedEver
    // was included in the transferable data set.
    if (number('gamesCompletedEver') > 0) return number('gamesCompletedEver');

    let activityCount = 0;
    try {
      const items = JSON.parse(localStorage.getItem('arcadeActivity') || '[]');
      if (Array.isArray(items)) {
        activityCount = items.filter(item =>
          item && (
            item.type === 'game' ||
            / finished$/i.test(String(item.title || '').trim())
          )
        ).length;
      }
    } catch {}

    const weeklyCount = number('weeklyGamesCompleted');
    const recovered = Math.max(activityCount, weeklyCount);
    if (recovered > 0) {
      setNumber('gamesCompletedEver', recovered);
      queueEvent('lifetime_counter_repaired', { gamesCompletedEver:recovered });
    }
    return recovered;
  }

  function stats() {
    const achievement = achievementSummary();
    const xp = xpStatus();
    return {
      name: profileName(),
      level: xp.level,
      xp: xp.xp,
      gamesCompleted: number('gamesCompletedEver'),
      differentGames: readArray('arcadeGamesEver').length,
      lifetimeCoins: number('lifetimePoints'),
      currentCoins: number('points'),
      achievements: achievement.unlocked,
      totalAchievements: achievement.total,
      streak: number('dailyStreak'),
      favorites: favorites().length,
      favoriteGame: favorites()[0] || '',
      weeklyMissionsCompleted: weeklyStatus().completed,
      weeklyMissionsTotal: weeklyStatus().total,
      weeklyClears: number('weeklyClearsEver'),
      mostPlayedGame: mostPlayedGame()
    };
  }

  function dailyChallengeDefinition() {
    const seed = dateKey().split('-').join('').split('').reduce((sum, digit) => sum + Number(digit), 0);
    const challengeDay = localStorage.getItem('arcadeChallengeDay');
    const version = localStorage.getItem('arcadeChallengeVersion');

    // Keep today's challenge stable when the catalog expands.
    let poolSize = challengeDefinitions.length;
    if (challengeDay === dateKey() && version === '3') poolSize = Math.min(9, challengeDefinitions.length);
    else if (challengeDay === dateKey() && version === '4') poolSize = Math.min(14, challengeDefinitions.length);

    return challengeDefinitions[seed % poolSize];
  }

  function refreshDaily() {
    const today = dateKey();

    if (localStorage.getItem('arcadePlayDay') !== today) {
      Object.keys(names).forEach(g => {
        setNumber(g + 'GamesPlayed', 0);
        setNumber(g + 'BonusPlays', 0);
        setNumber(g + 'PlayAdUnlocks', 0);
      });
      localStorage.setItem('arcadePlayDay', today);
    }

    const challengeDay = localStorage.getItem('arcadeChallengeDay');
    const challengeNeedsReset = challengeDay !== today;

    if (challengeNeedsReset) {
      localStorage.setItem('arcadeChallengeDay', today);
      localStorage.setItem('arcadeChallengeVersion', CHALLENGE_VERSION);
      setNumber('arcadeChallengeProgress', 0);
      localStorage.setItem('arcadeChallengeClaimed', '0');
      localStorage.setItem('arcadeChallengeGames', '[]');
    } else if (!localStorage.getItem('arcadeChallengeVersion')) {
      // Older installs without a version marker use the legacy pool for today.
      localStorage.setItem('arcadeChallengeVersion', '3');
    }

  }

  function remaining(g) {
    refreshDaily();
    return Math.max(0, FREE_PLAYS + number(g + 'BonusPlays') - number(g + 'GamesPlayed'));
  }

  function resetPrototypePlays() {
    refreshDaily();
    Object.keys(names).forEach(g => {
      setNumber(g + 'GamesPlayed', 0);
      setNumber(g + 'BonusPlays', 0);
      setNumber(g + 'PlayAdUnlocks', 0);
    });
    localStorage.setItem('arcadePlayDay', dateKey());
    queueEvent('prototype_plays_reset', { games:Object.keys(names), freePlays:FREE_PLAYS });
    toast('🧪 Test plays reset · 3 free plays per game');
    window.dispatchEvent(new CustomEvent('earnly-prototype-plays-reset'));
    return Object.fromEntries(Object.keys(names).map(g => [g, remaining(g)]));
  }

  function playAdStatus(g) {
    refreshDaily();

    let used = number(g + 'PlayAdUnlocks');
    const legacyBonusPacks = Math.floor(number(g + 'BonusPlays') / PLAY_AD_BONUS);

    // Count bonus packs already earned today before this daily cap existed.
    if (legacyBonusPacks > used) {
      used = Math.min(PLAY_AD_DAILY_LIMIT, legacyBonusPacks);
      setNumber(g + 'PlayAdUnlocks', used);
    }

    return {
      used,
      limit: PLAY_AD_DAILY_LIMIT,
      remaining: Math.max(0, PLAY_AD_DAILY_LIMIT - used),
      bonus: PLAY_AD_BONUS,
      maxDailyPlays: FREE_PLAYS + PLAY_AD_BONUS * PLAY_AD_DAILY_LIMIT
    };
  }

  function consume(g) {
    if (!remaining(g)) return false;
    setNumber(g + 'GamesPlayed', number(g + 'GamesPlayed') + 1);
    markRecent(g);
    queueEvent('play_started', {
      game:g,
      playsUsed:number(g + 'GamesPlayed'),
      bonusPlays:number(g + 'BonusPlays')
    });
    return true;
  }

  function best(game) {
    const config = bestConfig[game];
    if (!config) return { value:0, label:'', display:'No score yet' };
    const value = number(config.key);
    return {
      value,
      label: config.label,
      display: value ? value + ' ' + config.label : 'No score yet'
    };
  }

  function setBest(game, value) {
    const config = bestConfig[game];
    value = Math.max(0, Math.floor(Number(value) || 0));
    if (!config || !value) return best(game);

    const current = number(config.key);
    const isBetter = !current || (config.lower ? value < current : value > current);
    if (isBetter) setNumber(config.key, value);
    return best(game);
  }

  function achievementDefinitions() {
    const memoryBest = number('memoryBestMoves');
    const lifetimeGames = readArray('arcadeGamesEver').length;

    return [
      { id:'first', icon:'🎮', title:'First Run', description:'Finish your first Earnly game', unlocked:number('gamesCompletedEver') >= 1 },
      { id:'explorer', icon:'🗺️', title:'Arcade Explorer', description:'Finish 4 different games', unlocked:lifetimeGames >= 4 },
      { id:'collector', icon:'🪙', title:'Coin Collector', description:'Earn 100 lifetime Arcade Coins', unlocked:number('lifetimePoints') >= 100 },
      { id:'streak3', icon:'🔥', title:'Heating Up', description:'Reach a 3-day streak', unlocked:number('dailyStreak') >= 3 },
      { id:'streak7', icon:'📅', title:'Week Warrior', description:'Reach a 7-day streak', unlocked:number('dailyStreak') >= 7 },
      { id:'streak14', icon:'⚡', title:'Locked In', description:'Reach a 14-day streak', unlocked:number('dailyStreak') >= 14 },
      { id:'weeklySweep', icon:'🏅', title:'Weekly Sweep', description:'Claim every weekly mission in one week', unlocked:number('weeklyClearsEver') >= 1 },
      { id:'snake10', icon:'🐍', title:'Growing Fast', description:'Eat 10 apples in Snake', unlocked:number('snakeBest') >= 10 },
      { id:'snake25', icon:'🔥', title:'Snake Master', description:'Eat 25 apples in Snake', unlocked:number('snakeBest') >= 25 },
      { id:'block3', icon:'🧱', title:'Line Clearer', description:'Clear 3 lines in Block Drop', unlocked:number('blockDropBestLines') >= 3 },
      { id:'tap20', icon:'🎯', title:'Quick Fingers', description:'Hit 20 targets in Tap Rush', unlocked:number('tapRushBest') >= 20 },
      { id:'memory24', icon:'🧠', title:'Sharp Memory', description:'Clear Memory Match in 24 moves or fewer', unlocked:memoryBest > 0 && memoryBest <= 24 },
      { id:'dodger15', icon:'🚗', title:'Road Warrior', description:'Survive 15 seconds in Neon Dodger', unlocked:number('dodgerBest') >= 15 },
      { id:'brick20', icon:'💥', title:'Brick Smasher', description:'Break 20 bricks in Brick Breaker', unlocked:number('brickBreakerBest') >= 20 },
      { id:'jungle10', icon:'🐸', title:'Jungle Pro', description:'Pass 10 vines in Jungle Hopper', unlocked:number('jungleHopperBest') >= 10 },
      { id:'jungle25', icon:'🌿', title:'Deep Jungle', description:'Pass 25 vines in Jungle Hopper', unlocked:number('jungleHopperBest') >= 25 },
      { id:'jungle50', icon:'👑', title:'Vine Master', description:'Pass 50 vines in Jungle Hopper', unlocked:number('jungleHopperBest') >= 50 },
      { id:'jungle100', icon:'🏆', title:'Jungle Legend', description:'Pass 100 vines in Jungle Hopper', unlocked:number('jungleHopperBest') >= 100 },
      { id:'tower10', icon:'🏗️', title:'High Rise', description:'Stack 10 floors in Tower Stack', unlocked:number('towerStackBest') >= 10 },
      { id:'tower20', icon:'🏙️', title:'Skyline Builder', description:'Stack 20 floors in Tower Stack', unlocked:number('towerStackBest') >= 20 },
      { id:'coinCatch20', icon:'🪙', title:'Coin Magnet', description:'Catch 20 coins in Coin Catch', unlocked:number('coinCatchBest') >= 20 },
      { id:'colorMatch20', icon:'🎨', title:'Color Brain', description:'Get 20 matches in Color Match', unlocked:number('colorMatchBest') >= 20 },
      { id:'paddleRally15', icon:'🏓', title:'Rally Pro', description:'Return the ball 15 times in Paddle Rally', unlocked:number('paddleRallyBest') >= 15 },
      { id:'laneRunner25', icon:'🏎️', title:'Road Runner', description:'Survive 25 seconds in Lane Runner', unlocked:number('laneRunnerBest') >= 25 },
      { id:'safeCracker10', icon:'🔐', title:'Safe Cracker', description:'Crack 10 locks in Safe Cracker', unlocked:number('safeCrackerBest') >= 10 },
      { id:'blockGrid300', icon:'🧩', title:'Grid Master', description:'Score 300 points in Block Grid', unlocked:number('blockGridBest') >= 300 },
      { id:'mergeRush1024', icon:'🔢', title:'Merge Master', description:'Score 1,024 points in Merge Rush', unlocked:number('mergeRushBest') >= 1024 },
      { id:'perfectDrop12', icon:'🎯', title:'Dead Center', description:'Land 12 hits in Perfect Drop', unlocked:number('perfectDropBest') >= 12 },
      { id:'spiralDrop15', icon:'🌀', title:'Spiral Pro', description:'Pass 15 rings in Spiral Drop', unlocked:number('spiralDropBest') >= 15 },
      { id:'shapeFit12', icon:'🧠', title:'Shape Genius', description:'Get 12 correct in Shape Fit', unlocked:number('shapeFitBest') >= 12 },
      { id:'bounceRun150', icon:'⚪', title:'Bounce Runner', description:'Reach 150 distance in Bounce Run', unlocked:number('bounceRunBest') >= 150 },
      { id:'trafficEscape15', icon:'🚦', title:'Traffic Boss', description:'Clear 15 cars in Traffic Escape', unlocked:number('trafficEscapeBest') >= 15 }
    ];
  }

  function achievements() {
    return achievementDefinitions();
  }

  function achievementSummary() {
    const all = achievements();
    const unlocked = all.filter(item => item.unlocked);
    return { unlocked:unlocked.length, total:all.length, all };
  }

  function updateChallenge(game, metric) {
    refreshDaily();
    const challenge = dailyChallengeDefinition();
    const games = readArray('arcadeChallengeGames');

    if (!games.includes(game)) {
      games.push(game);
      writeArray('arcadeChallengeGames', games);
    }

    if (challenge.type === 'variety') {
      setNumber('arcadeChallengeProgress', Math.min(challenge.goal, games.length));
      return;
    }

    if (challenge.game !== game) return;

    if (challenge.type === 'complete') {
      setNumber('arcadeChallengeProgress', 1);
      return;
    }

    setNumber('arcadeChallengeProgress', Math.max(number('arcadeChallengeProgress'), Math.floor(Number(metric) || 0)));
  }

  function recordResult(game, metric) {
    refreshDaily();

    const previousBest = best(game).value;
    const before = new Set(achievementDefinitions().filter(item => item.unlocked).map(item => item.id));
    const currentBest = setBest(game, metric);
    const config = bestConfig[game];
    const cleanMetric = Math.max(0, Math.floor(Number(metric) || 0));
    const newBest = !!config && cleanMetric > 0 && (
      !previousBest ||
      (config.lower ? cleanMetric < previousBest : cleanMetric > previousBest)
    );

    setNumber('gamesCompletedEver', number('gamesCompletedEver') + 1);
    setNumber('gameRuns_' + game, number('gameRuns_' + game) + 1);
    setNumber('gameMetricTotal_' + game, number('gameMetricTotal_' + game) + cleanMetric);

    const gamesEver = readArray('arcadeGamesEver');
    if (!gamesEver.includes(game)) {
      gamesEver.push(game);
      writeArray('arcadeGamesEver', gamesEver);
    }

    updateChallenge(game, metric);
    updateWeekly(game, cleanMetric);

    const runLabel = config ? cleanMetric + ' ' + config.label : String(cleanMetric);
    logActivity(
      'game',
      (names[game] || 'Game') + ' finished',
      runLabel + (newBest ? ' · New best' : '')
    );

    const after = achievementDefinitions().filter(item => item.unlocked);
    const newlyUnlocked = after.filter(item => !before.has(item.id));

    let performanceXP = 0;
    if (game === 'jungleHopper') {
      if (cleanMetric >= 100) performanceXP = 30;
      else if (cleanMetric >= 50) performanceXP = 20;
      else if (cleanMetric >= 25) performanceXP = 10;
    }

    const xpAward = BASE_GAME_XP + performanceXP + newlyUnlocked.length * ACHIEVEMENT_XP;
    const xpResult = addXP(xpAward);

    queueEvent('game_result', {
      game,
      metric:cleanMetric,
      best:currentBest.value,
      newBest,
      xpAward,
      performanceXP,
      level:xpResult.status.level,
      achievements:newlyUnlocked.map(item => item.id)
    });

    if (newlyUnlocked.length) {
      feedback('achievement');
      toast('🏆 Achievement unlocked: ' + newlyUnlocked[0].title);
    } else if (xpResult.leveledUp) {
      feedback('level');
      toast('⬆️ Level up! You reached Level ' + xpResult.afterLevel);
    } else if (newBest) {
      feedback('newBest');
      toast('🏆 New best! ' + currentBest.display);
    }

    return {
      best:currentBest,
      newBest,
      previousBest,
      newAchievements:newlyUnlocked,
      xpAward,
      performanceXP,
      level:xpResult.status.level,
      leveledUp:xpResult.leveledUp
    };
  }

  function logTransaction(amount, source) {
    let items = [];
    try {
      items = JSON.parse(localStorage.getItem('arcadeHistory') || '[]');
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }
    items.unshift({
      amount: Math.floor(amount),
      source: source || 'Arcade reward',
      time: new Date().toISOString()
    });
    localStorage.setItem('arcadeHistory', JSON.stringify(items.slice(0, 20)));
  }

  function history() {
    try {
      const items = JSON.parse(localStorage.getItem('arcadeHistory') || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function refreshCoinEarnDay() {
    const today = dateKey();
    if (localStorage.getItem('arcadeCoinEarnDay') === today) return;

    const migrated = history().reduce((sum, item) => {
      if (!item || !item.time) return sum;
      const when = new Date(item.time);
      return !Number.isNaN(when.getTime()) && dateKey(when) === today
        ? sum + Math.max(0, Math.floor(Number(item.amount) || 0))
        : sum;
    }, 0);

    localStorage.setItem('arcadeCoinEarnDay', today);
    setNumber('arcadeCoinsEarnedToday', migrated);
  }

  function dailyCoinStatus() {
    refreshCoinEarnDay();
    return {
      earned: number('arcadeCoinsEarnedToday'),
      balance: number('points'),
      lifetime: number('lifetimePoints')
    };
  }

  function earn(n, source = 'Arcade reward', server = null) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!n && !server) return number('points');

    refreshCoinEarnDay();
    if (n) {
      setNumber('points', number('points') + n);
      setNumber('lifetimePoints', number('lifetimePoints') + n);
      setNumber('arcadeCoinsEarnedToday', number('arcadeCoinsEarnedToday') + n);
      logTransaction(n, source);
    }
    queueEvent('coin_award', {
      amount:n,
      source,
      balance:number('points'),
      lifetime:number('lifetimePoints'),
      earnedToday:number('arcadeCoinsEarnedToday'),
      server:server && typeof server === 'object' ? server : null
    });
    return number('points');
  }

  function claimDailyBonus() {
    const today = dateKey();
    const last = localStorage.getItem('lastDailyBonusDate');
    if (last === today) return { claimed:false, streak:number('dailyStreak') };

    const streak = last === yesterdayKey() ? number('dailyStreak') + 1 : 1;
    setNumber('dailyStreak', streak);
    localStorage.setItem('lastDailyBonusDate', today);
    earn(DAILY_BONUS, 'Daily bonus', { kind:'daily_bonus' });
    logActivity('reward', 'Daily bonus claimed', '+' + DAILY_BONUS + ' Arcade Coins · ' + streak + ' day streak');
    const ready = streakRewardStatus().rewards.find(item => item.days === streak && !item.claimed);
    if (ready) toast(ready.icon + ' ' + ready.title + ' reward ready!');
    return { claimed:true, streak, streakRewardReady:ready || null };
  }

  function dailyBonusStatus() {
    const claimedToday = localStorage.getItem('lastDailyBonusDate') === dateKey();
    let streak = number('dailyStreak');

    // Repair legacy prototype data from versions where a claimed bonus
    // could exist without a matching streak value.
    if (claimedToday && streak < 1) {
      streak = 1;
      setNumber('dailyStreak', streak);
    }

    return {
      claimed: claimedToday,
      streak,
      reward: DAILY_BONUS
    };
  }

  function challengeStatus() {
    refreshDaily();
    const challenge = dailyChallengeDefinition();
    const progress = Math.min(challenge.goal, number('arcadeChallengeProgress'));
    return {
      ...challenge,
      progress,
      claimed: localStorage.getItem('arcadeChallengeClaimed') === '1',
      complete: progress >= challenge.goal
    };
  }

  function claimChallenge() {
    const s = challengeStatus();
    if (!s.complete || s.claimed) return false;
    localStorage.setItem('arcadeChallengeClaimed', '1');
    earn(s.reward, 'Daily challenge', { kind:'daily_challenge', challengeId:s.id });
    logActivity('challenge', 'Daily challenge claimed', '+' + s.reward + ' Arcade Coins');
    return s;
  }

  const modal = document.createElement('dialog');
  modal.setAttribute('aria-modal', 'true');
  document.body.append(modal);

  let busy = false;

  function closeModalThen(fn) {
    const next = typeof fn === 'function' ? fn : () => {};

    if (!modal.open) {
      next();
      return;
    }

    modal.addEventListener('close', () => {
      requestAnimationFrame(() => next());
    }, { once:true });

    modal.close();
  }

  function panel(title, message, actions) {
    if (modal.open) {
      closeModalThen(() => panel(title, message, actions));
      return;
    }

    modal.className = '';
    modal.replaceChildren();

    const h = document.createElement('h2');
    h.textContent = title;

    const p = document.createElement('p');
    p.className = 'modal-message';
    p.textContent = message;

    const actionBox = document.createElement('div');
    actionBox.className = 'modal-actions';

    (actions || [['Close', () => {}]]).forEach(([label, fn, className]) => {
      const b = document.createElement('button');
      b.className = 'wide' + (className ? ' ' + className : '');
      b.textContent = label;
      b.addEventListener('click', () => closeModalThen(fn));
      actionBox.append(b);
    });

    modal.append(h, p, actionBox);
    modal.showModal();
  }

  function milestone(message, kind = 'score') {
    let pop = document.getElementById('arcadeMilestone');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'arcadeMilestone';
      pop.className = 'milestone-pop';
      pop.setAttribute('role', 'status');
      document.body.append(pop);
    }

    pop.textContent = message;
    pop.className = 'milestone-pop show ' + (kind || 'score');
    clearTimeout(milestone.timer);
    feedback(kind === 'perfect' ? 'perfect' : 'score');

    milestone.timer = setTimeout(() => {
      pop.classList.remove('show');
    }, 1200);
  }

  function gameResult(options = {}) {
    const {
      icon = '🎮',
      title = 'Run Complete',
      scoreLabel = 'Score',
      score = 0,
      best = '',
      extra = [],
      coins = 0,
      result = null,
      playsLeft = 0,
      game = '',
      onReplay = null,
      onMorePlays = null
    } = options;

    if (modal.open) modal.close();
    modal.replaceChildren();
    modal.className = 'game-result-dialog';

    const hero = document.createElement('div');
    hero.className = 'result-hero';

    const iconEl = document.createElement('div');
    iconEl.className = 'result-icon';
    iconEl.textContent = icon;

    const heading = document.createElement('div');
    heading.className = 'result-heading';

    const h = document.createElement('h2');
    h.textContent = title;

    const badge = document.createElement('div');
    badge.className = 'result-badge';
    badge.textContent = result?.newBest ? '🏆 NEW BEST' : (score > 0 ? '✓ RUN COMPLETE' : 'RUN OVER');
    if (result?.newBest) badge.classList.add('best');

    heading.append(h, badge);
    hero.append(iconEl, heading);

    const main = document.createElement('div');
    main.className = 'result-main';

    const label = document.createElement('span');
    label.textContent = scoreLabel;

    const value = document.createElement('strong');
    value.textContent = String(score);

    main.append(label, value);

    if (best) {
      const bestLine = document.createElement('div');
      bestLine.className = 'result-best';
      bestLine.textContent = (result?.newBest ? 'Previous best beaten · New best: ' : '🏆 Best: ') + best;
      main.append(bestLine);
    }

    const statsBox = document.createElement('div');
    statsBox.className = 'result-stats';

    const statData = [
      ['🪙', '+' + coins, 'Coins Earned'],
      ['⭐', '+' + (result?.xpAward || 0), 'XP Earned'],
      ['🎟️', String(playsLeft), playsLeft === 1 ? 'Play Left' : 'Plays Left']
    ];

    statData.forEach(([statIcon, statValue, statLabel]) => {
      const stat = document.createElement('div');
      stat.className = 'result-stat';
      stat.innerHTML = '<span>' + statIcon + '</span><strong>' + statValue + '</strong><small>' + statLabel + '</small>';
      statsBox.append(stat);
    });

    const notes = document.createElement('div');
    notes.className = 'result-notes';

    (Array.isArray(extra) ? extra : [extra]).filter(Boolean).forEach(text => {
      const line = document.createElement('div');
      line.textContent = text;
      notes.append(line);
    });

    if (result?.leveledUp) {
      const line = document.createElement('div');
      line.className = 'result-highlight';
      line.textContent = '⬆️ Level ' + result.level + ' reached!';
      notes.append(line);
    }

    if (result?.newAchievements?.length) {
      result.newAchievements.forEach(item => {
        const line = document.createElement('div');
        line.className = 'result-highlight';
        line.textContent = '🏅 ' + item.title + ' unlocked';
        notes.append(line);
      });
    }

    const goalParams = new URLSearchParams(location.search);
    let goalSource = goalParams.get('goal');
    let activeGoal = null;

    try {
      activeGoal = JSON.parse(sessionStorage.getItem('earnlyActiveGoal') || 'null');
    } catch {}

    if (
      !goalSource &&
      activeGoal?.game === game &&
      Date.now() - Number(activeGoal.startedAt || 0) < 60 * 60 * 1000
    ) {
      goalSource = activeGoal.source;
    }
    let goalReturn = null;

    if (goalSource === 'daily') {
      const challenge = challengeStatus();
      goalReturn = {
        href:'index.html',
        label:challenge.complete && !challenge.claimed ? '🔥 Claim Daily Challenge →' : '← Daily Challenge',
        note:challenge.complete
          ? (challenge.claimed
              ? '🔥 Daily challenge complete and claimed.'
              : '🔥 Daily challenge complete — return Home to claim +' + challenge.reward + ' Coins.')
          : '🔥 Daily challenge progress: ' + challenge.progress + '/' + challenge.goal
      };
    } else if (goalSource === 'weekly') {
      const missionId = goalParams.get('mission') || activeGoal?.mission || '';
      const mission = weeklyStatus().missions.find(item => item.id === missionId);
      if (mission) {
        goalReturn = {
          href:'stats.html',
          label:mission.complete && !mission.claimed ? '📅 Claim Weekly Mission →' : '← Weekly Mission',
          note:mission.complete
            ? (mission.claimed
                ? '📅 Weekly mission complete and claimed.'
                : '📅 Weekly mission complete — return to Missions to claim +' + mission.rewardXP + ' XP.')
            : '📅 Weekly mission progress: ' + mission.progress + '/' + mission.goal
        };
      }
    }

    if (goalReturn) {
      const line = document.createElement('div');
      line.className = 'result-highlight result-goal-update';
      line.textContent = goalReturn.note;
      notes.append(line);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions result-actions';

    const primary = document.createElement('button');
    primary.className = 'wide green';
    const resultAdStatus = game ? playAdStatus(game) : { remaining:0, bonus:PLAY_AD_BONUS };
    if (playsLeft > 0) {
      primary.textContent = '▶ Play Again · ' + playsLeft + ' Left';
    } else if (resultAdStatus.remaining > 0) {
      primary.textContent = '▶ Watch Ad · +' + resultAdStatus.bonus + ' Plays';
    } else {
      primary.textContent = '🎟️ Plays Refill Tomorrow';
      primary.disabled = true;
    }

    primary.addEventListener('click', () => {
      if (primary.disabled) return;
      closeModalThen(() => {
        modal.className = '';
        if (playsLeft > 0) {
          if (typeof onReplay === 'function') onReplay();
        } else if (typeof onMorePlays === 'function') {
          onMorePlays();
        } else if (game) {
          out(game, () => {});
        }
      });
    });

    const back = document.createElement('button');
    back.className = 'wide secondary' + (goalReturn ? ' goal-return-button' : '');
    back.textContent = goalReturn ? goalReturn.label : '← Games';
    back.addEventListener('click', () => {
      closeModalThen(() => {
        modal.className = '';
        if (goalReturn) sessionStorage.removeItem('earnlyActiveGoal');
        location.href = goalReturn ? goalReturn.href : 'games.html';
      });
    });

    actions.append(primary, back);
    modal.append(hero, main, statsBox);
    if (notes.childElementCount) modal.append(notes);
    modal.append(actions);
    modal.showModal();
  }

  function toast(message) {
    let t = document.getElementById('arcadeToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'arcadeToast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.append(t);
    }
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  let audioContext = null;

  function soundEnabled() {
    return localStorage.getItem('arcadeSound') !== 'off';
  }

  function hapticsEnabled() {
    return localStorage.getItem('arcadeHaptics') !== 'off';
  }

  function setHapticsEnabled(enabled) {
    localStorage.setItem('arcadeHaptics', enabled ? 'on' : 'off');
    if (enabled) vibrate(18);
    queueEvent('setting_changed', { setting:'haptics', enabled:hapticsEnabled() });
    return hapticsEnabled();
  }

  function reducedMotionEnabled() {
    const setting = localStorage.getItem('arcadeReducedMotion');
    if (setting === 'on') return true;
    if (setting === 'off') return false;
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function setReducedMotionEnabled(enabled) {
    localStorage.setItem('arcadeReducedMotion', enabled ? 'on' : 'off');
    applyMotionPreference();
    queueEvent('setting_changed', { setting:'reducedMotion', enabled:reducedMotionEnabled() });
    return reducedMotionEnabled();
  }

  function applyMotionPreference() {
    document.documentElement.classList.toggle('reduce-motion', reducedMotionEnabled());
  }

  function setSoundEnabled(enabled) {
    localStorage.setItem('arcadeSound', enabled ? 'on' : 'off');
    if (enabled) feedback('go');
    queueEvent('setting_changed', { setting:'sound', enabled:soundEnabled() });
    return soundEnabled();
  }

  function audio() {
    if (!soundEnabled()) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();
      return audioContext;
    } catch {
      return null;
    }
  }

  function tone(frequency, duration = 0.06, volume = 0.035, type = 'sine', delay = 0, endFrequency = null, detune = 0) {
    if (!soundEnabled()) return;
    const ctx = audio();
    if (!ctx) return;

    const start = ctx.currentTime + Math.max(0, delay);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
    if (Number.isFinite(endFrequency) && endFrequency > 0) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    }
    oscillator.detune.setValueAtTime(detune, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.012, duration * 0.22));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function noise(duration = 0.04, volume = 0.018, delay = 0, cutoff = 900) {
    if (!soundEnabled()) return;
    const ctx = audio();
    if (!ctx) return;

    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const envelope = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;

    const gain = ctx.createGain();
    const start = ctx.currentTime + Math.max(0, delay);
    gain.gain.setValueAtTime(Math.max(0.0002, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function chord(frequencies, duration = 0.12, volume = 0.02, type = 'sine', delay = 0) {
    frequencies.forEach((frequency, index) => {
      tone(frequency, duration, volume, type, delay, null, (index - (frequencies.length - 1) / 2) * 2);
    });
  }

  function vibrate(pattern) {
    if (!hapticsEnabled()) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {}
  }

  function feedback(kind = 'tap') {
    if (kind === 'tap' || kind === 'flip') {
      tone(780, 0.035, 0.014, 'triangle', 0, 620);
      noise(0.018, 0.006, 0, 1800);
      vibrate(6);
    } else if (kind === 'move') {
      tone(330, 0.025, 0.01, 'triangle', 0, 300);
    } else if (kind === 'hit') {
      tone(760, 0.045, 0.02, 'square', 0, 560);
      noise(0.022, 0.008, 0, 2200);
      vibrate(7);
    } else if (kind === 'hop') {
      tone(390, 0.075, 0.025, 'triangle', 0, 760);
      tone(780, 0.035, 0.012, 'sine', 0.045, 900);
      vibrate(8);
    } else if (kind === 'score') {
      tone(880, 0.07, 0.026, 'sine');
      tone(1320, 0.09, 0.024, 'sine', 0.045);
      tone(1760, 0.055, 0.012, 'sine', 0.09);
      vibrate(10);
    } else if (kind === 'line') {
      tone(240, 0.09, 0.018, 'triangle', 0, 420);
      chord([523, 659, 784], 0.11, 0.016, 'sine', 0.045);
      noise(0.045, 0.01, 0, 1200);
      vibrate([8, 18, 8]);
    } else if (kind === 'match') {
      tone(660, 0.06, 0.022, 'sine');
      tone(990, 0.09, 0.024, 'sine', 0.045);
      tone(1320, 0.05, 0.012, 'sine', 0.11);
      vibrate(10);
    } else if (kind === 'brick') {
      tone(310, 0.045, 0.018, 'square', 0, 190);
      noise(0.028, 0.012, 0, 1100);
      vibrate(7);
    } else if (kind === 'stack') {
      tone(170, 0.065, 0.024, 'triangle', 0, 105);
      noise(0.038, 0.009, 0, 700);
      vibrate(9);
    } else if (kind === 'success') {
      chord([523, 659, 784], 0.14, 0.02, 'sine');
      tone(1047, 0.13, 0.026, 'sine', 0.11);
      vibrate([10, 22, 10]);
    } else if (kind === 'perfect') {
      tone(659, 0.055, 0.022, 'sine');
      tone(831, 0.07, 0.023, 'sine', 0.04);
      tone(988, 0.09, 0.024, 'sine', 0.08);
      tone(1319, 0.12, 0.02, 'sine', 0.14);
      noise(0.025, 0.006, 0.14, 2600);
      vibrate([10, 24, 10]);
    } else if (kind === 'fail') {
      tone(290, 0.18, 0.026, 'sawtooth', 0, 105);
      tone(190, 0.16, 0.015, 'triangle', 0.07, 80);
      noise(0.05, 0.008, 0.02, 500);
      vibrate(32);
    } else if (kind === 'countdown') {
      tone(430, 0.07, 0.022, 'triangle', 0, 390);
      noise(0.018, 0.005, 0, 1700);
    } else if (kind === 'go') {
      tone(520, 0.12, 0.024, 'triangle', 0, 1040);
      chord([659, 831, 988], 0.13, 0.018, 'sine', 0.07);
      vibrate(11);
    } else if (kind === 'newBest') {
      tone(659, 0.08, 0.024, 'sine');
      tone(831, 0.08, 0.024, 'sine', 0.07);
      tone(988, 0.1, 0.025, 'sine', 0.14);
      chord([1047, 1319, 1568], 0.16, 0.018, 'sine', 0.22);
      noise(0.03, 0.006, 0.23, 2500);
      vibrate([12, 28, 12]);
    } else if (kind === 'achievement') {
      tone(523, 0.07, 0.022, 'sine');
      tone(659, 0.07, 0.022, 'sine', 0.065);
      tone(784, 0.08, 0.023, 'sine', 0.13);
      tone(1047, 0.14, 0.028, 'sine', 0.2);
      vibrate([10, 24, 10, 24, 16]);
    } else if (kind === 'level') {
      tone(440, 0.065, 0.022, 'triangle');
      tone(554, 0.065, 0.022, 'triangle', 0.055);
      tone(659, 0.075, 0.023, 'triangle', 0.11);
      tone(880, 0.09, 0.025, 'sine', 0.175);
      tone(1109, 0.16, 0.025, 'sine', 0.25);
      vibrate([12, 24, 12, 24, 18]);
    }
  }

  function countdown(done, options = {}) {
    const seconds = Math.max(1, Math.min(5, Math.floor(Number(options.seconds) || 3)));
    let overlay = document.getElementById('arcadeCountdown');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'arcadeCountdown';
      overlay.className = 'countdown-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'assertive');

      const value = document.createElement('div');
      value.className = 'countdown-value';
      overlay.append(value);
      document.body.append(overlay);
    }

    const value = overlay.querySelector('.countdown-value');
    let remaining = seconds;
    overlay.classList.add('show');

    const tick = () => {
      if (remaining > 0) {
        value.textContent = String(remaining);
        value.classList.remove('pop');
        void value.offsetWidth;
        value.classList.add('pop');
        feedback('countdown');
        remaining -= 1;
        setTimeout(tick, 620);
      } else {
        value.textContent = 'GO!';
        value.classList.remove('pop');
        void value.offsetWidth;
        value.classList.add('pop');
        feedback('go');
        setTimeout(() => {
          overlay.classList.remove('show');
          if (typeof done === 'function') done();
        }, 430);
      }
    };

    tick();
  }

  function resultText(result) {
    if (!result) return '';
    let text = '\n+' + result.xpAward + ' XP';
    if (result.newBest) text += '\n🏆 NEW BEST!';
    if (result.leveledUp) text += '\n⬆️ LEVEL ' + result.level + '!';
    if (result.newAchievements && result.newAchievements.length) {
      text += '\n🏅 ' + result.newAchievements[0].title + ' unlocked';
    }
    return text;
  }

  function grantPlays(g, n) {
    refreshDaily();
    setNumber(g + 'BonusPlays', number(g + 'BonusPlays') + n);
  }

  function playAd(g, done = () => {}) {
    const adStatus = playAdStatus(g);
    if (busy || remaining(g) > 0) return;

    if (adStatus.remaining <= 0) {
      panel(
        'Bonus plays used for today',
        'You’ve used both rewarded-play unlocks for ' + (names[g] || 'this game') + ' today. Free plays refill tomorrow.',
        [['Back to Arcade', () => location.href = 'games.html', 'secondary']]
      );
      return;
    }

    busy = true;

    const gameName = names[g] || 'game';

    panel(
      'Unlocking ' + PLAY_AD_BONUS + ' ' + gameName + ' plays…',
      'This demo simulates a future rewarded ad. Keep this screen open to unlock your extra plays.',
      [['Cancel', () => {}, 'secondary']]
    );

    modal.className = 'reward-ad-dialog';

    const reward = document.createElement('div');
    reward.className = 'reward-ad-pill';
    reward.textContent = '🎟️ +' + PLAY_AD_BONUS + ' ' + gameName + ' plays';

    const progressWrap = document.createElement('div');
    progressWrap.className = 'reward-ad-progress';

    const track = document.createElement('div');
    track.className = 'reward-ad-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', '0');

    const fill = document.createElement('div');
    fill.className = 'reward-ad-fill';
    track.append(fill);

    const countdown = document.createElement('div');
    countdown.className = 'reward-ad-countdown';
    countdown.textContent = '3 seconds remaining';

    progressWrap.append(track, countdown);
    modal.insertBefore(reward, modal.querySelector('.modal-actions'));
    modal.insertBefore(progressWrap, modal.querySelector('.modal-actions'));

    const cancelButton = modal.querySelector('.modal-actions button');
    if (cancelButton) cancelButton.classList.add('reward-ad-cancel');

    const duration = 3000;
    const startedAt = Date.now();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      fill.style.width = '100%';
      track.setAttribute('aria-valuenow', '100');
      countdown.textContent = 'Unlocked ✓';
      reward.classList.add('complete');

      setNumber(g + 'PlayAdUnlocks', adStatus.used + 1);
      grantPlays(g, PLAY_AD_BONUS);
      queueEvent('rewarded_play_unlock', {
        game:g,
        unlockNumber:adStatus.used + 1,
        dailyLimit:PLAY_AD_DAILY_LIMIT,
        playsGranted:PLAY_AD_BONUS
      });
      if (cancelButton) cancelButton.disabled = true;
      done();

      const heading = modal.querySelector('h2');
      const message = modal.querySelector('.modal-message');
      if (heading) heading.textContent = PLAY_AD_BONUS + ' ' + gameName + ' plays unlocked!';
      if (message) message.textContent = 'You’re ready to jump back in.';

      setTimeout(() => {
        modal.close();
        busy = false;
        toast('🎟️ +' + PLAY_AD_BONUS + ' ' + gameName + ' plays');
      }, 450);
    };

    const updateProgress = () => {
      const elapsed = Date.now() - startedAt;
      const percent = Math.min(100, (elapsed / duration) * 100);
      const secondsLeft = Math.max(0, Math.ceil((duration - elapsed) / 1000));

      fill.style.width = percent + '%';
      track.setAttribute('aria-valuenow', String(Math.round(percent)));
      countdown.textContent = secondsLeft > 0
        ? secondsLeft + ' second' + (secondsLeft === 1 ? '' : 's') + ' remaining'
        : 'Unlocking…';

      if (elapsed >= duration) finish();
    };

    const timer = setInterval(updateProgress, 80);
    updateProgress();

    modal.addEventListener('close', () => {
      clearInterval(timer);
      if (!finished) busy = false;
    }, { once:true });
  }

  function out(g, done) {
    const status = playAdStatus(g);
    const gameName = names[g] || 'this game';

    if (status.remaining <= 0) {
      panel(
        'That’s today’s bonus-play limit',
        'You’ve used both rewarded-play unlocks for ' + gameName + ' today. Your 3 free plays refill tomorrow.',
        [['Back to Arcade', () => location.href = 'games.html', 'secondary']]
      );
      return;
    }

    panel(
      'Out of ' + gameName + ' plays',
      'Free plays refill daily. You have ' + status.remaining + ' of ' + status.limit + ' bonus-play unlock' +
        (status.remaining === 1 ? '' : 's') + ' left today. Each rewarded ad unlocks +' + PLAY_AD_BONUS + ' plays.',
      [
        ['Watch demo ad · +' + PLAY_AD_BONUS + ' plays', () => playAd(g, done), 'green'],
        ['Back to Arcade', () => location.href = 'games.html', 'secondary']
      ]
    );
  }


  function gameGuide(options = {}) {
    const game = options.game;
    const surface = typeof options.surface === 'string'
      ? document.querySelector(options.surface)
      : options.surface;

    if (!game || !surface) return null;

    document.body.classList.add('game-guide-page');

    const surfaceRect = surface.getBoundingClientRect();
    const surfaceRadius = getComputedStyle(surface).borderRadius;

    const wrapper = document.createElement('div');
    wrapper.className = 'game-guide-surface-wrap';
    if (surfaceRect.width > 0) wrapper.style.width = Math.ceil(surfaceRect.width) + 'px';
    if (surfaceRadius) wrapper.style.borderRadius = surfaceRadius;

    surface.parentNode.insertBefore(wrapper, surface);
    wrapper.append(surface);
    surface.classList.add('game-guide-surface');

    // iPhone Safari can interpret fast repeated taps as a page-zoom gesture.
    // Keep zoom/gesture prevention scoped to the actual game area so the rest
    // of Earnly remains normally zoomable and accessible.
    let lastTouchEnd = 0;
    const preventGameGesture = event => {
      event.preventDefault();
    };

    wrapper.addEventListener('dblclick', preventGameGesture, { passive:false });
    wrapper.addEventListener('gesturestart', preventGameGesture, { passive:false });
    wrapper.addEventListener('gesturechange', preventGameGesture, { passive:false });
    wrapper.addEventListener('gestureend', preventGameGesture, { passive:false });

    wrapper.addEventListener('touchmove', event => {
      if (event.touches && event.touches.length > 1) event.preventDefault();
    }, { passive:false });

    wrapper.addEventListener('touchend', event => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) event.preventDefault();
      lastTouchEnd = now;
    }, { passive:false });

    const strip = document.createElement('section');
    strip.className = 'game-guide-strip';
    strip.setAttribute('aria-label', (names[game] || 'Game') + ' quick instructions');

    (options.steps || []).slice(0, 3).forEach(step => {
      const item = document.createElement('div');
      item.className = 'game-guide-step';

      const icon = document.createElement('span');
      icon.className = 'game-guide-step-icon';
      icon.textContent = step.icon || '•';

      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = step.title || '';
      const text = document.createElement('small');
      text.textContent = step.text || '';

      copy.append(title, text);
      item.append(icon, copy);
      strip.append(item);
    });

    wrapper.before(strip);

    const goalParams = new URLSearchParams(location.search);
    const goalSource = goalParams.get('goal');
    let goal = null;

    if (goalSource === 'daily' || goalSource === 'weekly') {
      sessionStorage.setItem('earnlyActiveGoal', JSON.stringify({
        source:goalSource,
        mission:goalParams.get('mission') || '',
        game,
        startedAt:Date.now()
      }));
    }

    if (goalSource === 'daily') {
      const challenge = challengeStatus();
      if (challenge.game === game && !challenge.claimed) {
        goal = {
          eyebrow:'TODAY’S CHALLENGE',
          icon:'🔥',
          title:challenge.title.replace(/^\S+\s*/, ''),
          description:challenge.description,
          progress:challenge.progress,
          target:challenge.goal,
          reward:'+' + challenge.reward + ' Coins',
          href:'index.html',
          returnLabel:'Home'
        };
      }
    } else if (goalSource === 'weekly') {
      const missionId = goalParams.get('mission');
      const mission = weeklyStatus().missions.find(item => item.id === missionId);
      if (mission && mission.game === game && !mission.claimed) {
        goal = {
          eyebrow:'WEEKLY MISSION',
          icon:mission.icon,
          title:mission.title,
          description:mission.description,
          progress:mission.progress,
          target:mission.goal,
          reward:'+' + mission.rewardXP + ' XP',
          href:'stats.html',
          returnLabel:'Missions'
        };
      }
    }

    if (goal) {
      const card = document.createElement('section');
      card.className = 'game-goal-card';

      const copy = document.createElement('div');
      copy.className = 'game-goal-copy';

      const eyebrow = document.createElement('span');
      eyebrow.className = 'game-goal-eyebrow';
      eyebrow.textContent = goal.eyebrow;

      const title = document.createElement('strong');
      title.textContent = goal.icon + ' ' + goal.title;

      const detail = document.createElement('small');
      detail.textContent = goal.description + ' · ' + goal.progress + '/' + goal.target;

      copy.append(eyebrow, title, detail);

      const side = document.createElement('div');
      side.className = 'game-goal-side';

      const reward = document.createElement('b');
      reward.textContent = goal.reward;

      const back = document.createElement('a');
      back.href = goal.href;
      back.textContent = '← ' + goal.returnLabel;

      side.append(reward, back);
      card.append(copy, side);
      strip.before(card);
    }

    const overlay = document.createElement('div');
    overlay.className = 'game-guide-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const overlayIcon = document.createElement('div');
    overlayIcon.className = 'game-guide-overlay-icon';
    overlayIcon.textContent = options.overlayIcon || '👆';

    const overlayTitle = document.createElement('strong');
    overlayTitle.className = 'game-guide-overlay-title';

    const overlayText = document.createElement('span');
    overlayText.className = 'game-guide-overlay-text';

    overlay.append(overlayIcon, overlayTitle, overlayText);
    wrapper.append(overlay);

    const tips = Array.isArray(options.tips) ? options.tips.filter(Boolean) : [];
    if (options.reward) tips.push(options.reward);

    if (tips.length) {
      const details = document.createElement('details');
      details.className = 'game-guide-more';

      const summary = document.createElement('summary');
      summary.textContent = 'More tips & rewards';
      details.append(summary);

      tips.forEach(tip => {
        const p = document.createElement('p');
        p.textContent = tip;
        details.append(p);
      });

      const afterTarget = options.detailsAfter
        ? (typeof options.detailsAfter === 'string'
            ? document.querySelector(options.detailsAfter)
            : options.detailsAfter)
        : wrapper;

      (afterTarget || wrapper).insertAdjacentElement('afterend', details);
    }

    const statusEl = document.querySelector(options.status || '#gameStatus');

    // Keep game state (Ready / Running / Game Over) visually tied to the title
    // on every game page instead of leaving it floating below the stat row.
    if (statusEl && !statusEl.closest('.game-title-status-row')) {
      const header = statusEl.closest('.page-header') || document.querySelector('.page-header');
      const heading = header?.querySelector('h1');

      if (header && heading) {
        const row = document.createElement('div');
        row.className = 'game-title-status-row';
        heading.insertAdjacentElement('beforebegin', row);
        row.append(heading, statusEl);
        statusEl.classList.add('title-status');
      }
    }

    const refresh = () => {
      const statusText = (statusEl?.textContent || '').trim().toLowerCase();
      const active =
        statusText.includes('running') ||
        statusText.includes('get ready') ||
        statusText.includes('starting');

      if (active) {
        overlay.classList.add('hidden');
        return;
      }

      overlay.classList.remove('hidden');

      const playsLeft = remaining(game);
      if (playsLeft <= 0) {
        overlayIcon.textContent = '🎟️';
        overlayTitle.textContent = 'Out of Plays';
        overlayText.textContent = 'Tap here to see today’s play options';
        return;
      }

      const replay =
        statusText.includes('over') ||
        statusText.includes('complete') ||
        statusText.includes('clear') ||
        statusText.includes('survived') ||
        statusText.includes('finished');

      overlayIcon.textContent = replay ? (options.replayIcon || '↻') : (options.overlayIcon || '👆');
      overlayTitle.textContent = replay
        ? (options.replayTitle || 'Tap to Play Again')
        : (options.overlayTitle || 'Tap to Start');
      overlayText.textContent = replay
        ? (options.replayText || options.overlayText || '')
        : (options.overlayText || '');
    };

    if (statusEl) {
      new MutationObserver(refresh).observe(statusEl, {
        childList:true,
        characterData:true,
        subtree:true,
        attributes:true
      });
    }

    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);

    requestAnimationFrame(refresh);

    return {
      wrapper,
      overlay,
      refresh
    };
  }

  function showOnboarding(force = false) {
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!force) {
      if (file !== 'index.html' && file !== '') return;
      if (localStorage.getItem('arcadeOnboardingSeen') === '1') return;
      if (number('gamesCompletedEver') > 0) {
        localStorage.setItem('arcadeOnboardingSeen', '1');
        return;
      }
    }

    if (modal.open) {
      closeModalThen(() => showOnboarding(force));
      return;
    }

    modal.className = 'onboarding-dialog';
    modal.replaceChildren();

    const head = document.createElement('div');
    head.className = 'onboarding-head';

    const icon = document.createElement('div');
    icon.className = 'onboarding-app-icon';
    icon.textContent = '🎮';

    const headCopy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = force ? 'How Earnly Works' : 'Welcome to Earnly';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Four simple systems, one arcade.';
    headCopy.append(title, subtitle);
    head.append(icon, headCopy);

    const list = document.createElement('div');
    list.className = 'onboarding-list';

    [
      ['🎟️','Plays','3 free plays per game each day. Up to 2 rewarded ads can unlock +3 plays each for that game.'],
      ['🪙','Arcade Coins','Earned from game rewards, daily bonuses, and challenges. Ads do not directly award Coins.'],
      ['⭐','XP','Builds your level through games, missions, streaks, and achievements.'],
      ['🎁','Rewards','Coins are prototype rewards today. Real cash-out is not connected yet.']
    ].forEach(([itemIcon,itemTitle,itemText]) => {
      const row = document.createElement('div');
      row.className = 'onboarding-row';

      const badge = document.createElement('span');
      badge.className = 'onboarding-row-icon';
      badge.textContent = itemIcon;

      const copy = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = itemTitle;
      const text = document.createElement('span');
      text.textContent = itemText;
      copy.append(strong,text);

      row.append(badge,copy);
      list.append(row);
    });

    const actions = document.createElement('div');
    actions.className = 'onboarding-actions';

    const close = document.createElement('button');
    close.className = 'onboarding-secondary';
    close.textContent = force ? 'Close' : 'Stay Here';
    close.addEventListener('click', () => {
      localStorage.setItem('arcadeOnboardingSeen', '1');
      closeModalThen(() => {});
    });

    const play = document.createElement('button');
    play.className = 'onboarding-primary';
    play.textContent = 'Play Games';
    play.addEventListener('click', () => {
      localStorage.setItem('arcadeOnboardingSeen', '1');
      closeModalThen(() => { location.href = 'games.html'; });
    });

    actions.append(close,play);
    modal.append(head,list,actions);
    modal.showModal();
  }

    let installPromptEvent = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPromptEvent = event;
    window.dispatchEvent(new CustomEvent('earnly-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    installPromptEvent = null;
    localStorage.setItem('arcadeInstalled', '1');
    toast('📱 Earnly Arcade installed!');
    window.dispatchEvent(new CustomEvent('earnly-install-changed'));
  });

  function installStatus() {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    return {
      standalone,
      isIOS,
      canPrompt:!!installPromptEvent,
      installed:standalone || localStorage.getItem('arcadeInstalled') === '1'
    };
  }

  async function requestInstall() {
    const status = installStatus();

    if (status.standalone) {
      toast('📱 Earnly is already running like an installed app');
      return { installed:true, method:'standalone' };
    }

    if (installPromptEvent) {
      const prompt = installPromptEvent;
      installPromptEvent = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      return {
        installed:choice && choice.outcome === 'accepted',
        method:'prompt',
        outcome:choice?.outcome || 'dismissed'
      };
    }

    if (status.isIOS) {
      let transferCopied = false;
      if (hasMeaningfulProgress()) {
        try {
          const transfer = await copyTransferCode();
          transferCopied = transfer.copied;
        } catch {}
      }

      panel(
        '📱 Add Earnly to your iPhone',
        'In Safari:\n\n1. Tap the Share button.\n2. Choose “Add to Home Screen”.\n3. Tap Add.\n\n' +
        (transferCopied
          ? '✅ Your current Earnly progress was copied too. When the Home Screen app opens, tap “Restore Safari Progress.”'
          : 'If your Home Screen app starts fresh, open Account & Data to move your Safari progress over.'),
        [['Got It', () => {}, 'green']]
      );
      return { installed:false, method:'ios-help', transferCopied };
    }

    panel(
      '📱 Install Earnly Arcade',
      'Open this page in a browser that supports installing web apps, then use its Install or Add to Home Screen option.',
      [['Got It', () => {}, 'green']]
    );
    return { installed:false, method:'help' };
  }

  function mountConnectionBanner() {
    if (!document.body || document.getElementById('connectionBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'connectionBanner';
    banner.className = 'connection-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = '📴 Offline mode · cached games are still available';
    document.body.append(banner);

    const render = () => {
      const offline = navigator.onLine === false;
      banner.classList.toggle('show', offline);
      document.body.classList.toggle('is-offline', offline);
    };

    window.addEventListener('online', () => {
      render();
      toast('🌐 Back online');
    });
    window.addEventListener('offline', render);
    render();
  }

  function mountLaunchSplash() {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (!standalone || sessionStorage.getItem('arcadeSplashSeen') === '1') return;
    sessionStorage.setItem('arcadeSplashSeen', '1');

    const splash = document.createElement('div');
    splash.className = 'launch-splash';

    const icon = document.createElement('img');
    icon.src = 'earnly-icon.svg';
    icon.alt = '';

    const title = document.createElement('strong');
    title.textContent = 'Earnly Arcade';

    const subtitle = document.createElement('span');
    subtitle.textContent = 'Play. Earn. Level Up.';

    splash.append(icon, title, subtitle);
    document.body.append(splash);

    requestAnimationFrame(() => splash.classList.add('show'));
    setTimeout(() => {
      splash.classList.remove('show');
      setTimeout(() => splash.remove(), 260);
    }, reducedMotionEnabled() ? 250 : 800);
  }

  function appStatus() {
    return {
      version:APP_VERSION,
      online:navigator.onLine !== false,
      sound:soundEnabled(),
      haptics:hapticsEnabled(),
      reducedMotion:reducedMotionEnabled(),
      textScale:textScale(),
      textScalePercent:textScalePercent(),
      install:installStatus(),
      deviceId:deviceId(),
      sync:syncStatus()
    };
  }

    function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope:'./', updateViaCache:'none' })
        .then(registration => {
          registration.update().catch(() => {});
        })
        .catch(() => {});
    }, { once:true });
  }

  
  function mountDesktopNav() {
    if (!document.body || document.getElementById('arcadeDesktopNav')) return;

    const container = document.querySelector('.container');
    if (!container) return;

    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const gameFiles = new Set([
      'games.html','snake.html','blockdrop.html','taprush.html','memory.html',
      'dodger.html','brickbreaker.html','junglehopper.html','towerstack.html',
      'coincatch.html','colormatch.html','paddlerally.html','lanerunner.html','safecracker.html','mini.html'
    ]);

    let active = 'home';
    if (gameFiles.has(file)) active = 'games';
    else if (file === 'stats.html') active = 'missions';
    else if (file === 'rewards.html') active = 'rewards';
    else if (file === 'profile.html' || file === 'account.html' || file === 'settings.html') active = 'profile';

    const items = [
      ['home','🏠','Home','index.html'],
      ['games','🕹️','Games','games.html'],
      ['missions','📅','Missions','stats.html'],
      ['rewards','🎁','Rewards','rewards.html'],
      ['profile','👤','Profile','profile.html']
    ];

    const nav = document.createElement('nav');
    nav.id = 'arcadeDesktopNav';
    nav.className = 'desktop-nav';
    nav.setAttribute('aria-label', 'Earnly desktop navigation');

    items.forEach(([key, icon, label, href]) => {
      const link = document.createElement('a');
      link.className = 'desktop-nav-item' + (key === active ? ' active' : '');
      link.href = href;
      if (key === active) link.setAttribute('aria-current', 'page');
      link.textContent = icon + ' ' + label;
      nav.append(link);
    });

    const topbar = container.querySelector('.topbar');
    if (topbar) topbar.insertAdjacentElement('afterend', nav);
    else container.prepend(nav);
  }

  function mountBottomNav() {
    if (!document.body || document.getElementById('arcadeBottomNav')) return;

    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const gameFiles = new Set([
      'games.html','snake.html','blockdrop.html','taprush.html','memory.html',
      'dodger.html','brickbreaker.html','junglehopper.html','towerstack.html',
      'coincatch.html','colormatch.html','paddlerally.html','lanerunner.html','safecracker.html','mini.html'
    ]);

    let active = 'home';
    if (gameFiles.has(file)) active = 'games';
    else if (file === 'stats.html') active = 'missions';
    else if (file === 'rewards.html') active = 'rewards';
    else if (file === 'profile.html' || file === 'account.html' || file === 'settings.html') active = 'profile';

    const items = [
      ['home','🏠','Home','index.html'],
      ['games','🕹️','Games','games.html'],
      ['missions','📅','Missions','stats.html'],
      ['rewards','🎁','Rewards','rewards.html'],
      ['profile','👤','Profile','profile.html']
    ];

    const nav = document.createElement('nav');
    nav.id = 'arcadeBottomNav';
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Earnly navigation');

    items.forEach(([key, icon, label, href]) => {
      const link = document.createElement('a');
      link.className = 'bottom-nav-item' + (key === active ? ' active' : '');
      link.href = href;
      if (key === active) link.setAttribute('aria-current', 'page');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'bottom-nav-icon';
      iconSpan.textContent = icon;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'bottom-nav-label';
      labelSpan.textContent = label;

      link.append(iconSpan, labelSpan);
      nav.append(link);
    });

    document.body.append(nav);
    document.body.classList.add('has-app-nav');
  }

  function bootCloudClient() {
    const file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'account.html') return;

    const loadCloud = () => {
      if (window.EarnlyCloud || document.querySelector('script[data-earnly-cloud]')) return;
      const script = document.createElement('script');
      script.src = 'cloud.js';
      script.dataset.earnlyCloud = '1';
      script.async = true;
      document.head.append(script);
    };

    if (window.supabase?.createClient) {
      loadCloud();
      return;
    }

    if (document.querySelector('script[data-earnly-supabase]')) return;

    const sdk = document.createElement('script');
    sdk.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    sdk.dataset.earnlySupabase = '1';
    sdk.async = true;
    sdk.addEventListener('load', loadCloud, { once:true });
    sdk.addEventListener('error', () => {
      window.addEventListener('online', bootCloudClient, { once:true });
    }, { once:true });
    document.head.append(sdk);
  }

  repairLifetimeCounters();
  repairGameStats();
  applyTextScale();
  applyMotionPreference();
  mountBottomNav();
  mountDesktopNav();
  mountConnectionBanner();
  mountLaunchSplash();
  registerServiceWorker();
  bootCloudClient();

  let gameplayLockedScrollY = 0;

  function setGameplayScrollLock(enabled) {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;

    const locked = body.classList.contains('earnly-gameplay-locked');
    if (enabled && !locked) {
      gameplayLockedScrollY = window.scrollY || window.pageYOffset || 0;
      html.classList.add('earnly-gameplay-locked');
      body.classList.add('earnly-gameplay-locked');
      body.style.top = '-' + gameplayLockedScrollY + 'px';
      return;
    }

    if (!enabled && locked) {
      html.classList.remove('earnly-gameplay-locked');
      body.classList.remove('earnly-gameplay-locked');
      body.style.top = '';
      const restoreY = gameplayLockedScrollY;
      requestAnimationFrame(() => window.scrollTo(0, restoreY));
    }
  }

  function setupGameplayScrollLock() {
    const sync = () => {
      setGameplayScrollLock(!!document.querySelector('.game-status.running'));
    };

    const start = () => {
      sync();
      const observer = new MutationObserver(sync);
      observer.observe(document.body, {
        subtree:true,
        attributes:true,
        attributeFilter:['class']
      });

      window.addEventListener('pagehide', () => {
        observer.disconnect();
        setGameplayScrollLock(false);
      }, { once:true });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once:true });
    } else {
      start();
    }
  }

  function isProtectedGameControlTarget(target) {
    const element = target instanceof Element ? target : null;
    if (!element) return false;
    return !!element.closest(
      'a,button,input,textarea,select,summary,[role="button"],' +
      '.bottom-nav,.desktop-nav,.modal-backdrop,.game-result-modal,.toast'
    );
  }

  function inExpandedGameZone(event, surface, padding = 110) {
    if (!surface || isProtectedGameControlTarget(event?.target)) return false;
    const rect = surface.getBoundingClientRect();
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

    const horizontalPadding = Math.min(80, Math.max(30, padding * .55));
    return x >= rect.left - horizontalPadding &&
      x <= rect.right + horizontalPadding &&
      y >= rect.top - padding &&
      y <= rect.bottom + padding;
  }

  function gameSurfaceX(clientX, surface, logicalWidth) {
    const rect = surface.getBoundingClientRect();
    const width = Number(logicalWidth) || surface.width || rect.width || 1;
    const normalized = (Number(clientX) - rect.left) / Math.max(1, rect.width);
    return Math.max(0, Math.min(width, normalized * width));
  }

  return {
    names,
    FREE_PLAYS,
    PLAY_AD_BONUS,
    PLAY_AD_DAILY_LIMIT,
    remaining,
    playAdStatus,
    resetPrototypePlays,
    consume,
    best,
    recordResult,
    achievements,
    achievementSummary,
    profileName,
    setProfileName,
    xpStatus,
    addXP,
    favorites,
    isFavorite,
    toggleFavorite,
    recentGames,
    markRecent,
    gameStats,
    allGameStats,
    mostPlayedGame,
    streakRewardStatus,
    claimStreakReward,
    repairLifetimeCounters,
    repairGameStats,
    textScale,
    textScalePercent,
    setTextScale,
    applyTextScale,
    showOnboarding,
    installStatus,
    requestInstall,
    deviceId,
    syncStatus,
    pendingSyncEvents,
    clearSyncEvents,
    snapshotData,
    hasMeaningfulProgress,
    transferCode,
    copyTransferCode,
    restoreTransferCode,
    restoreTransferFromClipboard,
    downloadBackup,
    restoreSnapshot,
    restoreBackupFile,
    stats,
    weeklyStatus,
    claimWeeklyMission,
    activity,
    earn,
    panel,
    gameResult,
    milestone,
    toast,
    soundEnabled,
    setSoundEnabled,
    hapticsEnabled,
    setHapticsEnabled,
    reducedMotionEnabled,
    setReducedMotionEnabled,
    appStatus,
    feedback,
    countdown,
    resultText,
    gameGuide,
    setGameplayScrollLock,
    isProtectedGameControlTarget,
    inExpandedGameZone,
    gameSurfaceX,
    playAd,
    ad:playAd,
    out,
    number,
    history,
    dailyCoinStatus,
    applyServerWallet,
    claimDailyBonus,
    dailyBonusStatus,
    challengeStatus,
    claimChallenge
  };
})();

(function ensureEarnlyCloudEverywhere(){
  function loadScript(src, onload){
    const existing = Array.from(document.scripts).find(script => script.src === src);
    if (existing) {
      if (onload) existing.addEventListener('load', onload, { once:true });
      return existing;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    if (onload) script.addEventListener('load', onload, { once:true });
    document.head.append(script);
    return script;
  }

  function start(){
    if (window.EarnlyCloud) return;

    const cloudUrl = new URL('cloud.js', location.href).href;
    const loadCloud = () => {
      if (!window.EarnlyCloud) loadScript(cloudUrl);
    };

    if (window.supabase) {
      loadCloud();
      return;
    }

    const supabaseUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    const existingSupabase = Array.from(document.scripts).find(script => script.src === supabaseUrl);

    if (existingSupabase) {
      if (window.supabase) loadCloud();
      else existingSupabase.addEventListener('load', loadCloud, { once:true });
      return;
    }

    loadScript(supabaseUrl, loadCloud);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
