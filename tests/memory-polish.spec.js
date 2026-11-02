const {test,expect}=require('@playwright/test');

test('memory keeps card nodes, hides identities and records consecutive pairs',async({page})=>{
  await page.goto('/memory.html');
  await page.evaluate(()=>{Arcade.countdown=callback=>callback();startGame();});
  const state=await page.evaluate(()=>{
    const node=grid.children[0];
    const hiddenLabel=node.getAttribute('aria-label');
    const partner=cards.findIndex((card,i)=>i!==0 && card.icon===cards[0].icon);
    flip(0);flip(partner);
    const next=cards.findIndex(card=>!card.matched);
    const nextPartner=cards.findIndex((card,i)=>i!==next && card.icon===cards[next].icon);
    flip(next);flip(nextPartner);
    return {same:node===grid.children[0],hiddenLabel,pairs,chain,bestChain,matched:node.classList.contains('matched')};
  });
  expect(state).toEqual({same:true,hiddenLabel:'Hidden card 1',pairs:2,chain:2,bestChain:2,matched:true});
  await expect(page.locator('#pairProgress .found')).toHaveCount(2);
  await expect(page.locator('#memoryFeedback')).toContainText('2 pair streak');
});

test('memory mismatch blocks a third flip and keeps the coin rules',async({page})=>{
  await page.goto('/memory.html');
  await page.evaluate(()=>{Arcade.countdown=callback=>callback();startGame();});
  const state=await page.evaluate(()=>{
    const other=cards.findIndex(card=>card.icon!==cards[0].icon);
    flip(0);flip(other);
    const third=cards.findIndex((card,i)=>i!==0&&i!==other);
    flip(third);
    return {revealed:cards.filter(card=>card.revealed).length,moves,mistakes,reward:rewardForMoves(moves),expected:Arcade.gameReward('memory',moves),disabled:[...grid.children].every(card=>card.disabled)};
  });
  expect(state.revealed).toBe(2);expect(state.moves).toBe(1);expect(state.mistakes).toBe(1);
  expect(state.reward).toBe(state.expected);expect(state.disabled).toBe(true);
  await expect.poll(()=>page.evaluate(()=>lock)).toBe(false);
});
