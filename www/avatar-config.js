// Reuse Earnly's signed-in Supabase client and hosted cosmetics backend.
window.EARNLY_AVATAR_API = 'https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars';
window.createEarnlyAuth = () => {
  if (!window.EarnlyCloud?.client) throw new Error('Account connection is loading. Refresh to try again.');
  return window.EarnlyCloud.client;
};
