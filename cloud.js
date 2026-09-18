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
    const result = await requireClient().auth.signUp({
      email:String(email || '').trim(),
      password:String(password || '')
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

  async function saveProgress(){
    const current = await user();
    if (!current) throw new Error('Sign in before saving to Earnly Cloud.');

    const snapshot = Arcade.snapshotData();
    const status = Arcade.appStatus();
    const displayName = (localStorage.getItem('arcadeProfileName') || 'Player').trim().slice(0,32) || 'Player';

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

    localStorage.setItem('arcadeLastCloudSave', data.updated_at || new Date().toISOString());
    return { snapshot, save:data };
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
    });
  }

  window.EarnlyCloud = {
    ready:!!client,
    client,
    session,
    user,
    profile,
    signUp,
    signIn,
    signOut,
    cloudSaveInfo,
    saveProgress,
    restoreProgress
  };
})();