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
    towerStack: 'Tower Stack'
  };

  const bestConfig = {
    snake: { key: 'snakeBest', label: 'apples', lower: false },
    blockDrop: { key: 'blockDropBestLines', label: 'lines', lower: false },
    tapRush: { key: 'tapRushBest', label: 'hits', lower: false },
    memory: { key: 'memoryBestMoves', label: 'moves', lower: true },
    dodger: { key: 'dodgerBest', label: 'seconds', lower: false },
    brickBreaker: { key: 'brickBreakerBest', label: 'bricks', lower: false },
    jungleHopper: { key: 'jungleHopperBest', label: 'vines', lower: false },
    towerStack: { key: 'towerStackBest', label: 'floors', lower: false }
  };

  const FREE_PLAYS = 3;
  const PLAY_AD_BONUS = 3;
  const COIN_AD_REWARD = 10;
  const COIN_AD_LIMIT = 5;
  const DAILY_BONUS = 10;
  const CHALLENGE_VERSION = '3';
  const BASE_GAME_XP = 10;
  const ACHIEVEMENT_XP = 25;
  const WEEKLY_ALL_CLEAR_XP = 100;
  const DATA_SCHEMA_VERSION = 1;
  const APP_VERSION = '0.9.0';

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
    { id:'memory', title:'🧠 Memory Master', description:'Finish one Memory Match board today', goal:1, reward:8, type:'complete', game:'memory' }
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
    return events[events.length - 1];
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
    if (['points','lifetimePoints','dailyStreak','lastDailyBonusDate','streakRewardClaims'].includes(key)) return true;
    if (key.startsWith('arcade')) return true;
    if (key.startsWith('weekly')) return true;
    if (key.startsWith('coinAd') || key === 'coinAdsToday') return true;
    if (key.startsWith('gameRuns_') || key.startsWith('gameMetricTotal_')) return true;

    return Object.keys(names).some(game =>
      key === game + 'Best' ||
      key === game + 'BestLines' ||
      key === game + 'BestMoves' ||
      key === game + 'GamesPlayed' ||
      key === game + 'BonusPlays'
    );
  }

  const deviceOnlyKeys = new Set([
    'arcadeDeviceId',
    'arcadeSyncQueue',
    'arcadeInstalled',
    'arcadeOnboardingSeen'
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
    return favorites();
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
    return challengeDefinitions[seed % challengeDefinitions.length];
  }

  function refreshDaily() {
    const today = dateKey();

    if (localStorage.getItem('arcadePlayDay') !== today) {
      Object.keys(names).forEach(g => {
        setNumber(g + 'GamesPlayed', 0);
        setNumber(g + 'BonusPlays', 0);
      });
      localStorage.setItem('arcadePlayDay', today);
    }

    const challengeNeedsReset =
      localStorage.getItem('arcadeChallengeDay') !== today ||
      localStorage.getItem('arcadeChallengeVersion') !== CHALLENGE_VERSION;

    if (challengeNeedsReset) {
      localStorage.setItem('arcadeChallengeDay', today);
      localStorage.setItem('arcadeChallengeVersion', CHALLENGE_VERSION);
      setNumber('arcadeChallengeProgress', 0);
      localStorage.setItem('arcadeChallengeClaimed', '0');
      localStorage.setItem('arcadeChallengeGames', '[]');
    }

    if (localStorage.getItem('coinAdDay') !== today) {
      localStorage.setItem('coinAdDay', today);
      setNumber('coinAdsToday', 0);
    }
  }

  function remaining(g) {
    refreshDaily();
    return Math.max(0, FREE_PLAYS + number(g + 'BonusPlays') - number(g + 'GamesPlayed'));
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
      { id:'tower10', icon:'🏗️', title:'High Rise', description:'Stack 10 floors in Tower Stack', unlocked:number('towerStackBest') >= 10 },
      { id:'tower20', icon:'🏙️', title:'Skyline Builder', description:'Stack 20 floors in Tower Stack', unlocked:number('towerStackBest') >= 20 }
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

    const xpAward = BASE_GAME_XP + newlyUnlocked.length * ACHIEVEMENT_XP;
    const xpResult = addXP(xpAward);

    queueEvent('game_result', {
      game,
      metric:cleanMetric,
      best:currentBest.value,
      newBest,
      xpAward,
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

  function earn(n, source = 'Arcade reward') {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!n) return number('points');
    setNumber('points', number('points') + n);
    setNumber('lifetimePoints', number('lifetimePoints') + n);
    logTransaction(n, source);
    queueEvent('coin_award', {
      amount:n,
      source,
      balance:number('points'),
      lifetime:number('lifetimePoints')
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
    earn(DAILY_BONUS, 'Daily bonus');
    logActivity('reward', 'Daily bonus claimed', '+' + DAILY_BONUS + ' Arcade Coins · ' + streak + ' day streak');
    const ready = streakRewardStatus().rewards.find(item => item.days === streak && !item.claimed);
    if (ready) toast(ready.icon + ' ' + ready.title + ' reward ready!');
    return { claimed:true, streak, streakRewardReady:ready || null };
  }

  function dailyBonusStatus() {
    return {
      claimed: localStorage.getItem('lastDailyBonusDate') === dateKey(),
      streak: number('dailyStreak'),
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
    earn(s.reward, 'Daily challenge');
    logActivity('challenge', 'Daily challenge claimed', '+' + s.reward + ' Arcade Coins');
    return s;
  }

  const modal = document.createElement('dialog');
  modal.setAttribute('aria-modal', 'true');
  document.body.append(modal);

  let busy = false;

  function panel(title, message, actions) {
    if (modal.open) modal.close();
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
      b.addEventListener('click', () => {
        modal.close();
        fn();
      });
      actionBox.append(b);
    });

    modal.append(h, p, actionBox);
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
    return reducedMotionEnabled();
  }

  function applyMotionPreference() {
    document.documentElement.classList.toggle('reduce-motion', reducedMotionEnabled());
  }

  function setSoundEnabled(enabled) {
    localStorage.setItem('arcadeSound', enabled ? 'on' : 'off');
    if (enabled) feedback('go');
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
    if (busy || remaining(g) > 0) return;
    busy = true;

    panel(
      'Demo rewarded ad',
      'This 3-second simulation stands in for a future rewarded ad.\nFinish it to unlock +' + PLAY_AD_BONUS + ' ' + names[g] + ' plays.',
      [['Cancel', () => {}, 'secondary']]
    );

    const progress = document.createElement('progress');
    progress.max = 3;
    progress.value = 0;
    modal.insertBefore(progress, modal.querySelector('.modal-actions'));

    let elapsed = 0;
    let finished = false;
    const timer = setInterval(() => {
      elapsed += 1;
      progress.value = elapsed;

      if (elapsed >= 3) {
        finished = true;
        clearInterval(timer);
        grantPlays(g, PLAY_AD_BONUS);
        modal.close();
        busy = false;
        toast('🎮 +' + PLAY_AD_BONUS + ' ' + names[g] + ' plays');
        done();
      }
    }, 1000);

    modal.addEventListener('close', () => {
      clearInterval(timer);
      if (!finished) busy = false;
    }, { once:true });
  }

  function coinAdStatus() {
    refreshDaily();
    return {
      watched:number('coinAdsToday'),
      limit:COIN_AD_LIMIT,
      remaining:Math.max(0, COIN_AD_LIMIT - number('coinAdsToday')),
      reward:COIN_AD_REWARD
    };
  }

  function coinAd(done = () => {}) {
    const status = coinAdStatus();
    if (busy || status.remaining <= 0) {
      if (status.remaining <= 0) toast('Daily demo ad limit reached');
      return;
    }

    busy = true;
    panel(
      'Demo rewarded ad',
      'This is a 3-second simulation, not a real advertisement.\nFinish it to earn +' + COIN_AD_REWARD + ' Arcade Coins.',
      [['Cancel', () => {}, 'secondary']]
    );

    const progress = document.createElement('progress');
    progress.max = 3;
    progress.value = 0;
    modal.insertBefore(progress, modal.querySelector('.modal-actions'));

    let elapsed = 0;
    let finished = false;
    const timer = setInterval(() => {
      elapsed += 1;
      progress.value = elapsed;

      if (elapsed >= 3) {
        finished = true;
        clearInterval(timer);
        setNumber('coinAdsToday', number('coinAdsToday') + 1);
        earn(COIN_AD_REWARD, 'Rewarded ad demo');
        modal.close();
        busy = false;
        toast('🪙 +' + COIN_AD_REWARD + ' Arcade Coins');
        done();
      }
    }, 1000);

    modal.addEventListener('close', () => {
      clearInterval(timer);
      if (!finished) busy = false;
    }, { once:true });
  }

  function out(g, done) {
    panel(
      'Out of ' + names[g] + ' plays',
      'Your free plays refill daily.\nWant to keep playing now? Finish a demo rewarded ad for +' + PLAY_AD_BONUS + ' plays.',
      [
        ['Watch demo ad · +' + PLAY_AD_BONUS + ' plays', () => playAd(g, done), 'green'],
        ['Back to Arcade', () => location.href = 'games.html', 'secondary']
      ]
    );
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

    panel(
      '🎮 Welcome to Earnly Arcade',
      '1. Play arcade games and build your best scores.\n\n2. Complete daily and weekly missions to earn XP and level up.\n\n3. Build streaks, unlock achievements, and track your stats.\n\nThis is still a prototype — real cash-out and real ad rewards are not connected yet.',
      [
        ['Let’s Play', () => {
          localStorage.setItem('arcadeOnboardingSeen', '1');
          location.href = 'games.html';
        }, 'green'],
        ['Explore Home', () => {
          localStorage.setItem('arcadeOnboardingSeen', '1');
        }, 'secondary']
      ]
    );
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
      panel(
        '📱 Add Earnly to your iPhone',
        'In Safari:\n\n1. Tap the Share button.\n2. Choose “Add to Home Screen”.\n3. Tap Add.\n\nThen Earnly opens from your Home Screen without the normal browser controls.',
        [['Got It', () => {}, 'green']]
      );
      return { installed:false, method:'ios-help' };
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
    subtitle.textContent = 'Play. Watch. Earn.';

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
      install:installStatus(),
      sync:syncStatus()
    };
  }

    function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope:'./' })
        .then(registration => {
          registration.update().catch(() => {});
        })
        .catch(() => {});
    }, { once:true });
  }

    function mountBottomNav() {
    if (!document.body || document.getElementById('arcadeBottomNav')) return;

    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const gameFiles = new Set([
      'games.html','snake.html','blockdrop.html','taprush.html','memory.html',
      'dodger.html','brickbreaker.html','junglehopper.html','towerstack.html'
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

  applyMotionPreference();
  mountBottomNav();
  mountConnectionBanner();
  mountLaunchSplash();
  registerServiceWorker();
  setTimeout(() => showOnboarding(false), 180);

  return {
    names,
    FREE_PLAYS,
    remaining,
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
    showOnboarding,
    installStatus,
    requestInstall,
    deviceId,
    syncStatus,
    pendingSyncEvents,
    clearSyncEvents,
    snapshotData,
    downloadBackup,
    restoreSnapshot,
    restoreBackupFile,
    stats,
    weeklyStatus,
    claimWeeklyMission,
    activity,
    earn,
    panel,
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
    playAd,
    ad:playAd,
    coinAd,
    coinAdStatus,
    out,
    number,
    history,
    claimDailyBonus,
    dailyBonusStatus,
    challengeStatus,
    claimChallenge
  };
})();