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
      .filter(event => !(
        event?.type === 'coin_award' &&
        event?.payload?.server &&
        typeof event.payload.server === 'object'
      ))
      .map(event => event.id)
      .filter(Boolean);

    if (ids.length) Arcade.clearSyncEvents(ids);
    return ids.length;
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

    const { error:profileError } = await requireClient()
      .from('profiles')
      .upsert({
        user_id:current.id,
        display_name:displayName
      }, { onConflict:'user_id' });
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

  function scheduleAutoSync(reason = 'change', delay = 1400){
    if (!autoSyncEnabled()) return false;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      autoSaveProgress(reason).catch(() => {});
    }, Math.max(0, Number(delay) || 0));
    return true;
  }

  async function autoSaveProgress(reason = 'change'){
    if (!autoSyncEnabled()) return { skipped:'disabled' };
    if (!navigator.onLine) return { skipped:'offline' };

    if (syncRunning) {
      syncAgain = true;
      return { skipped:'busy' };
    }

    syncRunning = true;
    try {
      const current = await user();
      if (!current) return { skipped:'signed-out' };

      const rewardSync = await syncServerRewards();
      const remote = await cloudSaveInfo();
      const localDevice = Arcade.deviceId();
      const lastKnownRaw = localStorage.getItem('arcadeLastCloudSave');
      const lastKnown = lastKnownRaw ? new Date(lastKnownRaw).getTime() : 0;
      const remoteTime = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;
      const differentDevice = !!(remote?.device_id && remote.device_id !== localDevice);

      if (remote && differentDevice && (!lastKnown || remoteTime > lastKnown + 1000)) {
        const conflict = {
          reason:'newer-cloud-save',
          remoteUpdatedAt:remote.updated_at,
          remoteDeviceId:remote.device_id,
          localDeviceId:localDevice,
          detectedAt:new Date().toISOString()
        };
        localStorage.setItem('arcadeCloudConflict', JSON.stringify(conflict));
        window.dispatchEvent(new CustomEvent('earnly-cloud-conflict', { detail:conflict }));
        return { skipped:'newer-cloud-save', conflict };
      }

      const result = await saveProgress({
        source:'auto:' + reason,
        skipRewardSync:true,
        skipIfUnchanged:true
      });
      result.rewardSync = rewardSync;
      return result;
    } catch (error) {
      localStorage.setItem('arcadeCloudSyncError', String(error?.message || error));
      window.dispatchEvent(new CustomEvent('earnly-cloud-sync-error', {
        detail:{ reason, message:String(error?.message || error) }
      }));
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
      .select('display_name,updated_at')
      .eq('user_id', current.id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
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
      scheduleAutoSync(event.detail?.type || 'data-change', 650);
    });
    window.addEventListener('online', () => scheduleAutoSync('online', 300));
    window.addEventListener('pageshow', () => scheduleAutoSync('pageshow', 850));
    window.addEventListener('focus', () => scheduleAutoSync('focus', 1000));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        scheduleAutoSync('foreground', 650);
      } else if (autoSyncEnabled()) {
        autoSaveProgress('background').catch(() => {});
      }
    });

    setTimeout(() => scheduleAutoSync('cloud-ready', 200), 0);
    window.dispatchEvent(new CustomEvent('earnly-cloud-ready'));
  }

  window.EarnlyCloud = {
    ready:!!client,
    client,
    session,
    user,
    profile,
    signUp,
    signIn,
    signInAndRestore,
    sendPasswordReset,
    updatePassword,
    signOut,
    cloudSaveInfo,
    walletInfo,
    syncServerRewards,
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
