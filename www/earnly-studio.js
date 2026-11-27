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
  let sourceImage = '';
  let sourceSequence = 0;
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
    if (section === 'discover' && communityEnabled) loadFeed();
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
  const challenges = [
    ['Midnight at the diner','Spuddy sneaks into a moonlit diner to bake a birthday cake for the moon.'],
    ['A storm in a teacup','Spuddy sails a teacup across a puddle while a tiny storm cloud follows the boat.'],
    ['The last token','Spuddy rolls the last arcade token across the floor. A miniature city wakes up along its path.'],
    ['Cloud delivery','Spuddy delivers a misaddressed parcel to a cloud castle. The box starts to float.'],
    ['A bubble with a view','Spuddy explores a coral garden inside a floating bubble. A curious pufferfish follows.'],
    ['The gravity switch','Spuddy flips a switch in an arcade workshop. All the tools gently float to the ceiling.'],
    ['The tiny parade','Spuddy conducts a marching band of wind-up toys down a rainy cobblestone street.']
  ];
  function showChallenge() {
    const [title,prompt] = challenges[Math.floor(Date.now()/86400000) % challenges.length];
    byId('challengeTitle').textContent = title;
    byId('challengePrompt').textContent = prompt;
    byId('remixChallenge').onclick = () => {
      edit({prompt,kind:'video',ratio:'9:16',style:'Cartoon'}); location.hash = 'create';
    };
  }
  document.addEventListener('visibilitychange',() => { if (!document.hidden) showChallenge(); });
  showChallenge();

  let communityEnabled = false;
  let communitySequence = 0;
  let posts = [];
  function setCommunity(enabled) {
    const changed = communityEnabled !== enabled;
    communityEnabled = enabled;
    byId('community').hidden = !enabled;
    byId('closedCommunity').hidden = enabled;
    if (!enabled) {
      communitySequence++;
      posts = [];
      byId('communityFeed').replaceChildren();
      byId('feedFilter').value = '';
      byId('feedStatus').textContent = '';
    } else if (changed && byId('discover').hidden === false) loadFeed();
  }
  async function communityAction(operation,id,text) {
    if (!communityEnabled) throw Error('Community unavailable');
    const body = {action:'community',operation};
    if (id) body.id = id;
    if (text) body.text = text;
    const {data,error} = await window.EarnlyCloud.client.functions.invoke('earnly-studio',{body});
    if (error || data?.error || !data) throw Error('Community request failed');
    return data;
  }
  async function loadFeed() {
    if (!communityEnabled) return;
    const sequence = ++communitySequence;
    byId('feedStatus').textContent = 'Loading community creations…';
    try {
      const data = await communityAction(byId('feedType').value);
      if (communitySequence !== sequence) return;
      if (!Array.isArray(data.posts)) throw Error();
      posts = data.posts;
      byId('feedStatus').textContent = '';
      drawFeed();
    } catch {
      if (communitySequence !== sequence) return;
      posts = [];
      byId('feedStatus').textContent = 'The community feed could not load.';
      byId('communityFeed').replaceChildren(button('Try again',loadFeed));
    }
  }
  function postAction(label,operation,post) {
    const action = button(label,async () => {
      let text;
      if (operation === 'report') {
        text = window.prompt('What should our moderators review?')?.trim().slice(0,300);
        if (!text) return;
      }
      if (operation === 'comment') {
        text = window.prompt('Write a comment for moderation before it appears publicly.')?.trim().slice(0,280);
        if (!text) return;
      }
      if (operation === 'block' && !window.confirm('Block this creator and hide their community creations?')) return;
      action.disabled = true;
      try {
        await communityAction(operation,operation === 'block' ? post.creator : post.job_id,text);
        if (operation === 'report') tell('Report sent to the moderation team.');
        if (operation === 'comment') tell('Comment submitted for review.');
        await loadFeed();
      } catch { tell('Could not update the community. Please try again.'); }
      finally { action.disabled = false; }
    });
    return action;
  }
  function drawFeed() {
    const feed = byId('communityFeed');
    feed.replaceChildren();
    const query = byId('feedFilter').value.trim().toLowerCase();
    const matches = posts.filter(post => [post.title,post.username,post.prompt].join(' ').toLowerCase().includes(query));
    if (!matches.length) {
      feed.append(empty(query ? 'No matching creations in this feed.' : 'No published creations in this feed yet.'));
      return;
    }
    for (const post of matches) {
      const card = element('article'); card.className = 'card community-post';
      const byline = element('span',post.username || 'Studio creator'); byline.className = 'byline';
      card.append(byline,element('h3',post.title || (post.kind !== 'image' ? 'Untitled film' : 'Untitled image')));
      let mediaUrl;
      try { mediaUrl = new URL(post.url); } catch {}
      if (mediaUrl?.protocol === 'https:') {
        const media = element(post.kind !== 'image' ? 'video' : 'img');
        if (post.kind !== 'image') { media.controls = true; media.playsInline = true; media.preload = 'none'; }
        else { media.alt = post.title || 'Community artwork'; media.loading = 'lazy'; }
        media.src = mediaUrl.href; media.className = 'community-art'; card.append(media);
      }
      card.append(element('p',post.prompt));
      const actions = element('div'); actions.className = 'actions';
      actions.append(postAction((post.liked ? 'Unlike' : 'Like') + ' · ' + (post.likes || 0),post.liked ? 'unlike':'like',post),
        button('Remix',() => { edit({...post,ratio:post.ratio || '9:16'}); location.hash='create'; }));
      if (post.creator !== userId) {
        actions.append(postAction(post.following ? 'Unfollow' : 'Follow',post.following ? 'unfollow' : 'follow',post));
      }
      card.append(actions);
      const details = element('details');
      const comments = Array.isArray(post.comments) ? post.comments : [];
      details.append(element('summary','Comments · ' + comments.length));
      const list = element('ul');
      for (const comment of comments) list.append(element('li',(comment.username || 'Studio creator') + ' · ' + comment.body));
      details.append(list,postAction('Add comment','comment',post));
      card.append(details);
      if (post.creator !== userId) {
        const safety = element('details'); safety.append(element('summary','Report or block'));
        safety.append(postAction('Report creation','report',post),postAction('Block creator','block',post));
        card.append(safety);
      }
      feed.append(card);
    }
  }
  async function shareCommunity(job,operation) {
    if (operation === 'submit' && !window.confirm('Publish this creation, title, creator name and full prompt to the Studio community after review? Other creators can view and remix the prompt.')) return;
    if (operation === 'withdraw' && !window.confirm('Withdraw this creation and prompt from the community?')) return;
    try {
      await communityAction(operation,job.id);
      await refreshLibrary();
      tell(operation === 'submit' ? 'Submitted for community review.' : 'Community submission withdrawn.');
    } catch { tell('The publication request could not be completed.'); }
  }
  byId('feedFilter').addEventListener('input',drawFeed);
  byId('feedType').addEventListener('change',loadFeed);

  function canAnimate() {
    return integrated && online && available && Number.isSafeInteger(prices.animation) && prices.animation > 0;
  }
  function clearSource() {
    sourceSequence++;
    sourceImage = '';
    byId('sourceImage').value = '';
    byId('sourcePreview').removeAttribute('src'); byId('sourcePreview').hidden = true;
    byId('sourceStatus').textContent = 'Select original artwork. Reselect the JPEG when opening a saved draft.';
    byId('consent').checked = false;
  }
  byId('sourceImage').addEventListener('change',async event => {
    const file = event.target.files[0];
    const sequence = ++sourceSequence;
    sourceImage = ''; byId('consent').checked = false;
    byId('sourcePreview').hidden = true; byId('sourcePreview').removeAttribute('src'); refreshControls();
    if (!file) return;
    let url;
    try {
      if (file.type !== 'image/jpeg' || file.size > 12 * 1024 * 1024) throw Error();
      const header = new Uint8Array(await file.slice(0,3).arrayBuffer());
      if (header[0] !== 255 || header[1] !== 216 || header[2] !== 255) throw Error();
      url = URL.createObjectURL(file);
      const image = new Image(); image.src = url; await image.decode();
      if (sequence !== sourceSequence) return;
      const scale = Math.min(1,1280 / Math.max(image.naturalWidth,image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      for (const quality of [.84,.67,.45,.3]) {
        const data = canvas.toDataURL('image/jpeg',quality);
        const body = data.split(',')[1];
        if (!data.startsWith('data:image/jpeg;base64,') || Math.ceil(body.length*3/4) > 512*1024) continue;
        sourceImage = body;
        byId('sourcePreview').src = data; byId('sourcePreview').hidden = false;
        byId('sourceStatus').textContent = 'Reference ready · ' + canvas.width + ' × ' + canvas.height + '. Device drafts save the prompt only.';
        break;
      }
      if (!sourceImage) throw Error();
    } catch {
      if (sequence === sourceSequence) {
        clearSource(); byId('sourceStatus').textContent = 'Choose a smaller JPEG (up to 12 MB) and try again.';
      }
    } finally { if (url) URL.revokeObjectURL(url); refreshControls(); }
  });
  function editor() {
    return {prompt:byId('prompt').value.trim(), ratio:byId('ratio').value,
      style:byId('style').value, kind:document.querySelector('input[name=kind]:checked').value};
  }
  function edit(item, id = '') {
    draftId = id;
    byId('prompt').value = item.prompt;
    byId('ratio').value = item.ratio;
    byId('style').value = item.style || '';
    const kind = ['image','video','animation'].includes(item.kind) ? item.kind : 'video';
    document.querySelector('input[name=kind][value="' + (kind === 'animation' && !canAnimate() ? 'video' : kind) + '"]').checked = true;
    clearSource();
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
    byId('animationChoice').hidden = !canAnimate();
    if (!canAnimate() && editor().kind === 'animation') {
      document.querySelector('input[name=kind][value=video]').checked = true; clearSource();
    }
    const kind = editor().kind;
    byId('upload').hidden = kind !== 'animation';
    const style = byId('style').value;
    byId('prompt').maxLength = style ? 1200 - (style + ' style. ').length : 1200;
    const cost = prices[kind];
    byId('format').textContent = kind === 'image' ? 'Still image' : '5 seconds · Preview';
    byId('cost').textContent = Number.isSafeInteger(cost) && cost > 0 ? cost + ' Studio Credits' : 'Quote unavailable';
    const eligible = available && online && Number.isSafeInteger(cost) && cost > 0;
    byId('generate').disabled = !eligible || !byId('consent').checked || submitting || credits < cost || (kind === 'animation' && !sourceImage);
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
      card.append(element('small', (row.kind === 'image' ? 'Image' : row.kind === 'animation' ? 'Animation' : 'Video') + ' · ' + row.ratio),
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
          const media = element(job.kind !== 'image' ? 'video' : 'img');
          if (job.kind !== 'image') { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
          else { media.alt = job.prompt; media.loading = 'lazy'; }
          media.src = mediaUrl.href;
          const download = element('a', 'Open original ↗');
          download.href = mediaUrl.href; download.target = '_blank'; download.rel = 'noopener noreferrer';
          opts.append(button('Save or share file', () => saveMedia(job, mediaUrl.href)), download);
          card.insertBefore(media, opts);
        }
      }
      if (communityEnabled && job.state === 'ready') {
        const submitted = ['pending','review','published','approved'].includes(job.publication);
        opts.append(button(submitted ? 'Withdraw from community' : 'Publish to community',
          () => shareCommunity(job,submitted ? 'withdraw' : 'submit')));
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
      const newlyReady=data.jobs.filter(job=>job.state==='ready'&&jobs.some(old=>old.id===job.id&&old.state!=='ready'));
      online = true; available = data.enabled === true; credits = data.credits; jobs = data.jobs;
      if(newlyReady.length)tell('Your creation is ready in My Library.');
      setCommunity(data.community === true);
      prices = data.prices || {}; admin = data.admin === true; adOffer = data.adOffer === true;
      accountMessage = available ? '' : 'Generation is currently paused. Your existing jobs remain in My Library.';
    } catch {
      if (sequence !== librarySequence) return;
      online = false; available = false; credits = null; jobs = []; prices = {}; setCommunity(false);
      accountMessage = 'Studio generation is unavailable for this account. You can still save device drafts.';
    }
    refreshControls(); renderLibrary();
  }
  async function accountChanged() {
    try {
      const current = await window.EarnlyCloud?.user();
      if (userId !== (current?.id || '')) {
        const previous=byId('sandboxStore'),container=previous.cloneNode(false);
        previous.replaceWith(container);
        if(current?.app_metadata?.studio_billing_tester)import('./earnly-studio-billing.js').then(m=>m.openSandboxStore(container,current)).catch(()=>{container.textContent='Sandbox storefront unavailable.';});
        clearSource(); userId = current?.id || ''; draftId = ''; adOffer = false; adTicket = null; byId('rewardStatus').textContent = ''; pendingRequest = null; jobs = []; credits = null;
        librarySequence++; setCommunity(false); online = false; available = false; prices = {}; byId('consent').checked = false;
      }
      if (userId) await refreshLibrary();
      else { accountMessage = 'You can save drafts on this device. Generation requires an eligible Earnly account.'; refreshControls(); renderLibrary(); }
    } catch { accountMessage = 'Account connection unavailable. Device drafts are available.'; refreshControls(); }
  }
  byId('composer').addEventListener('input', event => {
    if (event.target.name === 'kind' && event.target.value !== 'animation') clearSource();
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
    const imagePayload = kind === 'animation' ? sourceImage : '';
    const bytes = new TextEncoder().encode(JSON.stringify([userId,styled,ratio,kind,imagePayload]));
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
        body:{action:'generate',expected_credits:prices[kind],prompt:styled,ratio,kind,request_id:pendingRequest.id,consent_version:'2026-11-27',...(kind === 'animation' ? {image_base64:imagePayload} : {})}
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
