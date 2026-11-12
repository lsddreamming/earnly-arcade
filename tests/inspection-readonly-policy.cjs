const {test} = require('node:test');
const assert = require('node:assert/strict');
const {allowInspectionRequest} = require('../scripts/inspection-readonly-policy.cjs');
const origin = 'https://earnlyarcade.com';
const req = (url, method='GET') => ({url: () => url, method: () => method});
for (const path of ['/', '/index.html#dailyMissionsSection', '/www/index.html', '/games-showroom.css?v=2', '/nav-icons.svg', '/game-preview.webp', '/world-engine.js', '/fonts/display.woff2']) {
  test('permits static same-origin GET ' + path, () => assert.equal(allowInspectionRequest(req(origin + path),origin),true));
}
for (const [url, method] of [
  ['https://tracker.metricool.com/resources/be.js','GET'],
  ['https://earnlyarcade.com/api/players.json','GET'],
  ['https://earnlyarcade.com/functions/v1/run','GET'],
  ['https://earnlyarcade.com/telemetry','GET'],
  ['https://earnlyarcade.com/collect/report.png','GET'],
  ['https://earnlyarcade.com/increment-score','GET'],
  ['https://earnlyarcade.com/index.html','POST'],
  ['https://earnlyarcade.com/index.html','OPTIONS'],
  ['data:text/plain,hello','GET'],
]) {
  test(`blocks ${method} ${url}`, () => assert.equal(allowInspectionRequest(req(url,method),origin),false));
}
