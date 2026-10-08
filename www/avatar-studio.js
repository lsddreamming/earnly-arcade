/* API-backed UI. Browser storage never decides balances or ownership. */
(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    items: [],
    user: null,
    slot: "avatar",
    auth: null,
    config: null,
    busy: false,
    pending: null,
    profileSequence: 0,
    refreshSequence: 0,
    authEpoch: 0,
    preview: {},
    freeOnly: false,
    ownedOnly: false,
    search: "",
    affordableOnly: false,
    sort: "featured",
  };
  const apiBase = window.EARNLY_AVATAR_API || "";
  const fmt = (value) => BigInt(value ?? 0).toLocaleString();
  const slots = ["avatar", "outfit", "shoes", "backpack", "face", "beard", "head", "weapon"];
  const layers = ["backpack", "avatar", "outfit", "shoes", "face", "beard", "head", "weapon"];
  const prettySlot = { avatar: "Avatar", outfit: "Outfit", shoes: "Shoes", backpack: "Backpack", face: "Facewear", beard: "Beard", head: "Headwear", weapon: "Weapon" };
  function el(tag, classes, text) {
    const node = document.createElement(tag);
    if (classes) node.className = classes;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function image(item) {
    const img = el("img");
    img.src = new URL(item.imageUrl, location.href).href;
    img.alt = item.name;
    return img;
  }
  function status(message, error = false) {
    $("status").textContent = message;
    $("status").className = error ? "error" : "";
  }
  function starterLoadout() {
    return Object.fromEntries(
      slots.map((slot) => [
        slot,
        state.items.find((i) => i.slot === slot && i.isStarter) || state.items.find((i) => i.slot === slot && i.coinPrice === 0),
      ]),
    );
  }
  function character(equipped) {
    const root = el("div", "character");
    for (const slot of layers)
      if (equipped[slot]) root.append(image(equipped[slot]));
    return root;
  }
  function summary(root, equipped) {
    root.replaceChildren();
    for (const slot of slots) {
      const row = el("div");
      row.append(
        el("dt", "", prettySlot[slot]),
        el("dd", "", equipped[slot]?.name || "—"),
      );
      root.append(row);
    }
  }
  async function api(path, { method = "GET", body, key } = {}) {
    const headers = {};
    if (state.auth) {
      const { data, error } = await state.auth.auth.getSession();
      if (error) throw error;
      if (data.session)
        headers.Authorization = "Bearer " + data.session.access_token;
    }
    if (body) headers["Content-Type"] = "application/json";
    if (key) headers["Idempotency-Key"] = key;
    const response = await fetch(apiBase + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({
      error: { message: "The server returned an unexpected response." },
    }));
    if (!response.ok) {
      const error = new Error(
        data.error?.message || "Could not complete this request.",
      );
      error.code = data.error?.code;
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function renderUser() {
    const user = state.user,
      saved = user?.equipped || starterLoadout(),
      equipped = { ...saved, ...state.preview };
    $("coin-balance").textContent = user ? fmt(user.coins) : "—";
    $("nav-name").textContent = user ? "@" + user.username : "Guest";
    if (equipped.avatar) {
      $("nav-avatar").replaceChildren(character(saved));
      $("character-name").textContent = equipped.avatar.name;
      $("character-rarity").textContent = equipped.avatar.rarity;
      $("character-rarity").className = "badge " + equipped.avatar.rarity;
    }
    $("character-stage").replaceChildren(character(equipped));
    $("character-owner").textContent = user
      ? "@" + user.username
      : "Sign in to save your look";
    summary($("loadout-summary"), equipped);
    $("preview-note").textContent = Object.keys(state.preview).length ? "Preview only · your saved look is unchanged" : "Your saved look";
    $("reset-preview").hidden = !Object.keys(state.preview).length;
    $("my-profile").disabled = !user;
    $("my-profile").setAttribute("aria-label", user ? "Open @" + user.username + " profile" : "Player profile");
    $("view-profile").disabled = !user;
    $("auth-button").textContent = user ? "Sign out" : "Sign in";
    $("owned-count").textContent = user ? user.inventory.length + " owned" : "";
    renderLooks();
    renderShop();
  }
  function renderShop() {
    renderPreviewActions();
    $("shop-grid").replaceChildren();
    const filtered = state.items.filter(i =>
      (state.search || i.slot === state.slot) &&
      (!state.freeOnly || i.coinPrice === 0) &&
      (!state.ownedOnly || state.user?.inventory.includes(i.id)) &&
      (!state.affordableOnly || !state.user || state.user.inventory.includes(i.id) || BigInt(i.coinPrice) <= BigInt(state.user.coins)) &&
      (i.name + " " + prettySlot[i.slot]).toLowerCase().includes(state.search));
    if (state.sort === "price") filtered.sort((a,b) => a.coinPrice - b.coinPrice || a.name.localeCompare(b.name));
    if (state.sort === "name") filtered.sort((a,b) => a.name.localeCompare(b.name));
    $("shop-result-count").textContent = filtered.length + " " + (filtered.length === 1 ? "item" : "items") + (state.search ? " across all categories" : " in this category");
    $("affordable-only").disabled = !state.user;
    $("affordable-help").textContent = state.user ? "Your balance: " + fmt(state.user.coins) + " coins" : "Sign in to filter by your balance";
    for (const item of filtered) {
      const owned = state.user?.inventory.includes(item.id),
        equipped = state.user?.equipped[item.slot]?.id === item.id;
      const card = el("article", "item-card " + item.rarity),
        art = el("div", "item-art");
      card.classList.toggle("is-equipped", !!equipped);
      card.classList.toggle("is-owned", !!owned);
      art.dataset.slot = item.slot;
      art.append(
        character({ ...(state.user?.equipped || starterLoadout()), [item.slot]: item }),
        el("span", "badge " + item.rarity, item.coinPrice === 0 ? "FREE" : item.rarity.toUpperCase()),
      );
      const button = el(
        "button",
        equipped ? "equipped" : owned ? "" : "buy",
        equipped
          ? "Equipped"
          : owned
            ? "Equip"
            : item.coinPrice === 0
              ? "Free · use"
              : "◈ " + fmt(item.coinPrice) + " · Buy",
      );
      button.type = "button";
      button.disabled = !!equipped || state.busy;
      button.dataset.itemId = item.id;
      button.setAttribute(
        "aria-label",
        (equipped ? "Equipped" : owned ? "Equip" : "Buy") + " " + item.name,
      );
      button.addEventListener("click", () => chooseItem(item));
      const preview = el("button", "preview-item", "Try on");
      preview.type = "button";
      preview.dataset.previewItemId = item.id;
      preview.setAttribute("aria-label", "Preview " + item.name);
      preview.addEventListener("click", () => { state.preview[item.slot] = item; renderUser(); showPreview(item.id); });
      card.append(
        art,
        el("h3", "", item.name),
        el("p", "", prettySlot[item.slot] + " · " + item.rarity),
        el("p", "item-ownership", equipped ? "✓ Equipped" : owned ? "✓ Owned · equip anytime" : item.coinPrice === 0 ? "Free essential" : "◈ " + fmt(item.coinPrice) + " coins"),
        preview,
        button,
      );
      $("shop-grid").append(card);
    }
    if (!filtered.length) {
      const empty = el("div", "shop-empty");
      empty.append(el("h3", "", "Your next look is still here."), el("p", "collection-note", "Try another name or clear your filters to explore the collection."));
      const reset = el("button", "subtle", "Clear search & filters");
      reset.type = "button";
      reset.addEventListener("click", () => {
        state.search = ""; state.freeOnly = false; state.ownedOnly = false; state.affordableOnly = false;
        $("shop-search").value = "";
        for (const id of ["free-only", "owned-only", "affordable-only"]) $(id).checked = false;
        renderShop(); $("shop-search").focus({preventScroll:true});
      });
      empty.append(reset); $("shop-grid").append(empty);
    }
  }
  function chooseItem(item) {
    if (state.busy) return;
    if (!state.user) { $("auth-modal").showModal(); return; }
    if (state.user.inventory.includes(item.id)) { equip(item); return; }
    state.pending = { item, key: crypto.randomUUID() };
    $("purchase-title").textContent = "Unlock " + item.name + "?";
    // Show exactly the single item that will be saved, with the current saved look.
    $("purchase-preview").replaceChildren(character({ ...state.user.equipped, [item.slot]: item }));
    const remaining = BigInt(state.user.coins) - BigInt(item.coinPrice);
    $("purchase-price").textContent = fmt(item.coinPrice) + " Arcade Coins · Balance: " + fmt(state.user.coins);
    $("purchase-remaining").textContent = remaining >= 0n
      ? "After purchase: " + fmt(remaining) + " coins · This item will be equipped."
      : "You need " + fmt(-remaining) + " more coins. Nothing has been charged.";
    $("purchase-error").textContent = "";
    $("confirm-purchase").disabled = remaining < 0n;
    renderFundingOptions(remaining < 0n);
    $("purchase-modal").showModal();
  }
  function renderPreviewActions() {
    const root = $("preview-actions");
    root.replaceChildren();
    const changed = Object.values(state.preview).filter(item => state.user?.equipped[item.slot]?.id !== item.id);
    root.hidden = !changed.length;
    const total = changed.reduce((sum,item) => sum + (state.user?.inventory.includes(item.id) ? 0n : BigInt(item.coinPrice)), 0n);
    $("tryon-summary").hidden = !changed.length;
    $("compare-look").hidden = !changed.length;
    if ($("compare-look").getAttribute("aria-pressed") === "true") {
      $("character-stage").replaceChildren(character({...(state.user?.equipped || starterLoadout()), ...state.preview}));
      $("preview-note").textContent = changed.length ? "Preview only · your saved look is unchanged" : "Your saved look";
    }
    $("compare-look").setAttribute("aria-pressed", "false");
    $("compare-look").textContent = "Compare saved look";
    $("tryon-total").textContent = total === 0n ? "No coins needed" : fmt(total) + " coins to unlock";
    $("tryon-detail").textContent = changed.length + " " + (changed.length === 1 ? "piece" : "pieces") + " in your try-on · Unlock items individually below.";
    for (const item of changed) {
      const owned = state.user?.inventory.includes(item.id);
      const row = el("div", "preview-action");
      const copy = el("div");
      copy.append(el("strong", "", item.name), el("small", "", owned ? "Owned · ready to wear" : item.coinPrice === 0 ? "Free essential" : fmt(item.coinPrice) + " coins"));
      const button = el("button", owned ? "subtle" : "buy", owned ? "Equip" : item.coinPrice === 0 ? "Use free" : "Unlock");
      button.type = "button";
      button.disabled = state.busy;
      button.setAttribute("aria-label", (owned ? "Equip preview " : "Unlock preview ") + item.name);
      button.addEventListener("click", () => chooseItem(item));
      row.append(copy, button);root.append(row);
    }
  }
  const looks = [
    {name:"Trail Society",description:"Warm knits, utility pockets, everyday high-tops.",ids:["cyber-starter","storm-coat","high-tops","adventure-pack","ribbed-beanie","round-glasses","explorer-beard"]},
    {name:"Aurora Vanguard",description:"Prismatic armor, plated boots, a glowing scepter.",ids:["neon-phantom","aurora-armor","radiant-boots","aurora-pack","comms-headset","star-goggles","orb-scepter"]},
    {name:"Solar Royalty",description:"Golden accents with a crown to match.",ids:["astra-prime","solar-jacket","radiant-boots","sun-crown","amber-goggles","solar-cannon"]},
  ];
  let previewSourceId = null;
  function showPreview(itemId = null) {
    previewSourceId = itemId;
    $("back-to-collection").hidden = false;
    $("character-stage").dataset.focus = "full";
    for (const option of document.querySelectorAll(".focus-controls [data-focus]"))
      option.setAttribute("aria-pressed", String(option.dataset.focus === "full"));
    $("character-stage").scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("compare-look").focus({preventScroll:true});
  }
  function renderFundingOptions(needed) {
    const root = $("purchase-funding"); root.replaceChildren(); root.hidden = !needed;
    if (!needed) return;
    const native = window.Capacitor?.isNativePlatform?.() || location.protocol === "capacitor:";
    if (!native) {
      const coins = el("a", "funding-link", "See coin options"); coins.href = "#coin-shop";
      coins.addEventListener("click", () => { $("purchase-modal").close(); state.pending = null; });
      root.append(coins);
    }
    const earn = el("a", "earn-coins-link", "Play & earn free coins →"); earn.href = "games.html";
    root.append(earn);
  }
  function renderLooks() {
    $("featured-looks").replaceChildren();
    for (const [index, look] of looks.entries()) {
      const found = look.ids.map(id => state.items.find(i => i.id === id)).filter(Boolean);
      if (found.length !== look.ids.length) continue;
      const equipped = {...starterLoadout(), ...Object.fromEntries(found.map(i => [i.slot,i]))};
      const pieces = Object.values(equipped).filter(Boolean);
      const owned = pieces.filter(i => state.user?.inventory.includes(i.id));
      const total = pieces.reduce((sum,i) => sum + (state.user?.inventory.includes(i.id) ? 0n : BigInt(i.coinPrice)), 0n);
      const card = el("article", "look-card"); card.dataset.look = String(index);
      const art = el("div", "look-art"); art.append(character(equipped));
      const copy = el("div", "look-copy");
      copy.append(el("span", "look-edition", ["STREET EXPLORER", "PRISMATIC TECH", "GOLDEN HOUR"][index]), el("h3", "", look.name), el("p", "look-description", look.description));
      const price = el("p", "look-price", total === 0n ? "No coins needed" : "◈ " + fmt(total) + " coins to complete");
      const detail = el("p", "look-detail", state.user ? owned.length + " of " + pieces.length + " pieces owned · Items unlock separately" : pieces.length + " pieces · Items unlock separately");
      const button = el("button", "subtle", "Try this look →"); button.type = "button";
      button.setAttribute("aria-label", "Preview " + look.name);
      button.addEventListener("click", () => { state.preview = {...equipped}; renderUser(); showPreview(); });
      copy.append(price, detail, button); card.append(art, copy); $("featured-looks").append(card);
    }
    $("signature-looks").hidden = !$("featured-looks").children.length;
  }
  async function leaderboard() {
    const data = await api("/api/leaderboard");
    $("leaderboard-context").textContent = "All-time · " + data.game;
    $("leaderboard-body").replaceChildren();
    for (const player of data.players) {
      const row = el("tr"),
        rank = el("td", "rank-cell", "#" + player.rank),
        name = el("td"),
        button = el("button", "player-link " + player.equippedAvatar.rarity);
      button.type = "button";
      button.setAttribute("aria-label", "@" + player.username);
      button.append(
        character(player.equipped),
        el("span", "", "@" + player.username),
      );
      button.addEventListener("click", () => openProfile(player.username));
      name.append(button);
      row.append(rank, name, el("td", "score", fmt(player.highScore)));
      $("leaderboard-body").append(row);
    }
    $("leaderboard-empty").hidden = data.players.length > 0;
  }
  async function refresh() {
    const sequence = ++state.refreshSequence;
    try {
      const { data } = await state.auth.auth.getSession();
      let user = null;
      if (data.session) {
        await window.EarnlyCloud?.syncServerRewards?.();
        user = (await api("/api/me")).user;
      }
      if (sequence !== state.refreshSequence) return;
      state.user = user;
      renderUser();
      try {
        await leaderboard();
      } catch (error) {
        status(error.message, true);
      }
    } catch (error) {
      if (sequence !== state.refreshSequence) return;
      state.user = null;
      renderUser();
      status(error.message, true);
    }
  }
  function applyUser(user, savedSlot) {
    state.user = user;
    state.preview = Object.fromEntries(Object.entries(state.preview).filter(([slot, item]) => slot !== savedSlot && user.equipped[slot]?.id !== item.id));
    renderUser();
    // Optional bridge for the existing Earnly frontend's Coin display.
    (typeof Arcade!=="undefined"?Arcade:null)?.applyServerWallet?.({
      balance: user.coins,
      lifetime_earned: user.lifetimeEarned,
    });
    window.dispatchEvent(
      new CustomEvent("earnly-cosmetics-change", { detail: { user } }),
    );
  }
  async function equip(item) {
    if (state.busy) return;
    state.busy = true;
    const epoch = state.authEpoch;
    ++state.refreshSequence;
    renderShop();
    try {
      const result = await api("/api/user/equip", {
        method: "POST",
        body: { itemId: item.id },
      });
      if (epoch !== state.authEpoch) return;
      applyUser(result.user, item.slot);
      status(item.name + " equipped.");
      await leaderboard();
    } catch (error) {
      status(error.message, true);
    } finally {
      state.busy = false;
      renderShop();
    }
  }
  $("confirm-purchase").addEventListener("click", async () => {
    if (state.busy || !state.pending) return;
    state.busy = true;
    const pending = state.pending,
      epoch = state.authEpoch;
    ++state.refreshSequence;
    $("confirm-purchase").disabled = true;
    renderShop();
    try {
      await window.EarnlyCloud?.syncServerRewards?.();
      const data = await api("/api/shop/buy", {
        method: "POST",
        body: { itemId: pending.item.id },
        key: pending.key,
      });
      if (epoch !== state.authEpoch) return;
      applyUser(data.user, pending.item.slot);
      $("purchase-modal").close();
      state.pending = null;
      status(pending.item.name + " unlocked and equipped. Saved to your collection.");
      await leaderboard();
    } catch (error) {
      $("purchase-error").textContent = error.message;
      // Keep the same key after an uncertain network outcome so retry cannot double-debit.
      if (error.code === "INSUFFICIENT_COINS")
        try {
          applyUser((await api("/api/me")).user);
        } catch {}
    } finally {
      state.busy = false;
      const insufficient = state.pending && state.user && BigInt(state.user.coins) < BigInt(state.pending.item.coinPrice);
      $("confirm-purchase").disabled = !!insufficient;
      renderFundingOptions(!!insufficient);
      renderShop();
    }
  });
  async function openProfile(username) {
    const sequence = ++state.profileSequence;
    try {
      const { profile: p } = await api(
        "/api/user/" + encodeURIComponent(username),
      );
      if (sequence !== state.profileSequence) return;
      $("modal-username").textContent = "@" + p.username;
      $("modal-character").className =
        "modal-character " + p.equippedAvatar.rarity;
      $("modal-character").replaceChildren(character(p.equipped));
      $("modal-rarity").className = "badge " + p.equippedAvatar.rarity;
      $("modal-rarity").textContent = p.equippedAvatar.rarity.toUpperCase();
      $("modal-game").textContent = "All-time · " + p.game;
      $("modal-rank").textContent = p.rank ? "#" + p.rank : "Unranked";
      $("modal-score").textContent = fmt(p.highScore);
      $("modal-games").textContent = fmt(p.gamesPlayed);
      $("modal-skins").textContent = fmt(p.totalSkinsUnlocked);
      summary($("modal-loadout"), p.equipped);
      if (!$("profile-modal").open) $("profile-modal").showModal();
    } catch (error) {
      status(error.message, true);
    }
  }
  $("affordable-only").addEventListener("change", e => { state.affordableOnly = e.target.checked; renderShop(); });
  $("shop-sort").addEventListener("change", e => { state.sort = e.target.value; renderShop(); });
  $("compare-look").addEventListener("click", () => {
    const button = $("compare-look"), compare = button.getAttribute("aria-pressed") !== "true";
    const saved = state.user?.equipped || starterLoadout();
    button.setAttribute("aria-pressed", String(compare));
    button.textContent = compare ? "Back to your try-on" : "Compare saved look";
    $("character-stage").replaceChildren(character(compare ? saved : {...saved,...state.preview}));
    $("preview-note").textContent = compare ? "Showing your saved look · Preview only, nothing has changed" : "Preview only · your saved look is unchanged";
  });
  $("owned-only").addEventListener("change", e=>{state.ownedOnly=e.target.checked;renderShop();});
  $("shop-search").addEventListener("input", e=>{state.search=e.target.value.trim().toLowerCase();renderShop();});
  for(const button of document.querySelectorAll("[data-focus]")) button.addEventListener("click",()=>{
    $("character-stage").dataset.focus=button.dataset.focus;
    for(const option of document.querySelectorAll("[data-focus]")) option.setAttribute("aria-pressed",String(option===button));
  });
  $("free-only").addEventListener("change", (event) => { state.freeOnly = event.target.checked; renderShop(); });
  $("back-to-collection").addEventListener("click", () => {
    const target = Array.from(document.querySelectorAll("[data-preview-item-id]"))
      .find(button => button.dataset.previewItemId === previewSourceId);
    const destination = target?.closest(".item-card") || $("collection");
    destination.scrollIntoView({block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    (target || $("shop-search")).focus({preventScroll: true});
  });
  $("reset-preview").addEventListener("click", () => { state.preview = {}; renderUser(); });
  for (const button of document.querySelectorAll("[data-slot]"))
    button.addEventListener("click", () => {
      state.slot = button.dataset.slot;
      for (const tab of document.querySelectorAll("[data-slot]"))
        tab.setAttribute("aria-pressed", String(tab === button));
      renderShop();
    });
  for (const button of document.querySelectorAll("[data-close]"))
    button.addEventListener("click", () => {
      if (button.dataset.close === "purchase-modal" && state.busy) return;
      $(button.dataset.close).close();
    });
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (event) => {
      const r = dialog.getBoundingClientRect();
      if (
        event.target === dialog &&
        (event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom) &&
        !(dialog.id === "purchase-modal" && state.busy)
      )
        dialog.close();
    });
    dialog.addEventListener("cancel", (event) => {
      if (dialog.id === "purchase-modal" && state.busy) event.preventDefault();
    });
  }
  $("my-profile").addEventListener(
    "click",
    () => state.user && openProfile(state.user.username),
  );
  $("view-profile").addEventListener(
    "click",
    () => state.user && openProfile(state.user.username),
  );
  $("refresh-button").addEventListener("click", refresh);
  $("auth-button").addEventListener("click", async () => {
    if (!state.user) {
      $("auth-modal").showModal();
      return;
    }
    const { error } = await state.auth.auth.signOut();
    if (error) status(error.message, true);
    else {
      state.user = null;
      $("profile-modal").close();
      $("purchase-modal").close();
      state.pending = null;
      renderUser();
      status("Signed out.");
    }
  });
  $("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    $("auth-status").textContent = "Signing in…";
    try {
      const { error } = await state.auth.auth.signInWithPassword({
        email: $("email").value,
        password: $("password").value,
      });
      if (error) throw error;
      $("password").value = "";
      $("auth-modal").close();
      await refresh();
    } catch (error) {
      $("auth-status").textContent = error.message;
      $("auth-status").className = "error";
    } finally {
      button.disabled = false;
    }
  });
  $("magic-link").addEventListener("click", async () => {
    if (!$("email").reportValidity()) return;
    const button = $("magic-link");
    button.disabled = true;
    try {
      const { error } = await state.auth.auth.signInWithOtp({
        email: $("email").value,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: location.origin + location.pathname,
        },
      });
      if (error) throw error;
      $("auth-status").className = "";
      $("auth-status").textContent = "Check your email for the sign-in link.";
    } catch (error) {
      $("auth-status").className = "error";
      $("auth-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.auth && !state.busy) refresh();
  });
  async function init() {
    try {
      state.config = await api("/api/config");
      state.auth = window.createEarnlyAuth(
        state.config.supabaseUrl,
        state.config.publishableKey,
      );
      state.items = (await api("/api/shop")).items;
      renderLooks();
      renderUser();
      await refresh();
      state.auth.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
          ++state.authEpoch;
          ++state.refreshSequence;
          state.user = null;
          state.preview = {};
          state.pending = null;
          renderUser();
          $("purchase-modal").close();
          $("profile-modal").close();
        }
        // Refresh outside the SDK callback to avoid holding its internal auth lock.
        if (event !== "TOKEN_REFRESHED") setTimeout(refresh, 0);
      });
    } catch (error) {
      status(error.message, true);
      $("shop-grid").textContent =
        "Collection could not load. Refresh to try again.";
    }
  }
  init();
})();
