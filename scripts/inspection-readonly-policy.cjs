// Inspection may load public, static same-origin assets only. GET alone is not a
// guarantee of a read-only request (analytics collection endpoints use GET).
const STATIC_ASSET = /\.(?:html|css|m?js|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|webmanifest|txt|wasm|mp3|mp4|webm|ogg)$/i;
const MUTATING_PATH = /\/(?:api|auth|rpc|functions|events|collect|telemetry)(?:\/|$)/i;
function allowInspectionRequest(request, origin) {
  if (!['GET', 'HEAD'].includes(request.method())) return false;
  let url;
  try { url = new URL(request.url()); } catch { return false; }
  return url.origin === origin && !MUTATING_PATH.test(url.pathname) &&
    (url.pathname === '/' || STATIC_ASSET.test(url.pathname));
}
module.exports = {allowInspectionRequest};
