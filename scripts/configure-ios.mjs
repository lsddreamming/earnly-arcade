import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const plistPath = path.join(process.cwd(), 'ios', 'App', 'App', 'Info.plist');
const testMode = process.env.EARNLY_ADMOB_TEST_MODE !== '0';
const appId = testMode
  ? 'ca-app-pub-3940256099942544~1458002511'
  : 'ca-app-pub-8864401806510610~7658950353';

let plist = await readFile(plistPath, 'utf8');

const keys = [
  '<key>GADApplicationIdentifier</key>',
  '<key>NSUserTrackingUsageDescription</key>',
  '<key>SKAdNetworkItems</key>'
];

if (!keys.some(key => plist.includes(key))) {
  const block = [
    '  <key>GADApplicationIdentifier</key>',
    '  <string>' + appId + '</string>',
    '  <key>NSUserTrackingUsageDescription</key>',
    '  <string>Earnly uses device information to deliver and measure optional rewarded ads.</string>',
    '  <key>SKAdNetworkItems</key>',
    '  <array>',
    '    <dict>',
    '      <key>SKAdNetworkIdentifier</key>',
    '      <string>cstr6suwn9.skadnetwork</string>',
    '    </dict>',
    '  </array>'
  ].join('\n');

  plist = plist.replace(/\n<\/dict>\s*<\/plist>\s*$/, '\n' + block + '\n</dict>\n</plist>\n');
} else {
  plist = plist.replace(
    /(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/,
    '$1' + appId + '$2'
  );
}

await writeFile(plistPath, plist);
console.log('Configured iOS AdMob app ID in ' + (testMode ? 'TEST' : 'LIVE') + ' mode');
