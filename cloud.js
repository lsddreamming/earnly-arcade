(() => {
  'use strict';

  const SUPABASE_URL = 'https://zdwziebtbpuolusztede.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ';

  const client = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth:{
          persistSession:true,
          autoRefreshToken:true,
          detectSessionInUrl:true
        }
      })
    : null;

  function requireClient(){
    if (!client) throw new Error('Earnly Cloud could not load. Check your connection and try again.');
    return client;
  }

  async function session(){
    const { data, error } = await requireClient().auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function user(){
    const current = await session();
    return current?.user || null;
  }

  async function signUp(email, password){
    const emailRedirectTo = new URL('account.html', window.location.href).href.split('#')[0];
    const result = await requireClient().auth.signUp({
      email:String(email || '').trim(),
      password:String(password || ''),
      options:{ emailRedirectTo }
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signIn(email, password){
    const result = await requireClient().auth.signInWithPassword({
      email:String(email || '').trim(),
      password:String(password || '')
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signInAndRestore(email, password){
    accountTransition = true;
    try {
      const auth = await signIn(email, password);
      const remote = await cloudSaveInfo();
      const localDeviceId = Arcade.deviceId();
      let restore;

      // A manual sign-in on a different browser/device means the player is
      // trying to bring their established Earnly progress with them. Restore
      // that cloud save before any automatic save can write this device's
      // partial local state back to the account.
      if (remote && remote.device_id !== localDeviceId) {
        const restored = await restoreProgress();
        let rewardSync = null;
        try {
          rewardSync = await syncServerRewards();
        } catch {
          // The profile restore is still successful if wallet reconciliation
          // needs to retry when the connection improves.
        }
        restore = { ...restored, auto:true, crossDevice:true, rewardSync };
      } else {
        restore = await maybeRestoreFreshDevice();
      }

      if (!restore?.auto) {
        scheduleAutoSync('manual-signin', 600);
      }

      return { auth, restore };
    } finally {
      accountTransition = false;
    }
  }

  async function sendPasswordReset(email){
    const redirectTo = new URL('account.html?recovery=1', window.location.href).href.split('#')[0];
    const { data, error } = await requireClient().auth.resetPasswordForEmail(
      String(email || '').trim(),
      { redirectTo }
    );
    if (error) throw error;
    return data;
  }

  async function updatePassword(password){
    const cleaned = String(password || '');
    if (cleaned.length < 6) throw new Error('Use a password with at least 6 characters.');
    const { data, error } = await requireClient().auth.updateUser({ password:cleaned });
    if (error) throw error;
    return data;
  }

  async function signOut(){
    accountTransition = true;
    try {
      const { error } = await requireClient().auth.signOut();
      if (error) throw error;
      return true;
    } finally {
      accountTransition = false;
    }
  }

  async function deleteAccount(){
    accountTransition = true;
    try {
      const current = await user();
      if (!current) throw new Error('Sign in before deleting your account.');

      const { data, error } = await requireClient().functions.invoke('delete-account', {
        body:{ confirm:true }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Account deletion failed.');

      // The server account and all cloud rows are deleted via ON DELETE CASCADE.
      // Keep this device's game progress as guest progress, but remove all
      // account-specific sync state so it can never leak into another account.
      try { await requireClient().auth.signOut({ scope:'local' }); } catch {}
      try { Arcade.clearSyncEvents?.(); } catch {}

      [
        'arcadeLastCloudSave',
        'arcadeLastCloudRestore',
        'arcadeLastCloudHash',
        'arcadeCloudConflict',
        'arcadeCloudSyncError',
        'arcadeCloudOfflinePending',
        'arcadeServerRewardError',
        'arcadeFreshDeviceRestoreDone'
      ].forEach(key => localStorage.removeItem(key));

      window.dispatchEvent(new CustomEvent('earnly-account-deleted'));
      return true;
    } finally {
      accountTransition = false;
    }
  }

  async function cloudSaveInfo(){
    const current = await user();
    if (!current) return null;

    const { data, error } = await requireClient()
      .from('player_saves')
      .select('updated_at,app_version,device_id')
      .eq('user_id', current.id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  let freshRestorePromise = null;
  let accountTransition = false;
  let rewardSyncPromise = null;

  async function maybeRestoreFreshDevice(){
    if (freshRestorePromise) return freshRestorePromise;

    freshRestorePromise = (async () => {
      const current = await user();
      if (!current) return { skipped:'signed-out' };
      if (Arcade.hasMeaningfulProgress()) return { skipped:'local-progress' };

      const { data, error } = await requireClient()
        .from('player_saves')
        .select('payload,updated_at,app_version,device_id')
        .eq('user_id', current.id)
        .maybeSingle();

      if (error) throw error;
      if (!data?.payload) return { skipped:'no-cloud-save' };

      const marker = current.id + ':' + (data.updated_at || data.app_version || 'save');
      if (localStorage.getItem('arcadeFreshDeviceRestoreDone') === marker) {
        return { skipped:'already-restored', save:data };
      }

      const result = Arcade.restoreSnapshot(data.payload);
      Arcade.repairLifetimeCounters?.();
      Arcade.repairGameStats?.();

      if (data.updated_at) localStorage.setItem('arcadeLastCloudSave', data.updated_at);
      localStorage.setItem('arcadeLastCloudRestore', new Date().toISOString());
      localStorage.setItem('arcadeLastCloudHash', snapshotSignature(data.payload));
      localStorage.setItem('arcadeFreshDeviceRestoreDone', marker);
      localStorage.removeItem('arcadeCloudConflict');
      localStorage.removeItem('arcadeCloudSyncError');
      clearSnapshotSyncedEvents();

      let rewardSync = null;
      try {
        rewardSync = await syncServerRewards();
      } catch {
        // Snapshot restore should still succeed if wallet reconciliation is temporarily unavailable.
      }

      const detail = {
        restored:result.restored,
        updatedAt:data.updated_at || null,
        sourceDeviceId:data.device_id || null
      };
      window.dispatchEvent(new CustomEvent('earnly-cloud-auto-restored', { detail }));
      return { restored:result.restored, save:data, auto:true, rewardSync };
    })();

    try {
      return await freshRestorePromise;
    } finally {
      freshRestorePromise = null;
    }
  }

  async function walletInfo(){
    const current = await user();
    if (!current) return null;

    const { data, error } = await requireClient()
      .from('coin_wallets')
      .select('balance,lifetime_earned,updated_at,legacy_seeded')
      .eq('user_id', current.id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function syncServerRewards(){
    if (rewardSyncPromise) return rewardSyncPromise;

    rewardSyncPromise = (async () => {
    const current = await user();
    if (!current) return { skipped:'signed-out', synced:0 };

    const rewardEvents = Arcade.pendingSyncEvents()
      .filter(event =>
        event?.type === 'coin_award' &&
        event?.payload?.server &&
        typeof event.payload.server === 'object'
      )
      .slice(0, 30);

    if (!rewardEvents.length) {
      const wallet = await walletInfo();
      if (wallet) Arcade.applyServerWallet?.(wallet);
      localStorage.removeItem('arcadeServerRewardError');
      return { synced:0, wallet };
    }

    let synced = 0;
    let wallet = null;
    const mismatches = [];

    for (const event of rewardEvents) {
      const server = event.payload.server || {};
      const body = {
        eventId:event.id,
        kind:server.kind || '',
        game:server.game || null,
        metric:server.metric ?? null,
        aux:server.aux ?? null,
        challengeId:server.challengeId || null,
        source:event.payload.source || 'Arcade reward'
      };

      const { data, error } = await requireClient().rpc('claim_coin_reward', {
        p_event_id: body.eventId,
        p_kind: body.kind,
        p_game: body.game,
        p_metric: body.metric,
        p_aux: body.aux,
        p_challenge_id: body.challengeId,
        p_source: body.source
      });

      if (error || !data?.ok) {
        const message = String(error?.message || data?.error || 'Server reward rejected');
        const permanent = /Unknown game|Unsupported reward type|Invalid reward event|Invalid memory result|Daily bonus already recorded|Daily challenge already recorded|Daily server reward limit reached|not today'?s server challenge/i.test(message);

        if (permanent) {
          Arcade.clearSyncEvents(event.id);
          const rejected = (() => {
            try {
              const existing = JSON.parse(localStorage.getItem('arcadeRejectedRewardEvents') || '[]');
              return Array.isArray(existing) ? existing : [];
            } catch {
              return [];
            }
          })();
          rejected.push({
            eventId:event.id,
            game:body.game,
            kind:body.kind,
            message,
            clearedAt:new Date().toISOString()
          });
          localStorage.setItem('arcadeRejectedRewardEvents', JSON.stringify(rejected.slice(-25)));
          continue;
        }

        localStorage.setItem('arcadeServerRewardError', message);
        window.dispatchEvent(new CustomEvent('earnly-server-reward-error', {
          detail:{ eventId:event.id, message }
        }));
        break;
      }

      const localAmount = Math.max(0, Math.floor(Number(event.payload.amount) || 0));
      const serverAmount = Math.max(0, Math.floor(Number(data.amount) || 0));
      if (localAmount !== serverAmount) {
        mismatches.push({
          eventId:event.id,
          source:event.payload.source || '',
          localAmount,
          serverAmount
        });
      }

      if (data.wallet) wallet = data.wallet;
      Arcade.clearSyncEvents(event.id);
      synced += 1;
    }

    if (wallet) {
      Arcade.applyServerWallet?.(wallet);
      localStorage.setItem('arcadeShadowWallet', JSON.stringify({
        balance:Number(wallet.balance || 0),
        lifetime:Number(wallet.lifetime_earned || 0),
        checkedAt:new Date().toISOString()
      }));
    }

    if (mismatches.length) {
      localStorage.setItem('arcadeServerRewardMismatches', JSON.stringify(mismatches.slice(-20)));
    }

    const remainingRewardEvents = Arcade.pendingSyncEvents().filter(event =>
      event?.type === 'coin_award' &&
      event?.payload?.server &&
      typeof event.payload.server === 'object'
    );

    if (!remainingRewardEvents.length || synced) {
      localStorage.removeItem('arcadeServerRewardError');
    }

    if (synced) {
      window.dispatchEvent(new CustomEvent('earnly-server-rewards-synced', {
        detail:{ synced, wallet, mismatches }
      }));
    }

    return { synced, wallet, mismatches };
    })();

    try {
      return await rewardSyncPromise;
    } finally {
      rewardSyncPromise = null;
    }
  }

  const GROWTH_EVENT_TYPES = new Set([
    'acquisition_attributed',
    'onboarding_shown',
    'onboarding_completed',
    'onboarding_dismissed',
    'play_started',
    'game_result',
    'one_more_run_shown',
    'rewarded_ad_started',
    'rewarded_play_unlock',
    'leaderboard_viewed',
    'profile_identity_saved'
  ]);

  function isGrowthEvent(event){
    return !!event?.id && GROWTH_EVENT_TYPES.has(String(event.type || ''));
  }

  function growthEventBody(event){
    const attribution = Arcade.acquisitionContext?.() || {};
    const touch = attribution.first || attribution.latest || {};
    const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
    const propertyKeys = [
      'metric','best','newBest','xpAward','performanceXP','level',
      'playsUsed','bonusPlays','unlockNumber','dailyLimit','playsGranted',
      'unlocksLeft','firstTouch','rank','hasUsername','avatarKey'
    ];
    const properties = {};
    propertyKeys.forEach(key => {
      const value = payload[key];
      if (value === null || typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
        properties[key] = value;
      }
    });

    return {
      eventId:event.id,
      deviceId:event.deviceId || Arcade.deviceId(),
      eventType:event.type,
      creator:payload.creator || touch.creator || null,
      source:payload.source || touch.source || null,
      campaign:payload.campaign || touch.campaign || null,
      content:payload.content || touch.content || null,
      challenge:payload.challenge || touch.challenge || null,
      game:payload.game || null,
      landingPath:payload.landingPath || touch.path || (location.pathname.split('/').pop() || 'index.html'),
      clientCreatedAt:event.createdAt || null,
      properties
    };
  }

  let growthSyncPromise = null;

  function growthSyncEnabled(){
    return !['localhost','127.0.0.1','::1'].includes(location.hostname);
  }

  async function syncGrowthEvents(){
    if (growthSyncPromise) return growthSyncPromise;
    if (!growthSyncEnabled()) return { skipped:'local-test', synced:0 };
    if (!navigator.onLine) return { skipped:'offline', synced:0 };

    growthSyncPromise = (async () => {
      const events = Arcade.pendingSyncEvents().filter(isGrowthEvent).slice(0, 25);
      if (!events.length) return { synced:0 };

      let synced = 0;
      for (const event of events) {
        let response;
        try {
          response = await fetch(SUPABASE_URL + '/functions/v1/track-growth', {
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'apikey':SUPABASE_PUBLISHABLE_KEY
            },
            body:JSON.stringify(growthEventBody(event))
          });
        } catch {
          break;
        }

        if (!response.ok) break;
        const data = await response.json().catch(() => null);
        if (!data?.ok) break;

        Arcade.clearSyncEvents(event.id);
        synced += 1;
      }

      return { synced, pending:Arcade.pendingSyncEvents().filter(isGrowthEvent).length };
    })();

    try {
      return await growthSyncPromise;
    } finally {
      growthSyncPromise = null;
    }
  }

  function snapshotSignature(snapshot){
    const data = snapshot?.data && typeof snapshot.data === 'object' ? snapshot.data : {};
    const ordered = Object.keys(data).sort().map(key => [key, data[key]]);
    const text = JSON.stringify(ordered);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'v1-' + (hash >>> 0).toString(16).padStart(8, '0');
  }

  function clearSnapshotSyncedEvents(){
    const ids = Arcade.pendingSyncEvents()
      .filter(event => {
        const serverReward = (
          event?.type === 'coin_award' &&
          event?.payload?.server &&
          typeof event.payload.server === 'object'
        );
        return !serverReward && !isGrowthEvent(event);
      })
      .map(event => event.id)
      .filter(Boolean);

    if (ids.length) Arcade.clearSyncEvents(ids);
    return ids.length;
  }

  function cloudRevisionMatches(remote, status = Arcade.appStatus()){
    const lastKnownRaw = localStorage.getItem('arcadeLastCloudSave');
    const lastKnown = lastKnownRaw ? new Date(lastKnownRaw).getTime() : 0;
    const remoteTime = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;
    const differentDevice = !!(remote?.device_id && remote.device_id !== status.deviceId);
    return !(remote && differentDevice && (!lastKnown || remoteTime > lastKnown + 1000));
  }

  function markCloudConflict(remote, status = Arcade.appStatus()){
    const conflict = {
      reason:'newer-cloud-save',
      remoteUpdatedAt:remote?.updated_at || null,
      remoteDeviceId:remote?.device_id || null,
      localDeviceId:status.deviceId,
      detectedAt:new Date().toISOString()
    };
    localStorage.setItem('arcadeCloudConflict', JSON.stringify(conflict));
    window.dispatchEvent(new CustomEvent('earnly-cloud-conflict', { detail:conflict }));
    return conflict;
  }

  async function saveProgress(options = {}){
    const current = await user();
    if (!current) throw new Error('Sign in before saving to Earnly Cloud.');

    if (!options.skipRewardSync) {
      await syncServerRewards();
    }

    const snapshot = options.snapshot || Arcade.snapshotData();
    const signature = snapshotSignature(snapshot);
    const status = Arcade.appStatus();

    // Manual saves can still arrive from a stale browser tab/device. Before
    // writing, compare the current cloud revision with the revision this
    // device last saw. Automatic saves already perform this check earlier.
    if (!options.skipConflictCheck) {
      const remote = await cloudSaveInfo();
      if (!cloudRevisionMatches(remote, status)) {
        markCloudConflict(remote, status);
        const error = new Error('A newer cloud save exists on another device. Restore it before replacing cloud progress.');
        error.code = 'EARNLY_CLOUD_CONFLICT';
        throw error;
      }
    }
    const displayName = (localStorage.getItem('arcadeProfileName') || 'Player').trim().slice(0,32) || 'Player';
    const source = options.source || 'manual';

    if (options.skipIfUnchanged && localStorage.getItem('arcadeLastCloudHash') === signature) {
      const clearedEvents = clearSnapshotSyncedEvents();
      localStorage.removeItem('arcadeCloudSyncError');
      return {
        skipped:'unchanged',
        snapshot,
        source,
        signature,
        clearedEvents,
        pending:Arcade.syncStatus().pending
      };
    }

    const profilePayload = {
      user_id:current.id,
      display_name:displayName
    };
    const savedAvatar = localStorage.getItem('arcadeProfileIcon');
    const savedUsername = (localStorage.getItem('arcadeUsername') || '').trim();
    if (savedAvatar && Arcade.profileAvatars?.[savedAvatar]) profilePayload.avatar_key = savedAvatar;
    if (/^[A-Za-z0-9_]{3,18}$/.test(savedUsername)) profilePayload.username = savedUsername;

    const { error:profileError } = await requireClient()
      .from('profiles')
      .upsert(profilePayload, { onConflict:'user_id' });
    if (profileError) throw profileError;

    const { data, error } = await requireClient()
      .from('player_saves')
      .upsert({
        user_id:current.id,
        payload:snapshot,
        app_version:status.version,
        device_id:status.deviceId
      }, { onConflict:'user_id' })
      .select('updated_at,app_version,device_id')
      .single();

    if (error) throw error;

    const savedAt = data.updated_at || new Date().toISOString();
    localStorage.setItem('arcadeLastCloudSave', savedAt);
    localStorage.setItem('arcadeLastCloudHash', signature);
    localStorage.removeItem('arcadeCloudConflict');
    localStorage.removeItem('arcadeCloudSyncError');
    const clearedEvents = clearSnapshotSyncedEvents();
    window.dispatchEvent(new CustomEvent('earnly-cloud-synced', {
      detail:{
        source,
        updatedAt:savedAt,
        deviceId:data.device_id || status.deviceId,
        clearedEvents,
        pending:Arcade.syncStatus().pending
      }
    }));
    return { snapshot, save:data, source, signature, clearedEvents };
  }

  function autoSyncEnabled(){
    return localStorage.getItem('arcadeCloudAutoSync') !== 'off';
  }

  function setAutoSyncEnabled(enabled){
    localStorage.setItem('arcadeCloudAutoSync', enabled ? 'on' : 'off');
    window.dispatchEvent(new CustomEvent('earnly-cloud-auto-change', {
      detail:{ enabled:!!enabled }
    }));
    if (enabled) scheduleAutoSync('auto-enabled', 250);
    return autoSyncEnabled();
  }

  function cloudConflict(){
    try {
      const value = JSON.parse(localStorage.getItem('arcadeCloudConflict') || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  let syncTimer = null;
  let syncRunning = false;
  let syncAgain = false;
  let retryAttempt = 0;
  const MAX_RETRY_DELAY = 60000;

  function scheduleAutoSync(reason = 'change', delay = 1400){
    if (!autoSyncEnabled()) return false;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      autoSaveProgress(reason).catch(() => {});
    }, Math.max(0, Number(delay) || 0));
    return true;
  }

  function scheduleRetry(reason = 'retry'){
    if (!autoSyncEnabled() || !navigator.onLine || cloudConflict()) return false;
    retryAttempt += 1;
    const delay = Math.min(MAX_RETRY_DELAY, 1500 * Math.pow(2, Math.min(retryAttempt - 1, 5)));
    return scheduleAutoSync(reason, delay);
  }

  async function autoSaveProgress(reason = 'change'){
    if (!autoSyncEnabled()) return { skipped:'disabled' };
    if (!navigator.onLine) {
      localStorage.setItem('arcadeCloudOfflinePending', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('earnly-cloud-offline-pending', { detail:{ reason } }));
      return { skipped:'offline' };
    }

    if (syncRunning) {
      syncAgain = true;
      return { skipped:'busy' };
    }

    syncRunning = true;
    window.dispatchEvent(new CustomEvent('earnly-cloud-syncing', { detail:{ reason } }));
    try {
      const current = await user();
      if (!current) return { skipped:'signed-out' };

      const rewardSync = await syncServerRewards();
      const remote = await cloudSaveInfo();
      const localDevice = Arcade.deviceId();
      if (!cloudRevisionMatches(remote, { deviceId:localDevice })) {
        const conflict = markCloudConflict(remote, { deviceId:localDevice });
        return { skipped:'newer-cloud-save', conflict };
      }

      // Re-check immediately before the write. Another device may have
      // saved after our first cloud read while reward reconciliation was running.
      const latestRemote = await cloudSaveInfo();
      if (!cloudRevisionMatches(latestRemote, { deviceId:localDevice })) {
        const conflict = markCloudConflict(latestRemote, { deviceId:localDevice });
        return { skipped:'newer-cloud-save-before-write', conflict };
      }

      const result = await saveProgress({
        source:'auto:' + reason,
        skipRewardSync:true,
        skipIfUnchanged:true,
        skipConflictCheck:true
      });
      result.rewardSync = rewardSync;
      retryAttempt = 0;
      const recoveredOffline = !!localStorage.getItem('arcadeCloudOfflinePending');
      localStorage.removeItem('arcadeCloudOfflinePending');
      if (recoveredOffline) {
        window.dispatchEvent(new CustomEvent('earnly-cloud-recovered', {
          detail:{ reason, updatedAt:result?.save?.updated_at || localStorage.getItem('arcadeLastCloudSave') || null }
        }));
      }
      return result;
    } catch (error) {
      localStorage.setItem('arcadeCloudSyncError', String(error?.message || error));
      window.dispatchEvent(new CustomEvent('earnly-cloud-sync-error', {
        detail:{ reason, message:String(error?.message || error) }
      }));
      scheduleRetry('retry:' + reason);
      throw error;
    } finally {
      syncRunning = false;
      if (syncAgain) {
        syncAgain = false;
        scheduleAutoSync('queued-change', 500);
      }
    }
  }

  async function restoreProgress(){
    const current = await user();
    if (!current) throw new Error('Sign in before restoring from Earnly Cloud.');

    const { data, error } = await requireClient()
      .from('player_saves')
      .select('payload,updated_at,app_version,device_id')
      .eq('user_id', current.id)
      .maybeSingle();

    if (error) throw error;
    if (!data?.payload) throw new Error('No cloud save exists for this account yet.');

    const result = Arcade.restoreSnapshot(data.payload);
    Arcade.repairLifetimeCounters?.();
    Arcade.repairGameStats?.();
    localStorage.setItem('arcadeLastCloudRestore', new Date().toISOString());
    if (data.updated_at) localStorage.setItem('arcadeLastCloudSave', data.updated_at);
    localStorage.setItem('arcadeLastCloudHash', snapshotSignature(data.payload));
    localStorage.removeItem('arcadeCloudConflict');
    localStorage.removeItem('arcadeCloudSyncError');
    clearSnapshotSyncedEvents();
    // Pull server-authoritative reward events immediately after a restore so
    // another device cannot briefly show stale Coins before startup sync runs.
    try { await syncServerRewards(); } catch {}
    window.dispatchEvent(new CustomEvent('earnly-cloud-restored', {
      detail:{ restored:result.restored, updatedAt:data.updated_at || null }
    }));

    return { restored:result.restored, save:data };
  }

  async function profile(){
    const current = await user();
    if (!current) return null;

    const { data, error } = await requireClient()
      .from('profiles')
      .select('display_name,username,avatar_key,updated_at')
      .eq('user_id', current.id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }


  async function updatePublicProfile({ displayName, username, avatarKey } = {}){
    const current = await user();
    if (!current) throw new Error('Sign in to create a global player profile.');

    const cleanDisplay = String(displayName || Arcade.profileName() || 'Player').trim().slice(0,32) || 'Player';
    const cleanUsername = String(username || '').trim();
    const cleanAvatar = Arcade.profileAvatars?.[avatarKey] ? avatarKey : Arcade.profileIconKey();

    if (!/^[A-Za-z0-9_]{3,18}$/.test(cleanUsername)) {
      throw new Error('Username must be 3–18 letters, numbers, or underscores.');
    }

    const { data, error } = await requireClient()
      .from('profiles')
      .upsert({
        user_id:current.id,
        display_name:cleanDisplay,
        username:cleanUsername,
        avatar_key:cleanAvatar,
        updated_at:new Date().toISOString()
      }, { onConflict:'user_id' })
      .select('display_name,username,avatar_key,updated_at')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('That username is already taken.');
      if (error.code === '23514') throw new Error('That username is not allowed. Try another.');
      throw error;
    }

    localStorage.setItem('arcadeProfileName', data.display_name || cleanDisplay);
    localStorage.setItem('arcadeUsername', data.username || cleanUsername);
    localStorage.setItem('arcadeProfileIcon', data.avatar_key || cleanAvatar);
    window.dispatchEvent(new CustomEvent('earnly-public-profile-updated', { detail:data }));
    scheduleAutoSync('public-profile', 250);
    return data;
  }

  async function leaderboard(game, limit = 25){
    const { data, error } = await requireClient().functions.invoke('leaderboard', {
      body:{ action:'list', game:String(game || ''), limit:Math.max(1, Math.min(50, Number(limit) || 25)) }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function submitLeaderboardScore(game, score){
    const currentSession = await session();
    if (!currentSession?.user) return { skipped:'signed-out' };

    let username = Arcade.leaderboardUsername?.() || '';
    if (!username) {
      const remoteProfile = await profile();
      if (remoteProfile?.username) {
        username = remoteProfile.username;
        localStorage.setItem('arcadeUsername', remoteProfile.username);
        if (remoteProfile.avatar_key) localStorage.setItem('arcadeProfileIcon', remoteProfile.avatar_key);
      }
    }
    if (!username) return { skipped:'username-required' };

    const { data, error } = await requireClient().functions.invoke('leaderboard', {
      headers:{ Authorization:'Bearer ' + currentSession.access_token },
      body:{ action:'submit', game:String(game || ''), score:Math.floor(Number(score) || 0) }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    window.dispatchEvent(new CustomEvent('earnly-leaderboard-updated', { detail:data }));
    return data;
  }

  async function reportLeaderboardPlayer(username, game){
    const currentSession = await session();
    if (!currentSession?.user) throw new Error('Sign in to report a player.');

    const { data, error } = await requireClient().functions.invoke('leaderboard-report', {
      headers:{ Authorization:'Bearer ' + currentSession.access_token },
      body:{ username:String(username || '').trim(), game:String(game || '').trim() }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  if (client) {
    client.auth.onAuthStateChange((event, currentSession) => {
      window.dispatchEvent(new CustomEvent('earnly-cloud-auth-change', {
        detail:{ event, session:currentSession }
      }));
      if (event === 'PASSWORD_RECOVERY') {
        window.dispatchEvent(new CustomEvent('earnly-cloud-password-recovery', {
          detail:{ session:currentSession }
        }));
      }

      if (currentSession?.user && event !== 'SIGNED_OUT') {
        if (accountTransition) return;
        maybeRestoreFreshDevice()
          .then(result => {
            if (result?.auto) {
              const onAccountPage = /\/account\.html$/.test(location.pathname);
              if (!onAccountPage) setTimeout(() => location.reload(), 300);
              return;
            }
            scheduleAutoSync('auth-' + String(event || 'change').toLowerCase(), 900);
          })
          .catch(() => {
            scheduleAutoSync('auth-' + String(event || 'change').toLowerCase(), 900);
          });
      }
    });

    window.addEventListener('earnly-data-change', event => {
      if (!navigator.onLine) {
        localStorage.setItem('arcadeCloudOfflinePending', new Date().toISOString());
      }
      scheduleAutoSync(event.detail?.type || 'data-change', 650);
      if (GROWTH_EVENT_TYPES.has(String(event.detail?.type || ''))) {
        syncGrowthEvents().catch(() => {});
      }

      if (event.detail?.type === 'game_result' && event.detail?.payload?.newBest) {
        const payload = event.detail.payload;
        submitLeaderboardScore(payload.game, payload.best)
          .then(result => {
            if (result?.saved && result.rank && result.rank <= 25) {
              Arcade.toast('🌎 World rank #' + result.rank + ' in ' + (Arcade.names[payload.game] || 'this game') + '!');
            }
          })
          .catch(() => {});
      }
    });
    window.addEventListener('online', () => {
      retryAttempt = 0;
      scheduleAutoSync('online', 300);
      syncGrowthEvents().catch(() => {});
    });
    window.addEventListener('pageshow', () => {
      scheduleAutoSync('pageshow', 850);
      syncGrowthEvents().catch(() => {});
    });
    window.addEventListener('focus', () => {
      scheduleAutoSync('focus', 1000);
      syncGrowthEvents().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        scheduleAutoSync('foreground', 650);
      } else if (autoSyncEnabled()) {
        autoSaveProgress('background').catch(() => {});
      }
    });

    setTimeout(() => {
      scheduleAutoSync('cloud-ready', 200);
      syncGrowthEvents().catch(() => {});
    }, 0);
    window.dispatchEvent(new CustomEvent('earnly-cloud-ready'));
  }

  window.EarnlyCloud = {
    ready:!!client,
    client,
    session,
    user,
    profile,
    updatePublicProfile,
    leaderboard,
    submitLeaderboardScore,
    reportLeaderboardPlayer,
    signUp,
    signIn,
    signInAndRestore,
    sendPasswordReset,
    updatePassword,
    signOut,
    deleteAccount,
    cloudSaveInfo,
    walletInfo,
    syncServerRewards,
    syncGrowthEvents,
    growthSyncEnabled,
    maybeRestoreFreshDevice,
    saveProgress,
    autoSaveProgress,
    scheduleAutoSync,
    autoSyncEnabled,
    setAutoSyncEnabled,
    cloudConflict,
    restoreProgress
  };
})();
