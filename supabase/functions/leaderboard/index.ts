
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const GAMES: Record<string, { label:string; lower?:boolean; max:number }> = {
  snake:{label:"apples",max:1000000},
  blockDrop:{label:"lines",max:1000000},
  tapRush:{label:"hits",max:1000000},
  memory:{label:"moves",lower:true,max:1000000},
  dodger:{label:"seconds",max:1000000},
  brickBreaker:{label:"bricks",max:100000000},
  jungleHopper:{label:"vines",max:100000000},
  towerStack:{label:"floors",max:1000000},
  coinCatch:{label:"catches",max:100000000},
  colorMatch:{label:"matches",max:100000000},
  paddleRally:{label:"rallies",max:100000000},
  laneRunner:{label:"seconds",max:1000000},
  safeCracker:{label:"locks",max:100000000},
  blockGrid:{label:"points",max:1000000000},
  mergeRush:{label:"points",max:1000000000},
  perfectDrop:{label:"hits",max:100000000},
  spiralDrop:{label:"rows",max:100000000},
  shapeFit:{label:"correct",max:100000000},
  bounceRun:{label:"distance",max:1000000000},
  trafficEscape:{label:"cars",max:100000000},
  starDefender:{label:"points",max:1000000000},
  neonMaze:{label:"cells",max:1000000},
  neonDrift:{label:"points",max:1000000},
  neonBreach:{label:"points",max:1000000000},
  meteorShield:{label:"meteors",max:100000000},
  wordBlitz:{label:"words",max:1000000},
  mazeSprint:{label:"mazes",max:1000000},
  bubbleChain:{label:"points",max:1000000000},
};

