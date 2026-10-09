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
 await mock(page,{conflict:true});await page.goto('/account.html');await expect(page.locator('#cloudMessage')).toContainText('newer save');await expect(page.locator('#syncStatusDot')).not.toHaveClass(/ready/);
 await page.locator('.account-sync-details summary').click();await expect(page.locator('#pendingEvents')).toContainText('Sync paused');await expect(page.locator('#delete-account > summary')).toBeVisible();await page.locator('#delete-account > summary').click();await expect(page.locator('#cloudDeleteButton')).toBeVisible();
 for(const width of [320,390,440,1280]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
});
