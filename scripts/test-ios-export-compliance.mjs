import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const configure = fileURLToPath(new URL('./configure-ios.mjs', import.meta.url));
function fixture(t, declaration = '') {
  const root = mkdtempSync(path.join(tmpdir(), 'earnly-export-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = {
    'ios/App/App/Info.plist': `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Earnly fixture</string>
<key>NestedSettings</key><dict><key>keep</key><true/></dict>
${declaration}
</dict></plist>`,
    'ios/App/App.xcodeproj/project.pbxproj': 'MARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\n',
    'ios/App/App/AppDelegate.swift': 'import UIKit\n',
    'ios/App/App/SceneDelegate.swift': 'let bridge = CAPBridgeViewController()\n',
    'native/ArcadePurchases.swift': '// Fixture StoreKit bridge\n',
    'ios-icon-1024.png': 'fixture icon bytes'
  };
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), content);
  }
  mkdirSync(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset'), { recursive: true });
  return {
    plist: path.join(root, 'ios/App/App/Info.plist'),
    run: () => spawnSync(process.execPath, [configure], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, EARNLY_IOS_MARKETING_VERSION: '1.7', EARNLY_IOS_BUILD_NUMBER: '700', EARNLY_ADMOB_TEST_MODE: '1' }
    })
  };
}

test('regenerated iOS project carries one top-level exempt declaration after repeated configuration', t => {
  const f = fixture(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = f.run();
    assert.equal(run.status, 0, run.stderr);
    const parsed = spawnSync('python3', ['-c', 'import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1], "rb"))))', f.plist], { encoding: 'utf8' });
    assert.equal(parsed.status, 0, parsed.stderr);
    const plist = JSON.parse(parsed.stdout);
    assert.equal(plist.ITSAppUsesNonExemptEncryption, false);
    assert.deepEqual(plist.NestedSettings, { keep: true });
    assert.equal(plist.CFBundleDisplayName, 'Earnly fixture');
    assert.ok(plist.NSUserTrackingUsageDescription);
    assert.ok(plist.SKAdNetworkItems.length >= 50);
    assert.equal(readFileSync(f.plist, 'utf8').match(/<key>ITSAppUsesNonExemptEncryption<\/key>/g).length, 1);
  }
});

for (const value of ['<true/>', '<string>false</string>']) {
  test('configuration refuses to overwrite a changed encryption declaration: ' + value, t => {
    const f = fixture(t, '<key>ITSAppUsesNonExemptEncryption</key>' + value);
    const before = readFileSync(f.plist, 'utf8');
    const run = f.run();
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Review the changed iOS encryption declaration/);
    assert.equal(readFileSync(f.plist, 'utf8'), before);
  });
}
