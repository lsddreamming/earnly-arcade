import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// GET routes are public. Mutations and /me verify the session inside this
// function; the gateway's legacy JWT validator is intentionally disabled.
const origins = new Set(["https://earnlyarcade.com", "https://www.earnlyarcade.com", "https://lsddreamming.github.io", "capacitor://localhost", "http://localhost"]);
const userLimits = new Map<string, {count:number;expires:number}>();
const errors: Record<string,[number,string]> = {
  WALLET_UNAVAILABLE:[409,"Your Coin wallet is not ready. Open Account & Data first."],
  PROFILE_REQUIRED:[409,"Choose your global username in Profile first."],
  REQUEST_REUSED:[409,"This purchase request belongs to another item."],
  ITEM_NOT_FOUND:[404,"This item is not available."],
  ITEM_NOT_OWNED:[403,"Unlock this item before equipping it."],
  INSUFFICIENT_COINS:[409,"Not enough Arcade Coins for this item."]
};
const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey = "sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ";

export async function handler(req:Request):Promise<Response> {
  const origin=req.headers.get("origin");
  const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",
    "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type,idempotency-key",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
  if(origin&&origins.has(origin))headers["Access-Control-Allow-Origin"]=origin;
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  const fail=(code:string,message:string,status:number)=>json({error:{code,message}},status);
  if(origin&&!origins.has(origin))return fail("ORIGIN_DENIED","This origin is not permitted.",403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  const parsed=new URL(req.url);
  const path=parsed.pathname.replace(/^.*\/avatars/,"");
  try {
    if(req.method==="GET"&&path==="/api/config")return json({supabaseUrl:url,publishableKey:publicKey,game:"snake"});
    if(req.method==="GET"&&path==="/api/shop") {
      const {data,error}=await admin.from("cosmetic_items").select("*").eq("active",true).order("slot").order("coin_price");
      if(error)throw error;
      return json({items:(data||[]).map(i=>({id:i.id,name:i.name,slot:i.slot,coinPrice:i.coin_price,rarity:i.rarity,imageUrl:i.asset_path,isStarter:i.is_starter}))});
    }
    const usernameMatch=path.match(/^\/api\/user\/([A-Za-z0-9_]{3,18})$/);
    if(req.method==="GET"&&(path==="/api/leaderboard"||usernameMatch)) {
      const game=parsed.searchParams.get("game")||"snake";
      if(!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(game))return fail("INVALID_GAME","Invalid leaderboard game.",400);
      const limit=Number(parsed.searchParams.get("limit")||25);
      if(!Number.isInteger(limit)||limit<1||limit>100)return fail("INVALID_LIMIT","Limit must be between 1 and 100.",400);
      const {data,error}=await admin.rpc("cosmetic_public_profiles",{p_game:game,p_username:usernameMatch?.[1]||null,p_limit:limit});
      if(error)throw error;
      if(usernameMatch)return data?.length?json({profile:data[0]}):fail("PLAYER_NOT_FOUND","Player not found.",404);
      return json({game,players:data||[]});
    }
    if(!((req.method==="GET"&&path==="/api/me")||(req.method==="POST"&&["/api/shop/buy","/api/user/equip"].includes(path))))
      return fail("NOT_FOUND","API route not found.",404);
    const token=req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)return fail("SIGN_IN_REQUIRED","Sign in to customize your character.",401);
    const {data:auth,error:authError}=await admin.auth.getUser(token);
    if(authError||!auth.user||auth.user.is_anonymous)return fail("SESSION_EXPIRED","Sign in with your Earnly account.",401);
    const id=auth.user.id;
    const now=Date.now();
    if(userLimits.size>10000)for(const [key,value] of userLimits)if(value.expires<now)userLimits.delete(key);
    const limit=userLimits.get(id);
    if(limit&&limit.expires>now){if(++limit.count>60)return fail("RATE_LIMITED","Too many requests. Try again shortly.",429);}
    else userLimits.set(id,{count:1,expires:now+60000});
    let rpc="cosmetic_me",args:Record<string,unknown>={p_user_id:id};
    if(req.method==="POST") {
      const raw=await req.text();
      if(raw.length>8192)return fail("REQUEST_TOO_LARGE","Request is too large.",413);
      let body;try{body=JSON.parse(raw);}catch{return fail("INVALID_JSON","Invalid JSON request.",400);}
      const item=body?.itemId??body?.avatarId;
      if(typeof item!=="string"||!/^[a-z0-9-]{1,64}$/.test(item))return fail("INVALID_ITEM","Choose a valid shop item.",400);
      args.p_item_id=item;
      if(path==="/api/shop/buy") {
        const key=req.headers.get("Idempotency-Key");
        if(!key||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))return fail("REQUEST_ID_REQUIRED","A valid purchase request ID is required.",400);
        args.p_request_id=key;rpc="cosmetic_buy";
      } else rpc="cosmetic_equip";
    }
    const {data,error}=await admin.rpc(rpc,args);
    if(error)throw error;
    return json(data);
  }catch(error) {
    const message=String((error as {message?:string})?.message||"");
    const code=Object.keys(errors).find(code=>message.includes(code));
    if(code){const [status,message]=errors[code];return fail(code,message,status);}
    console.error("Cosmetics backend failed",(error as {code?:string})?.code||"unknown");
    return fail("SERVER_ERROR","Could not complete this request. Please try again.",500);
  }
}
Deno.serve(handler);
