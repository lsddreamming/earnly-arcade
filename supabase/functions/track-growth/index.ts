
import { withSupabase } from 'npm:@supabase/server'

const EVENT_TYPES = new Set([
  'promotion_clicked',
  'acquisition_attributed',
  'onboarding_shown',
  'onboarding_completed',
  'onboarding_dismissed',
  'play_started',
  'game_result',
  'one_more_run_shown',
  'rewarded_ad_started',
  'rewarded_ad_outcome',
  'rewarded_play_unlock',
  'leaderboard_viewed',
  'profile_identity_saved',
  'score_challenge_shared',
  'score_challenge_opened',
  'score_challenge_completed',
  'signup_page_viewed',
  'signup_submitted',
  'signup_email_sent',
  'signup_completed',
  'signup_error'
])

const GAMES = new Set([
  'snake','blockDrop','tapRush','memory','dodger','brickBreaker','jungleHopper','towerStack',
  'coinCatch','colorMatch','paddleRally','laneRunner','safeCracker','blockGrid','mergeRush',
  'perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape','neonSlice','neonBreach'
])

function cleanToken(value: unknown, max = 64) {
  const cleaned = String(value ?? '')
    .trim()
    .slice(0, max)
    .replace(/[^A-Za-z0-9._-]/g, '')
  return cleaned || null
}

function cleanDeviceId(value: unknown) {
  const cleaned = String(value ?? '').trim().slice(0, 128)
  return /^[A-Za-z0-9._:-]{8,128}$/.test(cleaned) ? cleaned : null
}

function cleanEventId(value: unknown) {
  const cleaned = String(value ?? '').trim().slice(0, 128)
  return /^[A-Za-z0-9._:-]{8,128}$/.test(cleaned) ? cleaned : null
}

async function hashDeviceId(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function cleanProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    const safeKey = cleanToken(key, 40)
    if (!safeKey) continue
    if (raw === null || typeof raw === 'boolean') result[safeKey] = raw
    else if (typeof raw === 'number' && Number.isFinite(raw)) result[safeKey] = raw
    else if (typeof raw === 'string') result[safeKey] = raw.slice(0, 160)
  }
  return result
}

Deno.serve(
  withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ ok:false, error:'POST required' }, { status:405 })
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return Response.json({ ok:false, error:'Invalid JSON' }, { status:400 })
    }

    const eventId = cleanEventId(body.eventId)
    const deviceId = cleanDeviceId(body.deviceId)
    const eventType = String(body.eventType ?? '')

    if (!eventId || !deviceId || !EVENT_TYPES.has(eventType)) {
      return Response.json({ ok:false, error:'Invalid growth event' }, { status:400 })
    }

    const gameRaw = cleanToken(body.game, 40)
    const game = gameRaw && GAMES.has(gameRaw) ? gameRaw : null
    const clientCreatedAtRaw = String(body.clientCreatedAt ?? '')
    const clientCreatedAt = Number.isFinite(Date.parse(clientCreatedAtRaw))
      ? new Date(clientCreatedAtRaw).toISOString()
      : null

    const row = {
      event_id:eventId,
      device_id:await hashDeviceId(deviceId),
      event_type:eventType,
      creator:cleanToken(body.creator, 40),
      source:cleanToken(body.source, 40),
      campaign:cleanToken(body.campaign, 64),
      content:cleanToken(body.content, 64),
      challenge:cleanToken(body.challenge, 64),
      game,
      landing_path:cleanToken(body.landingPath, 100),
      properties:cleanProperties(body.properties),
      client_created_at:clientCreatedAt
    }

    const { error } = await ctx.supabaseAdmin
      .from('growth_events')
      .upsert(row, { onConflict:'event_id', ignoreDuplicates:true })

    if (error) {
      console.error('growth event insert failed', error)
      return Response.json({ ok:false, error:'Event not stored' }, { status:500 })
    }

    return Response.json({ ok:true })
  })
)

