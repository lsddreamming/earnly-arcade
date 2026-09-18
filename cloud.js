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
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
    return true;
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

  async function maybeRestoreFreshDevice(){
    const current = await user();
    if (!current) return { skipped:'signed-out' };
    if (Arcade.hasMeaningfulProgress()) return { skipped:'local-progress' };
    if (localStorage.getItem('arcadeFreshDeviceRestoreDone') === current.id) return { skipped:'already-checked' };

    const { data, error } = await requireClient()
      .from('player_saves')
      .select('payload,updated_at,app_version,device_id')
      .eq('user_id', current.id)
      .maybeSingle();

    if (error) throw error;

    localStorage.setItem('arcadeFreshDeviceRestoreDone', current.id);

    if (!data?.payload) return { skipped:'no-cloud-save' };

    const result = Arcade.restoreSnapshot(data.payload);
    Arcade.repairLifetimeCounters?.();
    if (data.updated_at) localStorage.setItem('arcadeLastCloudSave', data.updated_at);
    localStorage.setItem('arcadeLastCloudRestore', new Date().toISOString());
    localStorage.removeItem('arcadeCloudConflict');

    const detail = {
      restored:result.restored,
      updatedAt:data.updated_at || null,
      sourceDeviceId:data.device_id || null
    };
    window.dispatchEvent(new CustomEvent('earnly-cloud-auto-restored', { detail }));
    return { restored:result.restored, save:data, auto:true };
  }

  async function saveProgress(options = {}){
    const current = await user();
    if (!current) throw new Error('Sign in before saving to Earnly Cloud.');

    const snapshot = Arcade.snapshotData();
    const status = Arcade.appStatus();
    const displayName = (localStorage.getItem('arcadeProfileName') || 'Player').trim().slice(0,32) || 'Player';
    const source = options.source || 'manual';

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
    localStorage.removeItem('arcadeCloudConflict');
    window.dispatchEvent(new CustomEvent('earnly-cloud-synced', {
      detail:{ source, updatedAt:savedAt, deviceId:data.device_id || status.deviceId }
    }));
    return { snapshot, save:data, source };
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

      return await saveProgress({ source:'auto:' + reason });
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
    localStorage.setItem('arcadeLastCloudRestore', new Date().toISOString());
    if (data.updated_at) localStorage.setItem('arcadeLastCloudSave', data.updated_at);
    localStorage.removeItem('arcadeCloudConflict');
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
        maybeRestoreFreshDevice()
          .then(result => {
            if (result?.auto) {
              setTimeout(() => location.reload(), 350);
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
      scheduleAutoSync(event.detail?.type || 'data-change', 1400);
    });
    window.addEventListener('online', () => scheduleAutoSync('online', 300));
    window.addEventListener('pageshow', () => scheduleAutoSync('pageshow', 850));
    window.addEventListener('focus', () => scheduleAutoSync('focus', 1000));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleAutoSync('foreground', 650);
    });

    setTimeout(() => scheduleAutoSync('cloud-ready', 900), 0);
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
    sendPasswordReset,
    updatePassword,
    signOut,
    cloudSaveInfo,
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