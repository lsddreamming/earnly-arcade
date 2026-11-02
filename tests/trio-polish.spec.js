const {test,expect}=require('@playwright/test');
for(const name of ['blockdrop','paddlerally','neonmaze'])test(name+' polished board renders and fits mobile width',async({page},info)=>{
 await page.goto('/'+name+'.html');
 await page.evaluate(()=>{Arcade.countdown=callback=>callback()});
 if(name==='blockdrop')await page.locator('#blockDropBoardStart').click();else await page.locator('#startButton').click();
 await expect(page.locator('body')).toHaveClass(/game-active/);
 await expect(page.locator('.arcade-pulse')).toBeVisible();
 await expect(page.locator('canvas#game')).toBeVisible();
 const bounds=await page.locator('canvas#game').boundingBox();const width=await page.evaluate(()=>innerWidth);
 expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:info.outputPath(name+'-active.png'),fullPage:true});
});
test('Block Drop successive seven-piece bags are balanced',async({page})=>{
 await page.goto('/blockdrop.html');
 const batches=await page.evaluate(()=>{pieceBag=[];return Array.from({length:10},()=>Array.from({length:7},nextPieceIndex).sort())});
 for(const batch of batches)expect(batch).toEqual([0,1,2,3,4,5,6]);
});
test('Paddle Rally caps speed while tracking center returns',async({page})=>{
 await page.goto('/paddlerally.html');
 const state=await page.evaluate(()=>{running=true;ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-ball.r-1;ball.dx=0;ball.dy=18;lastFrame=100;loop(116.67);cancelAnimationFrame(animation);return {score,cleanReturns,speed:Math.hypot(ball.dx,ball.dy)}});
 expect(state.score).toBe(1);expect(state.cleanReturns).toBe(1);expect(state.speed).toBeCloseTo(18);
});
