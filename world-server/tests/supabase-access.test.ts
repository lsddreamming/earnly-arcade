import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseWorldAccess} from '../src/supabase-access.ts';
import {WorldAccessError} from '../src/access-error.ts';

test('a rejected server API key is distinguished from a player session failure',async t=>{
  for(const response of [
    new Response('{}',{status:401,headers:{'sb-error-code':'UNAUTHORIZED_INVALID_API_KEY'}}),
    Response.json({message:'Invalid API key'},{status:401})
  ]){
    t.mock.method(globalThis,'fetch',async()=>response);
    await assert.rejects(new SupabaseWorldAccess('https://world-test.invalid','server-key').authenticate('player-token'),
      error=>error instanceof WorldAccessError&&error.reason==='server_configuration'&&!error.message.includes('server-key'));
    t.mock.restoreAll();
  }
});

test('an expired player session still fails closed with a sign-in classification',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({message:'JWT expired'},{status:401}));
  await assert.rejects(new SupabaseWorldAccess('https://world-test.invalid','server-key').authenticate('expired-token'),
    error=>error instanceof WorldAccessError&&error.reason==='sign_in_required');
});

test('confirmed account is still required after successful token verification',async t=>{
  for(const user of [{id:'user',is_anonymous:true,email_confirmed_at:'2026-01-01'},{id:'user'},{}]){
    t.mock.method(globalThis,'fetch',async()=>Response.json(user));
    await assert.rejects(new SupabaseWorldAccess('https://world-test.invalid','server-key').authenticate('player-token'),
      error=>error instanceof WorldAccessError&&error.reason==='confirmed_account_required');
    t.mock.restoreAll();
  }
});

test('copied surrounding whitespace is removed from the server key without changing the player token',async t=>{
  t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
    assert.equal(url,'https://world-test.invalid/auth/v1/user');
    assert.equal(options.headers.apikey,'server-key');
    assert.equal(options.headers.Authorization,'Bearer player-token');
    return Response.json({id:'user',email_confirmed_at:'2026-01-01'});
  });
  assert.deepEqual(await new SupabaseWorldAccess('https://world-test.invalid',' \nserver-key\n ').authenticate('player-token'),{userId:'user',username:'user'});
});
