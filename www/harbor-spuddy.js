(() => {
  'use strict';
  const status = document.getElementById('spuddy-status');
  const refresh = document.getElementById('spuddy-refresh');
  const api = 'https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars';
  let generation = 0;
  let sprite = null;
  const starter = { avatar: { id: 'russet-potato', name: 'Classic Spuddy', slot: 'avatar', imageUrl: 'cosmetic-russet-potato.svg' } };
  async function compose(equipped) {
    const layers = window.EarnlyPotatoRig.compose(equipped).filter(item => !['frame','pose','effect','army','commander','building','battlefx','pet'].includes(item.slot));
    const images = await Promise.all(layers.map(item => new Promise((resolve, reject) => {
      const url = new URL(item.imageUrl, location.href);
      if (url.origin !== location.origin || !/^\/cosmetic-[a-z0-9-]+\.svg$/.test(url.pathname)) return reject(new Error('Unsupported Spuddy artwork.'));
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Spuddy artwork could not load.'));
      img.src = url.href;
    })));
    const surface = document.createElement('canvas'); surface.width = 300; surface.height = 400;
    const ctx = surface.getContext('2d');
    for (const image of images) ctx.drawImage(image, 0, 0, 300, 400);
    return surface;
  }
  async function sync() {
    const request = ++generation;
    refresh.disabled = true;
    status.textContent = 'Loading Spuddy…';
    // Clear the previous account's art before awaiting auth or network work.
    sprite = null;
    try {
      const fallback = await compose(starter);
      if (request !== generation) return;
      sprite = fallback;
      const client = window.EarnlyCloud?.client;
      if (!client) {
        status.textContent = 'Classic Spuddy · preview. Your equipped look connects on Earnly Arcade.';
        return;
      }
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (request !== generation) return;
      if (!data.session) { status.textContent = 'Classic Spuddy · sign in to Earnly Arcade to use your equipped look.'; return; }
      const response = await fetch(api + '/api/me', { headers: { Authorization: 'Bearer ' + data.session.access_token }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Account look unavailable');
      const result = await response.json();
      if (!result.user?.equipped?.avatar) throw new Error('Choose a Spuddy in the avatar studio first.');
      const next = await compose(result.user.equipped);
      if (request !== generation) return;
      sprite = next;
      status.textContent = 'Your equipped Spuddy · ready to roam';
    } catch {
      if (request === generation) status.textContent = 'Could not load your equipped look. Tap Refresh Spuddy to retry.';
    } finally {
      if (request === generation) refresh.disabled = false;
    }
  }
  window.HarborSpuddy = { get sprite() { return sprite; } };
  refresh.addEventListener('click', sync);
  window.EarnlyCloud?.client?.auth.onAuthStateChange(() => { setTimeout(sync, 0); });
  sync();
})();
