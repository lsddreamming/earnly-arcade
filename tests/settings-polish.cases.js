const { test, expect } = require('@playwright/test');

// Isolate auth and remote services; never modify real profiles, play limits or scores.
async function openSettings(page) {
  await page.route('https://**', route => route.abort());
  await page.route('**/cloud.js', route => route.fulfill({
    status:200, contentType:'application/javascript', body:'/* isolated settings QA */'
  }));
  await page.addInitScript(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
  await page.goto('/settings.html');
  await expect(page.locator('.settings-menu')).toBeVisible();
}

async function grantOwnerFixture(page) {
  await page.evaluate(async () => {
    window.EarnlyCloud = {
      ready:true,
      refreshTesterAccess:async () => ({ isTester:true }),
      session:async () => ({ user:{ id:'settings-owner-fixture' } })
    };
    await refreshOwnerToolsVisibility();
  });
}

test('Settings owner controls start collapsed and remain separate from player help', async ({ page }) => {
  await openSettings(page);
  await grantOwnerFixture(page);
  const tools = page.locator('#ownerToolsCard');
  await expect(tools).toBeVisible();
  expect(await tools.evaluate(node => node.open)).toBe(false);
  await expect(page.locator('#resetTestPlaysButton')).toBeHidden();
  await expect(page.locator('#copyTestReportButton')).toBeHidden();
  expect(await page.evaluate(() => {
    const tools = document.getElementById('ownerToolsCard');
    const help = document.querySelector('.settings-help-card');
    return !!(help.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await tools.locator('summary').click();
  await expect(page.locator('#resetTestPlaysButton')).toBeVisible();
});

test('Settings hides and closes owner controls immediately during an account recheck', async ({ page }) => {
  await openSettings(page);
  await grantOwnerFixture(page);
  await page.locator('#ownerToolsCard summary').click();
  await page.evaluate(() => {
    EarnlyCloud.refreshTesterAccess = () => new Promise(resolve => { window.__finishOwnerCheck = resolve; });
    window.dispatchEvent(new Event('earnly-cloud-auth-change'));
  });
  await expect(page.locator('#ownerToolsCard')).toBeHidden();
  expect(await page.locator('#ownerToolsCard').evaluate(node => node.open)).toBe(false);
  await page.evaluate(() => window.__finishOwnerCheck({ isTester:false }));
  await expect(page.locator('#ownerToolsCard')).toBeHidden();
  await grantOwnerFixture(page);
  expect(await page.locator('#ownerToolsCard').evaluate(node => node.open)).toBe(false);
});

test('Settings ignores a stale owner response after switching to a regular account', async ({ page }) => {
  await openSettings(page);
  const state = await page.evaluate(async () => {
    let resolveOld;
    window.EarnlyCloud = {
      ready:true,
      session:async () => ({ user:{ id:'regular-settings-fixture' } }),
      refreshTesterAccess:() => new Promise(resolve => { resolveOld = resolve; })
    };
    const oldRequest = refreshOwnerToolsVisibility();
    EarnlyCloud.refreshTesterAccess = async () => ({ isTester:false });
    await refreshOwnerToolsVisibility();
    resolveOld({ isTester:true });
    await oldRequest;
    return { hidden:document.getElementById('ownerToolsCard').hidden, open:document.getElementById('ownerToolsCard').open };
  });
  expect(state).toEqual({ hidden:true, open:false });
  await expect(page.locator('#resetTestPlaysButton')).toBeHidden();
});

test('Settings denied and failed owner checks cannot invoke private actions', async ({ page }) => {
  await openSettings(page);
  for (const failure of [false, true]) {
    const state = await page.evaluate(async failure => {
      let resets = 0, copies = 0;
      Arcade.resetPrototypePlays = () => { resets += 1; };
      Object.defineProperty(navigator, 'clipboard', {
        configurable:true, value:{ writeText:async () => { copies += 1; } }
      });
      window.EarnlyCloud = {
        ready:true,
        session:async () => null,
        refreshTesterAccess:async () => {
          if (failure) throw new Error('Simulated unavailable entitlement service');
          return { isTester:false };
        }
      };
      await refreshOwnerToolsVisibility();
      document.getElementById('resetTestPlaysButton').click();
      await copyOwnerDiagnostics();
      return { resets, copies, hidden:document.getElementById('ownerToolsCard').hidden };
    }, failure);
    expect(state).toEqual({ resets:0, copies:0, hidden:true });
  }
});

test('Settings toggles have distinct accessible names and preserve saved preferences', async ({ page }) => {
  await openSettings(page);
  const saved = {};
  for (const name of ['Game sounds', 'Haptics', 'Motion and animations']) {
    const toggle = page.getByRole('button', { name, exact:true });
    const before = await toggle.getAttribute('aria-pressed');
    saved[name] = before === 'true' ? 'false' : 'true';
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', saved[name]);
  }
  await page.reload();
  for (const [name, value] of Object.entries(saved)) {
    await expect(page.getByRole('button', { name, exact:true })).toHaveAttribute('aria-pressed', value);
  }
});

test('Settings compact help menu opens the walkthrough and preserves support and account paths', async ({ page }) => {
  await openSettings(page);
  await page.locator('#walkthroughButton').click();
  await expect(page.locator('dialog.onboarding-dialog')).toBeVisible();
  await page.reload();
  await page.locator('.settings-menu-row[href="support.html"]').click();
  await expect(page).toHaveURL(/\/support\.html$/);
  await page.goto('/settings.html');
  await page.locator('.settings-menu-row[href="account.html"]').click();
  await expect(page).toHaveURL(/\/account\.html$/);
});

for (const width of [320, 390, 440]) {
  test(`Settings polished layout at ${width}px keeps four text sizes readable and touch-friendly`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height:844 });
    await openSettings(page);
    for (const scale of ['compact', 'comfortable', 'large', 'xlarge']) {
      await page.locator(`#textSizeOptions button[data-text-scale="${scale}"]`).click();
      await expect(page.locator(`#textSizeOptions button[data-text-scale="${scale}"]`)).toHaveAttribute('aria-pressed','true');
      const layout = await page.evaluate(() => ({
        width:innerWidth,
        scrollWidth:document.documentElement.scrollWidth,
        rows:[...document.querySelectorAll('.settings-menu-row')].map(node => {
          const rect = node.getBoundingClientRect();
          return { width:rect.width, height:rect.height, left:rect.left, right:rect.right };
        }),
        copySizes:[...document.querySelectorAll('.settings-menu-copy small')].map(node => parseFloat(getComputedStyle(node).fontSize))
      }));
      expect(layout.scrollWidth, scale + ' horizontal overflow').toBeLessThanOrEqual(layout.width + 1);
      expect(layout.rows).toHaveLength(3);
      for (const row of layout.rows) {
        expect(row.height).toBeGreaterThanOrEqual(44);
        expect(row.width).toBeGreaterThanOrEqual(44);
        expect(row.left).toBeGreaterThanOrEqual(0);
        expect(row.right).toBeLessThanOrEqual(layout.width + 1);
      }
      for (const size of layout.copySizes) expect(size).toBeGreaterThanOrEqual(12);
      await expect(page.locator('#ownerToolsCard')).toBeHidden();
      await expect(page.locator('#queueStatus')).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveAttribute('aria-pressed', /.+/);
    }
    await page.locator('.settings-menu-row[href="account.html"]').scrollIntoViewIfNeeded();
    await expect(page.locator('.settings-menu-row[href="account.html"]')).toBeInViewport();
    expect(errors).toEqual([]);
  });
}

test('Settings player layout and private gating are identical in the iOS web bundle', async ({ request }) => {
  const web = await request.get('/settings.html');
  const native = await request.get('/www/settings.html');
  expect(web.ok()).toBe(true);
  expect(native.ok()).toBe(true);
  expect(await native.text()).toBe(await web.text());
});
