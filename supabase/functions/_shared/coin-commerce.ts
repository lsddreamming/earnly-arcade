/** Payment boundary: all prices and players come from trusted server sources. */
export function commerceHandler({db,stripe,verifyUser,verifyEvent,checkoutEnabled}:any) {
  const origins=new Set(['https://earnlyarcade.com','https://www.earnlyarcade.com']);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const unwrap=({data,error}:any)=>{if(error)throw error;return data;};
  async function fulfill(order:any) {
    if(!stripe||!order.session_id)return null;
    const session=await stripe.checkout.sessions.retrieve(order.session_id,{expand:['payment_intent.latest_charge']});
    if(session.metadata?.orderId!==order.id || session.client_reference_id!==order.id || session.mode!=='payment')throw new Error('PAYMENT_MISMATCH');
    if(session.payment_status!=='paid')return null;
    const intent=session.payment_intent;
    if(!intent||typeof intent==='string'||!intent.latest_charge||typeof intent.latest_charge==='string')throw new Error('PAYMENT_MISMATCH');
    if(intent.metadata?.orderId!==order.id||intent.amount_received!==order.amount_cents||intent.currency!==order.currency)throw new Error('PAYMENT_MISMATCH');
    const charge=intent.latest_charge;
    if(charge.disputed)throw new Error('PAYMENT_REVIEW');
    return unwrap(await db.rpc('coin_order_fulfill',{p_order_id:order.id,p_session_id:session.id,p_amount:session.amount_total,
      p_currency:session.currency,p_live:session.livemode,p_paid:true,p_intent:intent.id,p_refunded:charge.amount_refunded||0}));
  }
  return async (req:Request):Promise<Response>=>{
    const path=new URL(req.url).pathname.replace(/^.*\/(coin-shop|coin-webhook)/,'')||'/';
    const webhook=path==='/'&&new URL(req.url).pathname.includes('/coin-webhook');
    const origin=req.headers.get('origin');
    const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
      'Access-Control-Allow-Headers':'authorization,content-type,idempotency-key,apikey,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
    if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    const fail=(code:string,message:string,status=400)=>json({error:{code,message}},status);
    if(!webhook&&origin&&!origins.has(origin))return fail('ORIGIN_DENIED','Coin purchases are available on the Earnly website.',403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    try {
      if(webhook&&req.method==='POST') {
        if(!stripe||!verifyEvent)return fail('UNAVAILABLE','Payment processing is not configured.',503);
        const raw=await req.text();if(raw.length>262144)return fail('REQUEST_TOO_LARGE','Request is too large.',413);
        let event;try{event=await verifyEvent(raw,req.headers.get('stripe-signature')||'');}catch{return fail('INVALID_SIGNATURE','Invalid payment signature.',400);}
        if(!event.livemode)return json({received:true,credited:false}); // Sandbox payments never mint production coins.
        let orderId:string|undefined;
        if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))orderId=event.data.object.metadata?.orderId;
        if(['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(event.type)) {
          const object=event.data.object;
          const intentId=typeof object.payment_intent==='string'?object.payment_intent:object.payment_intent?.id;
          if(intentId){const intent=await stripe.paymentIntents.retrieve(intentId);orderId=intent.metadata?.orderId;}
        }
        if(orderId&&uuid.test(orderId)) {
          const order=unwrap(await db.from('coin_orders').select('*').eq('id',orderId).maybeSingle());
          if(!order)return fail('ORDER_NOT_FOUND','Order is not ready. Retry delivery.',503);
          if(!order.session_id)return fail('ORDER_PENDING','Order is not ready. Retry delivery.',503);
          await fulfill(order);
        }
        return json({received:true});
      }
      if(path==='/config'&&req.method==='GET') {
        const packs=unwrap(await db.from('coin_packs').select('id,coins,price_cents,currency').eq('active',true).order('price_cents'));
        return json({available:!!checkoutEnabled,packs:(packs||[]).map((p:any)=>({id:p.id,coins:p.coins,priceCents:p.price_cents,currency:p.currency}))});
      }
      if(!((req.method==='POST'&&['/checkout','/plays/buy','/plays/consume'].includes(path)) ||
       (req.method==='GET'&&(path==='/plays'||/^\/orders\/[0-9a-f-]+$/i.test(path)))))return fail('NOT_FOUND','Route not found.',404);
      const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
      const user=token?await verifyUser(token):null;
      if(!user||user.is_anonymous)return fail('SIGN_IN_REQUIRED','Sign in to your Earnly account first.',401);
      if(path==='/plays'&&req.method==='GET') {
        const credits=unwrap(await db.from('coin_play_credits').select('game,remaining').eq('user_id',user.id));
        return json({credits:credits||[]});
      }
      if(path.startsWith('/orders/')&&req.method==='GET') {
        const id=path.slice(8);if(!uuid.test(id))return fail('INVALID_ORDER','Invalid order.');
        const order=unwrap(await db.from('coin_orders').select('*').eq('id',id).eq('user_id',user.id).maybeSingle());
        if(!order)return fail('ORDER_NOT_FOUND','Order not found.',404);
        const result=await fulfill(order);
        return json({orderId:order.id,status:result?.status||order.status,coins:order.coins,wallet:result?.wallet});
      }
      const key=req.headers.get('Idempotency-Key');if(!key||!uuid.test(key))return fail('REQUEST_ID_REQUIRED','A valid request ID is required.');
      const raw=await req.text();if(raw.length>4096)return fail('REQUEST_TOO_LARGE','Request is too large.',413);
      let body;try{body=JSON.parse(raw);}catch{return fail('INVALID_JSON','Invalid request.');}
      if(path.startsWith('/plays/')) {
        if(typeof body?.game!=='string')return fail('INVALID_GAME','Choose a game.');
        return json(unwrap(await db.rpc('coin_play_action',{p_user_id:user.id,p_game:body.game,p_request_id:key,p_action:path.endsWith('/buy')?'buy':'consume'})));
      }
      if(!checkoutEnabled||!stripe)return fail('CHECKOUT_UNAVAILABLE','Card purchases are coming soon. You can still earn coins by playing.',503);
      if(typeof body?.packId!=='string'||!/^[a-z]{1,20}$/.test(body.packId))return fail('INVALID_PACK','Choose a coin pack.');
      const order=unwrap(await db.rpc('coin_order_create',{p_user_id:user.id,p_pack_id:body.packId,p_request_id:key}));
      if(order.status==='fulfilled')return json({orderId:order.id,fulfilled:true});
      let session;
      if(order.session_id)session=await stripe.checkout.sessions.retrieve(order.session_id);
      else {
        session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],client_reference_id:order.id,
          metadata:{orderId:order.id},payment_intent_data:{metadata:{orderId:order.id}},
          line_items:[{price_data:{currency:order.currency,unit_amount:order.amount_cents,product_data:{name:order.coins.toLocaleString()+' Arcade Coins'}},quantity:1}],
          success_url:'https://earnlyarcade.com/avatars.html?coin_order='+order.id+'#coin-shop',cancel_url:'https://earnlyarcade.com/avatars.html?coin_cancelled=1#coin-shop',
          expires_at:Math.floor(Date.now()/1000)+1800},{idempotencyKey:'earnly-coins-'+order.id});
        if(!session.livemode)throw new Error('PAYMENT_NOT_LIVE_PAID');
        unwrap(await db.from('coin_orders').update({session_id:session.id}).eq('id',order.id).is('session_id',null));
      }
      if(session.status!=='open'||!session.url)return fail('CHECKOUT_EXPIRED','This checkout has expired. Choose the pack again.',409);
      const checkoutUrl=new URL(session.url);
      if(checkoutUrl.protocol!=='https:'||checkoutUrl.hostname!=='checkout.stripe.com')throw new Error('PAYMENT_MISMATCH');
      return json({orderId:order.id,url:session.url});
    } catch(error) {
      const message=String((error as any)?.message||'');
      const known:Record<string,[number,string]>={INSUFFICIENT_COINS:[409,'Not enough Arcade Coins.'],REQUEST_REUSED:[409,'This request belongs to another purchase.'],
        PACK_NOT_FOUND:[404,'This pack is unavailable.'],WALLET_UNAVAILABLE:[409,'Open Account & Data to set up your coin wallet first.'],
        NO_PLAYS:[409,'No extra plays left for this game.'],INVALID_GAME:[400,'Choose a supported game.'],RATE_LIMITED:[429,'Too many checkout attempts. Try again later.'],
        PAYMENT_REVIEW:[409,'This payment needs review. Contact support.']};
      const code=Object.keys(known).find(code=>message.includes(code));
      if(code)return fail(code,known[code][1],known[code][0]);
      console.error('Coin commerce failed',(error as any)?.code||'unavailable'); // Never log tokens, raw events or card data.
      return fail('SERVER_ERROR','Could not complete this request. Please try again.',500);
    }
  };
}
