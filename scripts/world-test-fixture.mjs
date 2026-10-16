import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export async function worldFixture({publicRoomDefault=true}={}){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean default false,email_confirmed_at timestamptz default now());create table public.profiles(user_id uuid primary key,username text);create table public.leaderboard_bans(user_id uuid);create table public.coin_wallets(user_id uuid primary key,balance bigint,purchased_balance bigint,purchase_debt bigint default 0,updated_at timestamptz default now());create function public.cosmetic_loadout_json(uuid) returns jsonb language sql as 'select ''{"avatar":{"id":"cyber-starter","imageUrl":"cosmetic-cyber-starter.svg"},"outfit":{"id":"starter-suit","imageUrl":"cosmetic-starter-suit.svg"}}''::jsonb';`);
 for(const name of ['20261013204721_world_persistence','20261013210433_world_trade_offer_integrity','20261013211424_world_catalog_social','20261014130005_world_public_hangouts','20261014181242_world_room_choices','20261014185909_world_garden_catalog','20261014194944_world_large_split_rooms','20261014203319_world_heritage_collection','20261016162731_world_room_delete'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
 if(publicRoomDefault)await db.exec(await readFile(new URL('../supabase/migrations/20261016233546_world_rooms_public_default.sql',import.meta.url),'utf8'));
 const users=[randomUUID(),randomUUID()];for(const [index,id] of users.entries()){await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into public.profiles values($1,$2)',[id,'Player'+index]);await db.query('insert into public.coin_wallets(user_id,balance,purchased_balance) values($1,3000,0)',[id]);}
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  if(!String(url).startsWith('https://world-test.invalid/'))return originalFetch(url,options);
  try{
   if(String(url).endsWith('/auth/v1/user')){const id=options.headers.Authorization.slice(7);return Response.json(users.includes(id)?{id,email_confirmed_at:'2026-01-01'}:{},{status:users.includes(id)?200:401});}
   const p=JSON.parse(options.body);let query,args;
   if(String(url).endsWith('/world_api')){query='select public.world_api($1,$2,$3::jsonb) result';args=[p.p_actor,p.p_action,JSON.stringify(p.p_data)];}
   else if(String(url).endsWith('/world_room_snapshot')){query='select public.world_room_snapshot($1,$2) result';args=[p.p_actor,p.p_room];}
   else if(String(url).endsWith('/world_delete_room')){query='select public.world_delete_room($1,$2) result';args=[p.p_actor,p.p_room];}
   else if(String(url).endsWith('/world_trade_action')){query='select public.world_trade_action($1,$2,$3,$4,$5::uuid[]) result';args=[p.p_actor,p.p_trade,p.p_revision,p.p_action,p.p_items];}
   else return new Response('',{status:404});
   return Response.json((await db.query(query,args)).rows[0].result);
  }catch(error){if(process.env.WORLD_TEST_DEBUG)console.error(error.message,error.internalQuery);return Response.json({error:error.message},{status:400});}
 };
 return {db,users,close:async()=>{globalThis.fetch=originalFetch;await db.close();}};
}
