import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import "./engine.js";
const engine = (globalThis as any).SpuddyDefense;
const headers = {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"apikey, authorization, content-type, x-client-info","Content-Type":"application/json"};
const reply = (data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return reply({});
  if(req.method!=="POST") return reply({error:"POST required"},405);
  try {
    const raw=await req.text();
    if(raw.length>80000) return reply({error:"Replay too large"},413);
    const body=JSON.parse(raw), challenge=engine.challenge("weekly");
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    if(body.action==="submit"){
      const token=req.headers.get("Authorization")?.replace(/^Bearer /,"");
      if(!token)return reply({error:"Sign in to post your defense."},401);
      const {data:{user}}=await db.auth.getUser(token);
      if(!user || user.is_anonymous)return reply({error:"Sign in to post your defense."},401);
      const {data:profile,error:profileError}=await db.from("profiles").select("username").eq("user_id",user.id).maybeSingle();
      if(profileError)throw profileError;
      if(!profile?.username)return reply({error:"Choose a public username in your Earnly profile first."},409);
      const {data:ban,error:banError}=await db.from("leaderboard_bans").select("user_id").eq("user_id",user.id).maybeSingle();
      if(banError)throw banError;
      if(ban)return reply({error:"Leaderboard access unavailable."},403);
      const {moves,ticks,week}=body;
      if(week!==challenge.id||!Array.isArray(moves)||moves.length>500||!Number.isInteger(ticks)||ticks<1||ticks>30000)return reply({error:"Invalid weekly replay."},400);
      const game=engine.create({...challenge,challenge});
      let index=0,previous=0;
      for(let tick=0;tick<ticks;tick++){
        while(index<moves.length && moves[index].at===tick){
          if(!game.action(moves[index++].action))return reply({error:"Invalid move."},400);
        }
        if(game.state.phase!=="wave" || game.state.wave>5)return reply({error:"Invalid wave."},400);
        previous=game.state.completed;game.step();
      }
      const s=game.state;
      if(index!==moves.length||s.completed===previous||s.phase!=="build")return reply({error:"Finish a wave before posting."},400);
      const {error}=await db.rpc("patch_cup_keep",{w:week,p:user.id,n:s.completed,h:s.lives,c:s.money});
      if(error)throw error;
    }else if(body.action!=="list")return reply({error:"Unknown action"},400);
    const {data,error}=await db.rpc("patch_cup_list",{w:challenge.id});if(error)throw error;
    return reply({entries:data,week:challenge.id});
  }catch{return reply({error:"Cup unavailable. Try again shortly."},503);}
});
