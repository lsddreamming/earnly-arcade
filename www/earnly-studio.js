(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const studioSections = ['discover', 'create', 'library', 'premium'];
  const integrated = ['earnlyarcade.com', 'www.earnlyarcade.com'].includes(location.hostname) ||
    (location.protocol === 'capacitor:' && location.hostname === 'localhost');
  const starters = [
    ['After hours', 'Cinematic', 'game-preview-neon-drift.webp', 'A driverless toy racer glides around an empty neon arcade. The camera follows its reflection in the polished floor.'],
    ['Mooncake mishap', 'Comedy', 'game-preview-spuds-kitchen.webp', 'Spuddy flips a pancake in a tiny diner. It sails through the skylight and a sleepy moon takes a bite.'],
    ['Cosmic Spuddy', 'Fantasy', 'game-preview-spuddy-evolution.webp', 'A potato superhero opens a violet portal in a mushroom forest. Tiny floating lanterns follow him through.']
  ];
  const jobLabels = {
    review:'Awaiting prompt review', queued:'Queued', dispatching:'Sending to provider',
    submitted:'Generating', output_review:'Awaiting media review', ready:'Ready',
    failed:'Failed · credits refunded', uncertain:'Checking provider receipt'
  };
  let userId = '';
  let online = false;
  let available = false;
  let credits = null;
  let jobs = [];
  let submitting = false;
  let draftId = '';
  let librarySequence = 0;
  let noticeTimer;
  let pendingRequest = null;
  let accountMessage = '';
  let prices = {};
  let admin = false;
  let adOffer = false;
  let adTicket = null;
  let adBusy = false;
  function tell(message) {
    clearTimeout(noticeTimer);
    byId('notice').textContent = message;
    noticeTimer = setTimeout(() => { byId('notice').textContent = ''; }, 5000);
  }
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  }
  function button(text, handler) {
    const node = element('button', text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }
  function navigate() {
    const section = studioSections.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'discover';
    for (const name of studioSections) byId(name).hidden = name !== section;
    for (const link of document.querySelectorAll('nav a')) {
      if (link.hash === '#' + section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (section === 'library') {
      renderLibrary();
      if (userId) refreshLibrary();
    }
    window.scrollTo(0, 0);
  }
  for (const [title, style, art, prompt] of starters) {
    const item = button('', () => {
      edit({prompt, kind:'video', ratio:'9:16', style});
      location.hash = 'create';
    });
    item.className = 'starter';
    const image = element('img');
    image.src = art;
    image.alt = '';
    image.loading = 'lazy';
    const copy = element('span');
    copy.className = 'starter-copy';
    copy.append(element('small', style), element('b', title));
    item.append(image, copy);
    byId('starters').append(item);
  }
  function editor() {
    return {prompt:byId('prompt').value.trim(), ratio:byId('ratio').value,
      style:byId('style').value, kind:document.querySelector('input[name=kind]:checked').value};
  }
  function edit(item, id = '') {
    draftId = id;
    byId('prompt').value = item.prompt;
    byId('ratio').value = item.ratio;
    byId('style').value = item.style || '';
    document.querySelector('input[name=kind][value="' + (item.kind === 'image' ? 'image' : 'video') + '"]').checked = true;
    byId('consent').checked = false;
    refreshControls();
  }
  function readDrafts() {
    try {
      const rows = JSON.parse(localStorage.getItem('earnlyStudioDrafts:' + userId) || '[]');
      return Array.isArray(rows) ? rows.filter(row => row && typeof row.id === 'string' && typeof row.prompt === 'string') : [];
    } catch { return []; }
  }
  function writeDrafts(drafts) {
    try { localStorage.setItem('earnlyStudioDrafts:' + userId, JSON.stringify(drafts)); return true; }
    catch { tell('Device storage is unavailable. Copy your prompt before leaving.'); return false; }
  }
  byId('save').addEventListener('click', () => {
    const data = editor();
    if (!data.prompt) { byId('prompt').setCustomValidity('Write a prompt to save.'); byId('prompt').reportValidity(); return; }
    const rows = readDrafts();
    const previous = rows.find(row => row.id === draftId);
    const id = previous?.id || crypto.randomUUID();
    const row = {...data, id, title:previous?.title || data.prompt.slice(0,55), updated:new Date().toISOString()};
    if (!writeDrafts([row, ...rows.filter(item => item.id !== id)])) return;
    draftId = id;
    location.hash = 'library';
    renderLibrary();
    tell('Draft saved on this device.');
  });
  function refreshControls() {
    const kind = editor().kind;
    const style = byId('style').value;
    byId('prompt').maxLength = style ? 1200 - (style + ' style. ').length : 1200;
    const cost = prices[kind];
    byId('format').textContent = kind === 'video' ? '5 seconds · Preview' : 'Still image';
    byId('cost').textContent = Number.isSafeInteger(cost) && cost > 0 ? cost + ' Studio Credits' : 'Quote unavailable';
    const eligible = available && online && Number.isSafeInteger(cost) && cost > 0;
    byId('generate').disabled = !eligible || !byId('consent').checked || submitting || credits < cost;
    byId('generate').textContent = submitting ? 'Requesting…' : 'Generate';
    byId('consentRow').hidden = !eligible;
    byId('save').textContent = draftId ? 'Save changes' : 'Save draft';
    byId('availability').textContent = eligible ? 'Private generation. You can leave Studio after your request is accepted.' :
      accountMessage || 'Drafts are saved on this device. AI generation is closed during this preview.';
    byId('balance').textContent = online ? 'Studio balance · ' + credits + ' credits' : '';
    byId('refresh').hidden = !userId;
    byId('admin').hidden = !online || !admin;
    byId('reward').hidden = !(online && adOffer && window.EarnlyNativeAds?.isNative && !window.EarnlyNativeAds.testMode);
    byId('offer').hidden = !!adTicket;
    byId('offer').disabled = adBusy;
    byId('rewardTerms').hidden = !adTicket;
    byId('watch').disabled = byId('cancelAd').disabled = adBusy;
  }
  function empty(text) { const node = element('p', text); node.className = 'empty'; return node; }
  async function saveMedia(job, url) {
    try {
      const response = await fetch(url, {credentials:'omit',referrerPolicy:'no-referrer'});
      if (!response.ok) throw Error();
      const blob = await response.blob();
      const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[blob.type.split(';')[0]];
      if (!ext) throw Error();
      const file = new File([blob], 'earnly-studio-' + job.id + '.' + ext,{type:blob.type});
      if (navigator.canShare?.({files:[file]})) {
        await navigator.share({files:[file],title:job.title || 'Earnly Studio creation'});
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = file.name;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href),60000);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') tell('The file could not be saved. Refresh My Library and try again.');
    }
  }
  async function manageJob(job, action) {
    const body = {action,id:job.id};
    if (action === 'rename') {
      const name = window.prompt('Creation title',job.title || '')?.trim();
      if (!name) return;
      body.title = name.slice(0,80);
    } else if (!window.confirm('Delete this creation from your library and remove its media?')) return;
    try {
      const {data,error} = await window.EarnlyCloud.client.functions.invoke('earnly-studio',{body});
      if (error || data?.error) throw Error();
      await refreshLibrary();
      tell(action === 'rename' ? 'Title updated.' : 'Creation deleted.');
    } catch { tell('Could not update this creation. Refresh My Library and try again.'); }
  }
  byId('offer').addEventListener('click',async () => {
    if (byId('reward').hidden || adBusy) return;
    adBusy = true; refreshControls();
    const owner = userId;
    try {
      const {data,error} = await window.EarnlyCloud.client.functions.invoke('earnly-studio',{body:{action:'ad_ticket'}});
      if (error || !data?.ticket || !Number.isInteger(data.credits) || data.credits < 1) throw Error();
      if (owner !== userId) return;
      adTicket = {...data,owner};
      byId('rewardDescription').textContent = 'Finish one rewarded ad for ' + data.credits +
        (data.credits === 1 ? ' nontransferable Studio Credit.' : ' nontransferable Studio Credits.');
      byId('rewardStatus').textContent = '';
    } catch { byId('rewardStatus').textContent = 'A reward is unavailable right now.'; }
    finally { adBusy = false; refreshControls(); }
  });
  byId('cancelAd').addEventListener('click',() => { adTicket = null; refreshControls(); });
  byId('watch').addEventListener('click',async () => {
    if (!adTicket || adBusy || adTicket.owner !== userId || byId('reward').hidden) return;
    adBusy = true; refreshControls();
    try {
      const result = await window.EarnlyNativeAds.showStudioReward(adTicket);
      byId('rewardStatus').textContent = result?.presented ?
        'Your balance updates after Earnly verifies the completed ad.' : 'The ad could not be shown.';
      await refreshLibrary();
    } catch { byId('rewardStatus').textContent = 'Ad unavailable. Check your Studio balance before trying again.'; }
    finally { adTicket = null; adBusy = false; refreshControls(); }
  });
  function renderLibrary() {
    const drafts = byId('drafts');
    drafts.replaceChildren();
    for (const row of readDrafts()) {
      const card = element('article'); card.className = 'card';
      const options = element('div'); options.className = 'actions';
      options.append(button('Edit', () => { edit(row, row.id); location.hash = 'create'; }),
        button('Remix', () => { edit(row); location.hash = 'create'; }),
        button('Rename', () => {
          const name = window.prompt('Draft title', row.title || '')?.trim().slice(0,80);
          if (name && writeDrafts(readDrafts().map(item => item.id === row.id ? {...item,title:name} : item))) renderLibrary();
        }),
        button('Delete', () => {
          if (!window.confirm('Delete this device draft?')) return;
          if (writeDrafts(readDrafts().filter(item => item.id !== row.id))) {
            if (draftId === row.id) draftId = '';
            refreshControls(); renderLibrary(); tell('Draft deleted.');
          }
        }));
      card.append(element('small', (row.kind === 'video' ? 'Video' : 'Image') + ' · ' + row.ratio),
        element('h3', row.title), element('p', row.prompt), options);
      drafts.append(card);
    }
    if (!drafts.childElementCount) drafts.append(empty('Saved prompts will appear here on this device.'));
    const list = byId('jobs');
    list.replaceChildren();
    for (const job of jobs) {
      const card = element('article'); card.className = 'card';
      const opts = element('div'); opts.className = 'actions';
      opts.append(button('Remix prompt', () => { edit(job); location.hash = 'create'; }));
      card.append(element('small', job.kind + ' · ' + (jobLabels[job.state] || 'Pending')), element('p', job.prompt), opts);
      if (job.state === 'ready' && typeof job.url === 'string') {
        let mediaUrl;
        try { mediaUrl = new URL(job.url); } catch {}
        if (mediaUrl?.protocol === 'https:') {
          const media = element(job.kind === 'video' ? 'video' : 'img');
          if (job.kind === 'video') { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
          else { media.alt = job.prompt; media.loading = 'lazy'; }
          media.src = mediaUrl.href;
          const download = element('a', 'Open original ↗');
          download.href = mediaUrl.href; download.target = '_blank'; download.rel = 'noopener noreferrer';
          opts.append(button('Save or share file', () => saveMedia(job, mediaUrl.href)), download);
          card.insertBefore(media, opts);
        }
      }
      if (job.title) card.insertBefore(element('h3',job.title),card.children[1]);
      if (['ready','failed'].includes(job.state)) {
        opts.append(button('Rename creation',() => manageJob(job,'rename')),button('Delete creation',() => manageJob(job,'delete')));
      }
      list.append(card);
    }
    if (!list.childElementCount) list.append(empty(online ? 'Your submitted jobs will appear here.' :
      accountMessage || 'AI generation is closed during this preview. Explore your drafts below.'));
  }
  async function refreshLibrary() {
    if (!userId) return;
    const sequence = ++librarySequence;
    try {
      const {data,error} = await window.EarnlyCloud.client.functions.invoke('earnly-studio', {body:{action:'library'}});
      if (sequence !== librarySequence) return;
      if (error || !Array.isArray(data?.jobs) || !Number.isSafeInteger(data.credits)) throw Error();
      online = true; available = data.enabled === true; credits = data.credits; jobs = data.jobs;
      prices = data.prices || {}; admin = data.admin === true; adOffer = data.adOffer === true;
      accountMessage = available ? '' : 'Generation is currently paused. Your existing jobs remain in My Library.';
    } catch {
      if (sequence !== librarySequence) return;
      online = false; available = false; credits = null; jobs = []; prices = {};
      accountMessage = 'Studio generation is unavailable for this account. You can still save device drafts.';
    }
    refreshControls(); renderLibrary();
  }
  async function accountChanged() {
    try {
      const current = await window.EarnlyCloud?.user();
      if (userId !== (current?.id || '')) {
        userId = current?.id || ''; draftId = ''; adOffer = false; adTicket = null; byId('rewardStatus').textContent = ''; pendingRequest = null; jobs = []; credits = null;
        librarySequence++; online = false; available = false; prices = {}; byId('consent').checked = false;
      }
      if (userId) await refreshLibrary();
      else { accountMessage = 'You can save drafts on this device. Generation requires an eligible Earnly account.'; refreshControls(); renderLibrary(); }
    } catch { accountMessage = 'Account connection unavailable. Device drafts are available.'; refreshControls(); }
  }
  byId('composer').addEventListener('input', () => {
    byId('prompt').setCustomValidity('');
    refreshControls();
  });
  byId('composer').addEventListener('submit', async event => {
    event.preventDefault();
    if (byId('generate').disabled || !userId) return;
    const {prompt,ratio,style,kind} = editor();
    if (!prompt) return;
    const styled = style ? style + ' style. ' + prompt : prompt;
    if (styled.length > 1200) { tell('Shorten the prompt to fit the selected style.'); return; }
    submitting = true; refreshControls();
    const bytes = new TextEncoder().encode(JSON.stringify([userId,styled,ratio,kind]));
    const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
      byte => byte.toString(16).padStart(2,'0')).join('');
    const requestKey = 'earnlyStudioPending:' + signature;
    if (pendingRequest?.signature !== signature) {
      let saved;
      try { saved = sessionStorage.getItem(requestKey); } catch {}
      pendingRequest = {signature,id:saved || crypto.randomUUID()};
    }
    try { sessionStorage.setItem(requestKey,pendingRequest.id); } catch {}
    try {
      const {error,data} = await window.EarnlyCloud.client.functions.invoke('earnly-studio', {
        body:{action:'generate',prompt:styled,ratio,kind,request_id:pendingRequest.id,consent_version:'2026-11-27'}
      });
      if (error || data?.error || !data) throw Error();
      try { sessionStorage.removeItem(requestKey); } catch {}
      pendingRequest = null; byId('consent').checked = false;
      location.hash = 'library'; tell('Request accepted. Follow it in My Library.');
    } catch { tell('Could not confirm the request. Check My Library before retrying.'); }
    finally { submitting = false; await refreshLibrary(); refreshControls(); }
  });
  byId('refresh').addEventListener('click', refreshLibrary);
  document.querySelector('#library .section-head a').addEventListener('click', () => edit({prompt:'',ratio:'9:16',kind:'video'}));
  window.addEventListener('hashchange', navigate);
  function loadScript(src) {
    return new Promise((resolve,reject) => {
      const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
  }
  async function connect() {
    if (!integrated) return;
    document.querySelector('.arcade').href = 'index.html';
    try {
      if (!window.EarnlyCloud) {
        if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4');
        await loadScript('cloud.js');
      }
      window.addEventListener('earnly-cloud-auth-change', accountChanged);
      await accountChanged();
      if (location.protocol === 'capacitor:' && !window.EarnlyNativeAds) {
        try { await loadScript('native-ads.js'); refreshControls(); } catch {}
      }
      window.setInterval(() => {
        const watching = Array.from(byId('jobs').querySelectorAll('video')).some(video => !video.paused);
        if (!document.hidden && !watching && userId && ['#library','#premium'].includes(location.hash)) refreshLibrary();
      }, 15000);
    } catch { accountMessage = 'Account connection unavailable. Device drafts are available.'; refreshControls(); }
  }
  refreshControls(); navigate(); connect();
})();