const SERVER_REWARD_GAMES = new Set([
  "snake","blockDrop","tapRush","memory","dodger","brickBreaker","jungleHopper","towerStack"
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function cleanGame(value: unknown) {
  const game = String(value || "").trim();
  return GAMES[game] ? game : "";
}

function cleanLimit(value: unknown) {
  return Math.max(1, Math.min(50, Math.floor(Number(value) || 25)));
}

function cleanScore(game: string, value: unknown) {
  const score = Math.floor(Number(value) || 0);
  const rule = GAMES[game];
  if (!rule || score < 1 || score > rule.max) return 0;
  return score;
}

function avatarEmoji(key: string) {
  const map: Record<string,string> = {
    gamepad:"🎮", rocket:"🚀", bolt:"⚡", fire:"🔥", alien:"👾", frog:"🐸",
    brain:"🧠", trophy:"🏆", gem:"💎", fox:"🦊", cat:"🐱", dog:"🐶",
    robot:"🤖", snake:"🐍", star:"⭐", crown:"👑"
  };
  return map[key] || map.gamepad;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error:"POST required" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceKey) return json({ error:"Server configuration unavailable" }, 500);

    const admin = createClient(url, serviceKey, {
      auth:{ persistSession:false, autoRefreshToken:false }
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    if (action === "list") {
      const game = cleanGame(body.game);
      if (!game) return json({ error:"Unknown game" }, 400);
      const limit = cleanLimit(body.limit);
      const ascending = !!GAMES[game].lower;

      const { data:rows, error:scoreError } = await admin
        .from("leaderboard_scores")
        .select("user_id,game,score,verified,achieved_at")
        .eq("game", game)
        .order("score", { ascending })
        .order("achieved_at", { ascending:true })
        .limit(limit);

      if (scoreError) throw scoreError;

      const { data:bans, error:banError } = await admin
        .from("leaderboard_bans")
        .select("user_id");
      if (banError) throw banError;
      const banned = new Set((bans || []).map((row:any) => row.user_id));
      const visibleRows = (rows || []).filter((row:any) => !banned.has(row.user_id));

      const ids = visibleRows.map((row:any) => row.user_id);
      let profiles: any[] = [];
      if (ids.length) {
        const { data, error } = await admin
          .from("profiles")
          .select("user_id,username,avatar_key")
          .in("user_id", ids);
        if (error) throw error;
        profiles = data || [];
      }
      const byUser = new Map(profiles.map((p:any) => [p.user_id, p]));
      // Cosmetic metadata never changes score verification or submission.
      const equippedByUser = new Map<string,any>();
      if (ids.length) {
        const {data:loadouts,error:cosmeticError} = await admin.from("cosmetic_loadouts")
          .select("user_id,cosmetic_items(asset_path,rarity)").eq("slot","avatar").in("user_id",ids);
        if (!cosmeticError) for (const item of loadouts || []) equippedByUser.set(item.user_id,item.cosmetic_items);
      }
      const entries = visibleRows
        .map((row:any) => {
          const profile = byUser.get(row.user_id);
          if (!profile?.username) return null;
          return {
            username:profile.username,
            avatarKey:profile.avatar_key || "gamepad",
            avatar:avatarEmoji(profile.avatar_key || "gamepad"),
            avatarUrl:equippedByUser.get(row.user_id)?.asset_path || "cosmetic-cyber-starter.svg",
            avatarRarity:equippedByUser.get(row.user_id)?.rarity || "common",
            score:Number(row.score || 0),
            verified:!!row.verified,
            achievedAt:row.achieved_at,
          };
        })
        .filter(Boolean)
        .map((entry:any, index:number) => ({ rank:index + 1, ...entry }));

      return json({
        ok:true,
        game,
        label:GAMES[game].label,
        lowerIsBetter:ascending,
        entries
      });
    }

    if (action !== "submit") return json({ error:"Unsupported action" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error:"Sign in required" }, 401);

    const { data:userData, error:userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error:"Invalid session" }, 401);
    const userId = userData.user.id;

    const { data:bannedAccount } = await admin
      .from("leaderboard_bans")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (bannedAccount) return json({ error:"Leaderboard access is unavailable for this account." }, 403);

    const game = cleanGame(body.game);
    const score = cleanScore(game, body.score);
    if (!game || !score) return json({ error:"Invalid score" }, 400);

    const { data:profile, error:profileError } = await admin
      .from("profiles")
      .select("username,avatar_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.username) {
      return json({ error:"Choose a leaderboard username in Profile first.", code:"USERNAME_REQUIRED" }, 409);
    }

    let verified = false;
    if (SERVER_REWARD_GAMES.has(game)) {
      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data:ledger } = await admin
        .from("coin_ledger")
        .select("id")
        .eq("user_id", userId)
        .eq("source_type", "game")
        .eq("game", game)
        .eq("metric", score)
        .gte("created_at", recentCutoff)
        .limit(1);
      verified = !!ledger?.length;
    }

    const { data:current, error:currentError } = await admin
      .from("leaderboard_scores")
      .select("score,verified,achieved_at")
      .eq("user_id", userId)
      .eq("game", game)
      .maybeSingle();
    if (currentError) throw currentError;

    const better = !current || (GAMES[game].lower ? score < Number(current.score) : score > Number(current.score));
    const same = !!current && Number(current.score) === score;

    if (better) {
      const now = new Date().toISOString();
      const { error } = await admin.from("leaderboard_scores").upsert({
        user_id:userId,
        game,
        score,
        verified,
        achieved_at:now,
        updated_at:now
      }, { onConflict:"user_id,game" });
      if (error) throw error;
    } else if (same && verified && !current.verified) {
      const { error } = await admin
        .from("leaderboard_scores")
        .update({ verified:true, updated_at:new Date().toISOString() })
        .eq("user_id", userId)
        .eq("game", game);
      if (error) throw error;
    }

    const keptScore = better ? score : Number(current?.score || score);
    const countQuery = admin
      .from("leaderboard_scores")
      .select("user_id", { count:"exact", head:true })
      .eq("game", game);
    const { count } = GAMES[game].lower
      ? await countQuery.lt("score", keptScore)
      : await countQuery.gt("score", keptScore);

    return json({
      ok:true,
      saved:better,
      game,
      score:keptScore,
      rank:(count || 0) + 1,
      verified:better ? verified : !!(current?.verified || (same && verified)),
      username:profile.username,
      avatarKey:profile.avatar_key || "gamepad"
    });
  } catch (error) {
    console.error(error);
    return json({ error:String((error as any)?.message || error || "Leaderboard request failed") }, 400);
  }
});
