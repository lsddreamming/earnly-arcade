const {test,expect}=require('@playwright/test');
async function mock(page,{conflict=false}={}){
 await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:`window.authCalls=0;window.EarnlyCloud={ready:Promise.resolve(),session:async()=>${conflict?"({user:{email:'player@example.com'}})":"null"},autoSyncEnabled:()=>true,cloudConflict:()=>${conflict},cloudSaveInfo:async()=>({updated_at:new Date().toISOString()}),signInAndRestore:async()=>{window.authCalls++;await new Promise(r=>window.finishSignIn=r);throw new Error('Invalid login credentials');},signUp:async()=>{window.authCalls++;await new Promise(r=>setTimeout(r,300));return {};},sendPasswordReset:async()=>{window.authCalls++;}};`}));
}
test('account supports password visibility and Enter without duplicate requests',async({page})=>{
 await mock(page);await page.goto('/account.html');
 await page.locator('#cloudEmail').fill('player@example.com');await page.locator('#cloudPassword').fill('example-password');
 await page.getByRole('button',{name:'Show password'}).click();await expect(page.locator('#cloudPassword')).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Hide password'}).click();await expect(page.locator('#cloudPassword')).toHaveAttribute('type','password');
 await page.locator('#cloudPassword').press('Enter');await expect(page.locator('#cloudSignInButton')).toBeDisabled();await page.locator('#cloudPassword').press('Enter');await page.locator('#createMode').click();
 await expect(page.locator('#signInMode')).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>window.finishSignIn());await expect(page.locator('#cloudAuthFeedback')).toContainText('Invalid login credentials');expect(await page.evaluate(()=>window.authCalls)).toBe(1);
});
test('account creation leads to confirmation and returning sign-in',async({page})=>{
 await mock(page);await page.goto('/account.html#create-account');await expect(page.locator('#cloudCreateButton')).toBeVisible();
 await page.locator('#cloudEmail').fill('player@example.com');await page.locator('#cloudPassword').fill('example-password');await page.locator('#cloudPassword').press('Enter');
 await expect(page.locator('#cloudSignupNotice')).toContainText('Check your inbox');await expect(page.locator('#cloudSignInButton')).toBeVisible();await expect(page.locator('#cloudEmail')).toHaveAttribute('readonly','');
 await page.reload();await expect(page.locator('#cloudSignupNotice')).toBeVisible();await expect(page.locator('#cloudSignInButton')).toBeVisible();
 await page.locator('#cloudSignupDifferentEmail').click();await expect(page.locator('#cloudEmail')).not.toHaveAttribute('readonly','');
});
test('reset deep link opens form without sending and validates email',async({page})=>{
 await mock(page);await page.goto('/account.html#reset-password');await expect(page.locator('#cloudResetPanel')).toBeVisible();expect(await page.evaluate(()=>window.authCalls)).toBe(0);
 await page.locator('#cloudResetEmail').fill('bad-email');await page.locator('#cloudResetSendButton').click();await expect(page.locator('#cloudResetStatus')).toContainText('valid email');expect(await page.evaluate(()=>window.authCalls)).toBe(0);
 await page.locator('#cloudResetEmail').fill('player@example.com');await page.locator('#cloudResetSendButton').click();await expect(page.locator('#cloudResetStatus')).toContainText('Reset email sent');expect(await page.evaluate(()=>window.authCalls)).toBe(1);
});
test('conflicted saves have consistent status and fit narrow screens',async({page})=>{
 await mock(page,{conflict:true});await page.goto('/account.html');await expect(page.locator('#cloudMessage')).toContainText('two different saves');await expect(page.locator('#syncStatusDot')).not.toHaveClass(/ready/);
 await expect(page.locator('#cloudSaveButton')).toHaveText('Review saves');await expect(page.locator('#cloudRestoreButton')).toBeHidden();expect(await page.locator('#delete-account').evaluate(e=>!!e.closest('.cloud-account-card'))).toBe(false);await expect(page.locator('#cloudBadge')).toHaveText('Signed in');await expect(page.locator('#cloudLiveStatus')).toHaveText('Your progress is saved in this browser');await page.locator('.account-save-tools > summary').click();await expect(page.locator('#cloudAutoSyncToggle')).toHaveText('Paused');
 const message=await page.locator('#cloudMessage').boundingBox();const save=await page.locator('#cloudSaveButton').boundingBox();expect(message.y+message.height).toBeLessThan(save.y);
 await page.locator('.account-sync-details summary').click();await expect(page.locator('#pendingEvents')).toContainText('Sync paused');await expect(page.locator('#delete-account > summary')).toBeVisible();await page.locator('#delete-account > summary').click();await expect(page.locator('#cloudDeleteButton')).toBeVisible();
 for(const width of [320,390,440,1280]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).position)).toBe('static');}
 await page.setViewportSize({width:390,height:844});await page.locator('#delete-account > summary').click();await page.screenshot({path:'test-results/account-settings-conflict.png',fullPage:true});
});

