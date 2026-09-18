// Earnly prototype storage only. No real ad SDK or cash-out system is connected yet.
const Arcade = (() => {
  const names = {
    snake: 'Snake',
    blockDrop: 'Block Drop',
    tapRush: 'Tap Rush',
    memory: 'Memory Match',
    dodger: 'Neon Dodger',
    brickBreaker: 'Brick Breaker'
  };
  const FREE_PLAYS = 3;
  const PLAY_AD_BONUS = 3;
  const COIN_AD_REWARD = 10;
  const COIN_AD_LIMIT = 5;
  const DAILY_BONUS = 10;
  const CHALLENGE_REWARD = 5;

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
    localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
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

    if (localStorage.getItem('arcadeChallengeDay') !== today) {
      localStorage.setItem('arcadeChallengeDay', today);
      setNumber('arcadeChallengeProgress', 0);
      localStorage.setItem('arcadeChallengeClaimed', '0');
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

  function recordGameForChallenge() {
    refreshDaily();
    if (number('arcadeChallengeProgress') < 1) {
      setNumber('arcadeChallengeProgress', 1);
    }
  }

  function consume(g) {
    if (!remaining(g)) return false;
    setNumber(g + 'GamesPlayed', number(g + 'GamesPlayed') + 1);
    recordGameForChallenge();
    return true;
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
    if (last === today) return { claimed: false, streak: number('dailyStreak') };

    const streak = last === yesterdayKey() ? number('dailyStreak') + 1 : 1;
    setNumber('dailyStreak', streak);
    localStorage.setItem('lastDailyBonusDate', today);
    earn(DAILY_BONUS, 'Daily bonus');
    return { claimed: true, streak };
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
    return {
      progress: Math.min(1, number('arcadeChallengeProgress')),
      goal: 1,
      claimed: localStorage.getItem('arcadeChallengeClaimed') === '1',
      reward: CHALLENGE_REWARD
    };
  }

  function claimChallenge() {
    const s = challengeStatus();
    if (s.progress < s.goal || s.claimed) return false;
    localStorage.setItem('arcadeChallengeClaimed', '1');
    earn(CHALLENGE_REWARD, 'Daily challenge');
    return true;
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
    }, { once: true });
  }

  function coinAdStatus() {
    refreshDaily();
    return {
      watched: number('coinAdsToday'),
      limit: COIN_AD_LIMIT,
      remaining: Math.max(0, COIN_AD_LIMIT - number('coinAdsToday')),
      reward: COIN_AD_REWARD
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
    }, { once: true });
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
    earn,
    panel,
    toast,
    playAd,
    ad: playAd,
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