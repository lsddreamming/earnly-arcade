(()=>{
  const byId=id=>document.getElementById(id);
  const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  const money=m=>'$'+(m/1000000).toFixed(3);
  async function call(body){
    const {data,error}=await window.EarnlyCloud.client.functions.invoke('earnly-studio',{body});
    if(error||data.error)throw Error('Admin request unavailable. Check your Earnly account and connection.');
    return data;
  }
  async function refresh(){
    try{
      const {config,totals,jobs}=await call({action:'admin'});
      byId('panel').hidden=false;
      byId('message').textContent=config.enabled?'Pilot enabled':'Paid generation paused';
      const metrics=byId('metrics');
      metrics.replaceChildren();
      for(const [label,value] of Object.entries({
        'Today · maximum exposure':money(totals.day_micro)+' / '+money(config.daily_limit),
        'Month · maximum exposure':money(totals.month_micro)+' / '+money(config.monthly_limit),
        'Lifetime · maximum exposure':money(totals.lifetime_micro)+' / $25',
        'Image / video requests':totals.images+' / '+totals.videos,
        'Failed / uncertain':totals.failed+' / '+totals.uncertain,
        'Revenue and provider balance':'Awaiting verified reporting'
      })) metrics.append(el('dt',label),el('dd',value));
      const queue=byId('queue');queue.replaceChildren();
      if(!jobs.length)queue.append(el('p','No creations awaiting review.'));
      for(const job of jobs){
        const article=el('article','');
        article.append(el('h3',job.state),el('p',job.prompt));
        if(job.url){const media=document.createElement(job.kind==='video'?'video':'img');media.src=job.url;media.controls=true;article.append(media);}
        if(job.state!=='uncertain')for(const action of ['approve','reject']){
          const b=el('button',action==='approve'?'Approve':'Reject and refund');b.onclick=()=>mutate({action,id:job.id,stage:job.state});article.append(b);
        }
        queue.append(article);
      }
    }catch(error){byId('panel').hidden=true;byId('message').textContent=error.message;}
  }
  async function mutate(body){try{await call(body);await refresh();}catch(error){byId('message').textContent=error.message;}}
  byId('pause').onclick=()=>mutate({action:'pause'});byId('refresh').onclick=refresh;refresh();
})();
