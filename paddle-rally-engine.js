(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaddleRally = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const width = 360, height = 500, baseSpeed = 360, maxSpeed = 780;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  // A gentle opening and a finite ceiling; width changes gradually, never mid-flight.
  const speedFor = score => baseSpeed + (maxSpeed - baseSpeed) * (1 - Math.exp(-Math.max(0, score) / 28));
  const widthFor = score => 96 - Math.min(20, Math.max(0, score) * .4);
  function placePaddle(paddle, center) { paddle.x = clamp(center - paddle.w / 2, 0, width - paddle.w); }
  function step(ball, paddle, seconds, score) {
    let remaining = clamp(seconds, 0, .05);
    const events = [];
    // Resolve the earliest contact, then use the remainder of the frame. This
    // handles a side-wall bounce followed by a paddle return in the same frame.
    for (let n = 0; remaining > .000001 && n < 8; n++) {
      let time = remaining, kind = null;
      const consider = (t, type) => {
        if (t >= -.000001 && t <= time) { time = Math.max(0, t); kind = type; }
      };
      if (ball.dx < 0) consider((ball.r - ball.x) / ball.dx, 'left');
      if (ball.dx > 0) consider((width - ball.r - ball.x) / ball.dx, 'right');
      if (ball.dy < 0) consider((ball.r - ball.y) / ball.dy, 'top');
      if (ball.dy > 0) {
        const t = (paddle.y - ball.r - ball.y) / ball.dy;
        const contactX = ball.x + ball.dx * t;
        if (contactX + ball.r >= paddle.x && contactX - ball.r <= paddle.x + paddle.w) consider(t, 'paddle');
        consider((height + ball.r - ball.y) / ball.dy, 'miss');
      }
      ball.x += ball.dx * time;
      ball.y += ball.dy * time;
      remaining -= time;
      if (!kind) break;
      const event = {kind, x:ball.x, y:ball.y};
      if (kind === 'miss') { events.push(event); break; }
      if (kind === 'left' || kind === 'right') ball.dx *= -1;
      if (kind === 'top') ball.dy *= -1;
      if (kind === 'paddle') {
        const hit = clamp((ball.x - paddle.x - paddle.w / 2) / (paddle.w / 2), -1, 1);
        const speed = speedFor(++score);
        // Aim with the face of the paddle; a tiny minimum angle prevents an
        // unattended center paddle from rallying vertically forever.
        let horizontal = hit * .76;
        if (Math.abs(horizontal) < .16) horizontal = (Math.sign(horizontal) || Math.sign(ball.dx) || 1) * .16;
        ball.dx = speed * horizontal;
        ball.dy = -Math.sqrt(speed * speed - ball.dx * ball.dx);
        event.center = Math.abs(hit) <= .25;
        event.score = score;
        const center = paddle.x + paddle.w / 2;
        paddle.w = widthFor(score);
        placePaddle(paddle, center);
      }
      events.push(event);
    }
    return events;
  }
  return {width, height, baseSpeed, maxSpeed, speedFor, widthFor, placePaddle, step};
});