test('password recovery keeps account feedback visible',async({page})=>{
 await mock(page);await page.goto('/account.html?recovery=1');
 await expect(page.locator('#cloudRecovery')).toBeVisible();
 await expect(page.locator('#cloudMessage')).toBeVisible();
 await expect(page.locator('#cloudMessage')).toContainText('expired or incomplete');
});

async function saveChoices(page, conflict){
 await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:`
 window.saved=0;window.loaded=0;window.deleted=0;
 let conflict=${conflict} ? {remoteUpdatedAt:'2026-11-02T12:00:00Z'} : null;
 window.EarnlyCloud={ready:true,session:async()=>({user:{email:'player@example.com'}}),autoSyncEnabled:()=>true,cloudConflict:()=>conflict,
 checkSaveConflict:async()=>conflict,cloudSaveInfo:async()=>({updated_at:'2026-11-02T12:00:00Z',device_id:'different-browser'}),
 saveProgress:async()=>{window.saved++;conflict=null;return {snapshot:{data:{}}}},restoreProgress:async()=>{window.loaded++;return {restored:2}},deleteAccount:async()=>{window.deleted++}};
 `}));
 await page.goto('/account.html');await expect(page.locator('#cloudBadge')).toHaveText('Signed in');
}
test('review saves never changes progress on opening or cancel; saving needs a clear confirmation',async({page})=>{
 await saveChoices(page,true);
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 await page.getByRole('button',{name:'Review saves',exact:true}).click();
 await expect(page.locator('dialog[open]')).toContainText('do not delete your account');
 await page.getByRole('button',{name:'Keep playing',exact:true}).click();
 expect(await page.evaluate(()=>[saved,loaded,deleted])).toEqual([0,0,0]);
 await page.getByRole('button',{name:'Review saves',exact:true}).click();
 await page.getByRole('button',{name:'Keep my current progress',exact:true}).click();
 await expect(page.locator('dialog[open]')).toContainText('Back up your current progress?');
 expect(await page.evaluate(()=>[saved,loaded,deleted])).toEqual([0,0,0]);
 await page.getByRole('button',{name:'Save my current progress',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>saved)).toBe(1);
 expect(await page.evaluate(()=>[loaded,deleted])).toEqual([0,0]);
});
test('loading a different save requires confirmation and cancel preserves current progress',async({page})=>{
 await saveChoices(page,true);await page.getByRole('button',{name:'Review saves',exact:true}).click();
 await page.locator('dialog[open]').getByRole('button',{name:'Load saved progress',exact:true}).click();
 await expect(page.locator('dialog[open]')).toContainText('Your account will not be deleted');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>[saved,loaded,deleted])).toEqual([0,0,0]);
});
test('known save from a different browser saves normally without a choice popup',async({page})=>{
 await saveChoices(page,false);await page.getByRole('button',{name:'Save now',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>saved)).toBe(1);await expect(page.locator('dialog[open]')).toHaveCount(0);
 expect(await page.evaluate(()=>[loaded,deleted])).toEqual([0,0]);
});

test('saved account keeps advanced tools tucked away and clears completed syncing status',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await saveChoices(page,false);
 await expect(page.locator('#cloudLiveStatus')).toHaveText('Progress backed up');
 await expect(page.locator('#cloudAutoSyncToggle')).toBeHidden();
 await expect(page.locator('#cloudRestoreButton')).toBeHidden();
 await expect(page.locator('#copyTransferButton')).toBeHidden();
 await expect(page.locator('#cloudDeleteButton')).toBeHidden();
 await expect(page.locator('#cloudSignOutButton')).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('earnly-cloud-syncing')));
 await expect(page.locator('#cloudLiveStatus')).toContainText('Syncing');
 await page.evaluate(()=>window.dispatchEvent(new Event('earnly-cloud-sync-idle')));
 await expect(page.locator('#cloudLiveStatus')).toHaveText('Progress backed up');
 for(const width of [320,390,440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/account-simple.png',fullPage:true});
 await page.locator('.account-save-tools > summary').click();
 await expect(page.locator('#cloudAutoSyncToggle')).toBeVisible();
 await page.locator('.account-save-options > summary').click();
 await expect(page.locator('#cloudRestoreButton')).toBeVisible();
 await page.locator('#transfer > summary').click();
 await expect(page.locator('#copyTransferButton')).toBeVisible();
});
