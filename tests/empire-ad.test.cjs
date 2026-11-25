const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('empire-ad.js', 'utf8');

function fixture(showRewarded) {
  const button = { hidden:true }, notice = {};
  const state = { cash:0, levels:[1,0] };
  const context = {
    window:{ Capacitor:{isNativePlatform:()=>true}, EarnlyNativeAds:{isNative:true,showRewarded} },
    document:{getElementById:id=>id==='investor'?button:notice},
    state, ticket:()=>5, price:()=>18, fmt:String,
    credit:amount=>state.cash+=amount, action:()=>{}, setInterval:()=>{}
  };
  vm.runInNewContext(source,context);
  return {button,state};
}

test('concurrent taps and immediate replay award only one investor grant', async()=>{
  let finish, calls=0;
  const {button,state}=fixture(()=>{calls++; return new Promise(resolve=>finish=resolve)});
  const pending=button.onclick();
  await button.onclick();
  finish({earned:true});
  await pending;
  await button.onclick();
  assert.equal(calls,1);
  assert.equal(state.cash,20);
  assert.equal(button.hidden,true);
});

test('dismissal and load failure leave the register untouched and permit retry',async()=>{
  for(const provider of [async()=>({earned:false}),async()=>{throw Error('no fill')}]){
    const {button,state}=fixture(provider);
    await button.onclick();
    assert.equal(state.cash,0);
    assert.equal(button.disabled,false);
    assert.equal(button.hidden,false);
  }
});
