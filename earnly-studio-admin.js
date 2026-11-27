(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const el = (tag,text) => { const node=document.createElement(tag); if (text != null) node.textContent=text; return node; };
  const money = micro => '$' + (micro/1000000).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6});
  const settings = {
    daily_limit:{label:'Daily spending limit',dollars:true,max:25},
    monthly_limit:{label:'Monthly spending limit',dollars:true,max:25},
    fal_limit:{label:'fal spending limit',dollars:true,max:25},
    daily_jobs:{label:'Daily jobs across Studio',max:200},
    user_jobs:{label:'Daily jobs per user',max:50},
    concurrent_jobs:{label:'Concurrent jobs',max:8}
  };
  let config;
  let sequence = 0;
  async function call(body) {
    const {data,error} = await window.EarnlyCloud.client.functions.invoke('earnly-studio',{body});
    if (error || !data || data.error) throw Error('Studio could not complete this request. Check your account or refresh.');
    return data;
  }
  function btn(label,body) {
    const button=el('button',label);
    button.type='button';
    button.onclick=async () => {button.disabled=true; try {await mutate(body);} finally {button.disabled=false;}};
    return button;
  }
  function media(url,video,alt) {
    let href;
    try {href=new URL(url);} catch {return null;}
    if (href.protocol!=='https:') return null;
    const node=el(video?'video':'img');
    if (video) {node.controls=true;node.playsInline=true;node.preload='metadata';}
    else {node.alt=alt;node.loading='lazy';}
    node.src=href.href;
    return node;
  }
  function article(title,body) {
    const node=el('article');node.className='card';
    node.append(el('h3',title),el('p',body));
    return node;
  }
  function reviewButtons(node,target,id) {
    const actions=el('div');actions.className='actions';
    for (const approve of [true,false]) {
      actions.append(btn(approve?'Approve for publication':'Reject',{action:'moderate_community',target,id,approve}));
    }
    node.append(actions);
  }
  function renderCommunity({posts,comments,reports}) {
    const queue=byId('publicQueue');queue.replaceChildren();
    if (!posts.length && !comments.length && !reports.length) queue.append(el('p','No community items awaiting review.'));
    for (const post of posts) {
      const node=article('Publication request',post.prompt);
      const preview=media(post.url,post.kind!=='image','Submission for publication');
      if (preview) node.append(preview);
      reviewButtons(node,'post',post.id);queue.append(node);
    }
    for (const comment of comments) {
      const node=article('Comment for review',comment.body);
      node.append(el('small','Creation '+comment.job_id));
      reviewButtons(node,'comment',comment.id);queue.append(node);
    }
    for (const report of reports) {
      const node=article('Reported creation',report.reason);
      node.append(el('small','Creation '+report.job_id+' · Reporter '+report.user_id));
      node.append(btn('Remove post from discovery',{action:'moderate_community',target:'post',id:report.job_id,approve:false}));
      queue.append(node);
    }
  }
  function renderLimits() {
    const field=byId('setting').value;
    const setting=settings[field];
    byId('limitLabel').textContent=setting.dollars?'New limit in USD':'New job limit';
    const input=byId('value');input.min=0;input.max=setting.max;input.step=setting.dollars?'0.000001':'1';
    input.value=config?.[field] == null ? '' : config[field]/(setting.dollars?1000000:1);
  }
  for (const [field,setting] of Object.entries(settings)) {
    const option=el('option',setting.label);option.value=field;byId('setting').append(option);
  }
  byId('setting').onchange=renderLimits;
  byId('limits').onsubmit=async event => {
    event.preventDefault();
    const field=byId('setting').value,setting=settings[field];
    const value=Math.round(byId('value').valueAsNumber*(setting.dollars?1000000:1));
    if (!Number.isSafeInteger(value) || value<0 || !byId('limits').reportValidity()) return;
    const submit=byId('limits').querySelector('button');submit.disabled=true;
    try {await mutate({action:'limits',setting:field,value});} finally {submit.disabled=false;}
  };
  async function refresh() {
    const current=++sequence;
    try {
      const result=await call({action:'admin'});
      if (current!==sequence) return;
      config=result.config;
      const {totals,jobs}=result;
      const models=byId('models');models.replaceChildren();
      for(const model of result.models){
        const form=el('form');form.className='actions';
        const label=el('label',model.kind+' credits '),count=el('input');
        count.type='number';count.min='1';count.max='10000';count.required=true;count.value=model.credits;label.append(count);
        const enabled=el('input');enabled.type='checkbox';enabled.checked=model.enabled;
        const active=el('label','Available ');active.append(enabled);
        const save=el('button','Save');form.append(label,active,save);
        form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await mutate({action:'model',kind:model.kind,credits:count.valueAsNumber,enabled:enabled.checked});}finally{save.disabled=false;}};
        models.append(form);
      }
      byId('panel').hidden=false;
      byId('message').textContent=config.enabled?'Pilot enabled':'Paid generation paused';
      const metrics=byId('metrics');metrics.replaceChildren();
      for (const [label,value] of Object.entries({
        'Today · maximum exposure':money(totals.day_micro)+' / '+money(config.daily_limit),
        'Month · maximum exposure':money(totals.month_micro)+' / '+money(config.monthly_limit),
        'Lifetime · maximum exposure':money(totals.lifetime_micro)+' / $25',
        'Reconciled provider charges':totals.billed_micro==null?'No provider billing events':money(totals.billed_micro),
        'Requests awaiting billing records':totals.unreconciled,
        'Image / video requests':totals.images+' / '+totals.videos,
        'Failed / uncertain':totals.failed+' / '+totals.uncertain,
        'Provider prepaid balance':config.balance_micro==null?'Unverified':money(config.balance_micro)+' · '+new Date(config.balance_checked_at).toLocaleString(),
        'Revenue':'Live billing closed'
      })) metrics.append(el('dt',label),el('dd',value));
      renderLimits();
      const queue=byId('queue');queue.replaceChildren();
      if (!jobs.length) queue.append(el('p','No creations awaiting review.'));
      for (const job of jobs) {
        const node=article(job.state,job.prompt);
        if (job.reference_url) {
          const source=media(job.reference_url,false,'Original animation reference to review');
          if (source) node.append(el('p','Animation reference'),source);
        }
        const output=media(job.url,job.kind!=='image','Generated output for review');
        if (output) node.append(el('p','Generated output'),output);
        if (job.state!=='uncertain') {
          const actions=el('div');actions.className='actions';
          for (const action of ['approve','reject']) actions.append(btn(action==='approve'?'Approve':'Reject and refund',{action,id:job.id,stage:job.state}));
          node.append(actions);
        }
        queue.append(node);
      }
      byId('publicQueue').textContent='Loading community review…';
      try {
        const community=await call({action:'community_queue'});
        if (current===sequence) renderCommunity(community);
      } catch { if (current===sequence) byId('publicQueue').textContent='Community review is unavailable.'; }
    } catch (error) {
      if (current!==sequence) return;
      byId('panel').hidden=true;byId('message').textContent=error.message;
    }
  }
  async function mutate(body) {
    try {await call(body);await refresh();}
    catch (error) {byId('message').textContent=error.message;}
  }
  byId('pause').onclick=()=>mutate({action:'pause'});
  byId('refresh').onclick=refresh;
  refresh();
})();
