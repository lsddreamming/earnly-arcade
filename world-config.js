// Public endpoint only. Never place credentials in this file.
// Opt-in hosted verification; the normal World tab remains a room preview.
// The query flag grants no permissions: the worker verifies every player session.
window.EarnlyWorldConfig = Object.freeze({
  endpoint: new URLSearchParams(window.location.search).get('multiplayer') === '1'
    ? 'wss://earnly-world.onrender.com/world' : '',
  beta: true
});
