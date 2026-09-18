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
      favorites: favorites().length
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

    const after = achievementDefinitions().filter(item => item.unlocked);
    const newlyUnlocked = after.filter(item => !before.has(item.id));

    const xpAward = BASE_GAME_XP + newlyUnlocked.length * ACHIEVEMENT_XP;
    const xpResult = addXP(xpAward);

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
    return { claimed:true, streak };
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
    stats,
    earn,
    panel,
    toast,
    soundEnabled,
    setSoundEnabled,
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