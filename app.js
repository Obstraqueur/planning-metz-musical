/* Planning des répétitions — Metz Musical
 * Page statique (GitHub Pages) + base Supabase partagée.
 * Tout le monde peut ajouter / modifier / supprimer ; chaque action est signée
 * d'un prénom et apparaît dans le centre de notifications (table `activity`).
 */
(() => {
  "use strict";

  const CFG = Object.assign({ poles: [] }, window.PLANNING_CONFIG || {});
  const LS = { name: "mm-planning-name", hidden: "mm-planning-hidden", view: "mm-planning-view", seen: "mm-planning-seen" };
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const ACTION_VERB = { ajout: "a ajouté", modification: "a modifié", suppression: "a supprimé", restauration: "a restauré" };

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memory only */ } }
  };
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const todayStr = () => ymd(new Date());
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const longDate = s => { const d = parse(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const shortDate = s => { const d = parse(s); return `${DAYS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
  const hm = t => t ? t.slice(0, 5).replace(":", "h") : "";
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
  function ago(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) { const n = Math.floor(s / 86400); return `il y a ${n} jour${n > 1 ? "s" : ""}`; }
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }

  let toastTimer;
  function toast(msg, isErr = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("err", isErr);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), isErr ? 6000 : 3000);
  }

  // ---------- State ----------
  const now = new Date();
  const state = {
    events: [],
    activity: [],
    loaded: false,
    year: now.getFullYear(),
    month: now.getMonth(),
    view: store.get(LS.view, "month"),
    hidden: new Set(store.get(LS.hidden, [])),
    selected: null,
    name: store.get(LS.name, ""),
    seen: store.get(LS.seen, null),
    editing: null
  };
  const isPhone = () => matchMedia("(max-width: 720px)").matches;
  const poleOf = id => CFG.poles.find(p => p.id === id) || { id: "autre", name: "Autre", color: "#64748b" };
  const colorOf = ev => ev.color || poleOf(ev.pole).color;

  // ---------- Database (Supabase) ----------
  const configured = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);
  const sb = configured ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false } }) : null;

  // DB row <-> app event
  const fromRow = r => ({
    id: r.id, title: r.title, pole: r.pole, date: r.date, endDate: r.end_date || null,
    allDay: !!r.all_day, start: r.start_time || "", end: r.end_time || "",
    location: r.location || "", notes: r.notes || "", color: r.color || null,
    seriesId: r.series_id || null, createdBy: r.created_by || "", updatedBy: r.updated_by || "", updatedAt: r.updated_at
  });
  const toRow = e => ({
    id: e.id, title: e.title, pole: e.pole, date: e.date, end_date: e.endDate || null,
    all_day: !!e.allDay, start_time: e.allDay ? null : e.start, end_time: e.allDay ? null : e.end,
    location: e.location || "", notes: e.notes || "", color: e.color || null,
    series_id: e.seriesId || null, created_by: e.createdBy || null, updated_by: e.updatedBy || null
  });
  const stripRow = r => { const o = { ...r }; delete o.created_at; delete o.updated_at; return o; };

  async function q(promise) {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  }

  async function load() {
    if (!sb) { render(); return; }
    try {
      const [ev, act] = await Promise.all([
        q(sb.from("events").select("*").order("date", { ascending: true }).limit(5000)),
        q(sb.from("activity").select("*").order("created_at", { ascending: false }).limit(60))
      ]);
      state.events = ev.map(fromRow);
      state.activity = act;
      state.loaded = true;
      setStatus("");
      if (state.seen == null) { state.seen = new Date().toISOString(); store.set(LS.seen, state.seen); }
    } catch (err) {
      console.error(err);
      setStatus("Impossible de charger le planning. Vérifiez votre connexion puis rechargez la page.");
    }
    render();
  }

  let reloadTimer;
  const scheduleReload = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(load, 400); };

  function subscribe() {
    if (!sb) return;
    try {
      sb.channel("planning")
        .on("postgres_changes", { event: "*", schema: "public", table: "events" }, scheduleReload)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, scheduleReload)
        .subscribe();
    } catch (e) { console.warn("realtime indisponible", e); }
    // Filet de sécurité si le temps réel est coupé.
    setInterval(() => { if (!document.hidden && !document.querySelector("dialog[open]")) load(); }, 120000);
  }

  async function logActivity(action, summary, extra = {}) {
    try {
      await q(sb.from("activity").insert({ action, author: state.name, summary: summary.slice(0, 200), ...extra }));
    } catch (e) { console.warn("activité non enregistrée", e); }
  }

  // ---------- Queries ----------
  function eventsOn(day) {
    return state.events
      .filter(e => !state.hidden.has(e.pole) && e.date <= day && day <= (e.endDate || e.date))
      .sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title));
  }
  const timeLabel = e => e.allDay ? (e.endDate && e.endDate !== e.date ? `jusqu'au ${shortDate(e.endDate)}` : "Journée") : `${hm(e.start)}–${hm(e.end)}`;
  const isHighlight = e => ["spectacle", "generale", "weekend"].includes(e.pole);
  const unread = () => state.activity.filter(a => state.seen && a.created_at > state.seen && a.author !== state.name);

  // ---------- Render ----------
  function setStatus(msg) { const s = $("#status"); s.textContent = msg; s.hidden = !msg; }

  function render() {
    $("#monthLabel").textContent = `${MONTHS[state.month]} ${state.year}`;
    document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
    $("#monthView").hidden = state.view !== "month";
    $("#listView").hidden = state.view !== "list";
    $("#nameBtn").textContent = state.name ? `Prénom : ${state.name}` : "Votre prénom";
    const n = unread().length;
    $("#bellCount").hidden = !n;
    $("#bellCount").textContent = n > 9 ? "9+" : String(n);
    $("#bellBtn").setAttribute("aria-label", n ? `${n} nouvelle${n > 1 ? "s" : ""} activité${n > 1 ? "s" : ""}` : "Dernières activités");
    if (!configured) setStatus("Le planning n'est pas encore relié à sa base de données : renseignez supabaseUrl et supabaseKey dans config.js (voir le README).");
    renderLegend();
    renderCountdown();
    if (state.view === "month") renderMonth(); else renderList();
    renderDayPanel();
    if (!$("#notifPanel").hidden) renderNotifs();
    $("#sourceInfo").textContent = state.loaded ? `${state.events.length} créneaux · mis à jour en direct` : "";
  }

  function renderLegend() {
    const box = $("#legend"); box.replaceChildren();
    for (const p of CFG.poles) {
      const off = state.hidden.has(p.id);
      box.append(h("button", {
        type: "button", class: `chip${off ? " off" : ""}`, style: `--c:${p.color}`, "aria-pressed": String(!off),
        title: off ? "Afficher" : "Masquer",
        onclick: () => { off ? state.hidden.delete(p.id) : state.hidden.add(p.id); store.set(LS.hidden, [...state.hidden]); render(); }
      }, p.name));
    }
  }

  function renderCountdown() {
    const el = $("#countdown");
    if (!CFG.showDate) { el.hidden = true; return; }
    const n = diffDays(todayStr(), CFG.showDate);
    el.hidden = false;
    el.replaceChildren();
    if (n > 0) el.append(h("b", {}, `J-${n}`), ` avant ${CFG.showLabel} · ${longDate(CFG.showDate)}`);
    else if (n === 0) el.append(h("b", {}, "Jour J"), " — merde à tous !");
    else el.append(`${cap(CFG.showLabel)} a eu lieu le ${longDate(CFG.showDate)}`);
  }

  function evButton(e) {
    return h("button", {
      type: "button", class: `ev${isHighlight(e) ? " solid" : ""}`, style: `--c:${colorOf(e)}`,
      title: `${e.title} · ${timeLabel(e)}${e.location ? " · " + e.location : ""}`,
      onclick: ev => { ev.stopPropagation(); openEditor(e); }
    }, e.allDay ? null : h("span", { class: "t" }, hm(e.start)), e.title);
  }

  function renderMonth() {
    const grid = $("#grid"); grid.replaceChildren();
    const first = new Date(state.year, state.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(state.year, state.month, 1 - offset);
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const weeks = Math.ceil((offset + daysInMonth) / 7);
    const today = todayStr();
    const MAX = 3;
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = ymd(d);
      const evs = eventsOn(key);
      const out = d.getMonth() !== state.month;
      const cell = h("div", {
        class: `cell${out ? " out" : ""}${key === today ? " today" : ""}${d.getDay() % 6 === 0 ? " weekend" : ""}${state.selected === key ? " sel" : ""}`,
        tabindex: "0", role: "button", "aria-label": `${longDate(key)}, ${evs.length} créneau${evs.length > 1 ? "x" : ""}`,
        onclick: () => onDayClick(key),
        onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDayClick(key); } }
      }, h("span", { class: "num" }, String(d.getDate())));
      evs.slice(0, MAX).forEach(e => cell.append(evButton(e)));
      if (evs.length > MAX) cell.append(h("button", { type: "button", class: "more", onclick: ev => { ev.stopPropagation(); selectDay(key); } }, `+${evs.length - MAX} autre${evs.length - MAX > 1 ? "s" : ""}`));
      if (evs.length) cell.append(h("span", { class: "dots", "aria-hidden": "true" }, evs.slice(0, 6).map(e => h("i", { style: `--c:${colorOf(e)}` }))));
      grid.append(cell);
    }
  }

  function onDayClick(key) {
    if (isPhone()) { selectDay(key); return; }
    openEditor(null, key);
  }
  function selectDay(key) {
    state.selected = state.selected === key && !isPhone() ? null : key;
    render();
    if (state.selected) $("#dayPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function rowFor(e) {
    const p = poleOf(e.pole);
    return h("button", { type: "button", class: "row", style: `--c:${colorOf(e)}`, onclick: () => openEditor(e) },
      h("span", { class: "time" }, timeLabel(e)),
      h("span", {}, h("div", { class: "title" }, e.title), h("div", { class: "sub" }, [p.name, e.location].filter(Boolean).join(" · "))));
  }

  function renderDayPanel() {
    const panel = $("#dayPanel");
    const key = state.selected;
    if (!key || state.view !== "month") { panel.hidden = true; return; }
    const evs = eventsOn(key);
    panel.hidden = false;
    panel.replaceChildren(
      h("h3", {}, cap(longDate(key)), h("span", { class: "spacer" }),
        h("button", { type: "button", class: "btn small", onclick: () => openEditor(null, key) }, "+ Ajouter ce jour"),
        h("button", { type: "button", class: "btn icon", "aria-label": "Fermer", onclick: () => { state.selected = null; render(); } }, "×")),
      evs.length ? h("div", {}, evs.map(rowFor)) : h("p", { class: "empty" }, "Aucun créneau ce jour-là."));
  }

  function renderList() {
    const box = $("#listView"); box.replaceChildren();
    const days = new Date(state.year, state.month + 1, 0).getDate();
    const today = todayStr();
    for (let i = 1; i <= days; i++) {
      const key = ymd(new Date(state.year, state.month, i));
      const evs = eventsOn(key);
      if (!evs.length) continue;
      const d = parse(key);
      box.append(h("div", { class: `day${key === today ? " today" : ""}` },
        h("div", { class: "d" }, h("b", {}, String(d.getDate())), DAYS[d.getDay()].slice(0, 3) + "."),
        h("div", {}, evs.map(rowFor))));
    }
    if (!box.children.length) box.append(h("p", { class: "empty" }, "Aucun créneau ce mois-ci."));
  }

  // ---------- Notification center ----------
  function renderNotifs() {
    const list = $("#notifList"); list.replaceChildren();
    if (!state.activity.length) {
      list.append(h("p", { class: "empty" }, "Aucune activité pour l'instant. Les ajouts et modifications de chacun apparaîtront ici."));
      return;
    }
    const existing = new Set(state.events.map(e => e.id));
    for (const a of state.activity) {
      const isNew = state.seen && a.created_at > state.seenAtOpen && a.author !== state.name;
      const target = a.event_id && existing.has(a.event_id) ? state.events.find(e => e.id === a.event_id) : null;
      const snap = Array.isArray(a.snapshot) ? a.snapshot : [];
      const canRestore = a.action === "suppression" && snap.length && snap.some(r => !existing.has(r.id));
      const item = h("div", { class: `nitem${isNew ? " new" : ""}`, style: `--c:${poleOf(a.pole).color}` },
        h("div", { class: "nline" }, h("b", {}, a.author), ` ${ACTION_VERB[a.action] || a.action} `, h("span", { class: "nsum" }, a.summary)),
        h("div", { class: "nmeta" },
          a.event_date ? h("span", {}, shortDate(a.event_date)) : null,
          h("span", {}, ago(a.created_at)),
          target ? h("button", { type: "button", class: "link", onclick: () => goTo(target) }, "Voir") : null,
          !target && a.event_date && a.action !== "suppression" ? h("button", { type: "button", class: "link", onclick: () => goToDate(a.event_date) }, "Voir le jour") : null,
          canRestore ? h("button", { type: "button", class: "link", onclick: () => restore(a) }, "Restaurer") : null));
      list.append(item);
    }
  }
  function openNotifs() {
    state.seenAtOpen = state.seen;
    $("#notifPanel").hidden = false;
    $("#bellBtn").setAttribute("aria-expanded", "true");
    renderNotifs();
    state.seen = new Date().toISOString();
    store.set(LS.seen, state.seen);
    $("#bellCount").hidden = true;
  }
  function closeNotifs() {
    $("#notifPanel").hidden = true;
    $("#bellBtn").setAttribute("aria-expanded", "false");
    render();
  }
  function goToDate(date) {
    const d = parse(date);
    state.year = d.getFullYear(); state.month = d.getMonth(); state.selected = date; state.view = "month";
    closeNotifs();
  }
  function goTo(ev) { goToDate(ev.date); openEditor(ev); }

  async function restore(a) {
    if (!(await ensureName())) return;
    const existing = new Set(state.events.map(e => e.id));
    const rows = a.snapshot.filter(r => !existing.has(r.id)).map(stripRow).map(r => ({ ...r, updated_by: state.name }));
    try {
      await q(sb.from("events").upsert(rows));
      await logActivity("restauration", rows.length > 1 ? `${rows.length} séances de « ${rows[0].title} »` : `« ${rows[0].title} »`,
        { event_date: rows[0].date, pole: rows[0].pole, event_id: rows.length === 1 ? rows[0].id : null, count: rows.length });
      toast("Créneau restauré.");
      await load();
    } catch (e) { console.error(e); toast("La restauration a échoué. Réessayez.", true); }
  }

  // ---------- Name ----------
  let nameResolver = null;
  function ensureName() {
    if (state.name) return Promise.resolve(true);
    return askName();
  }
  function askName() {
    $("#n-name").value = state.name || "";
    $("#nameDlg").showModal();
    return new Promise(res => { nameResolver = res; });
  }
  $("#nameForm").addEventListener("submit", e => {
    if (e.submitter?.value !== "ok") return;
    e.preventDefault();
    const v = $("#n-name").value.trim();
    if (!v) return;
    state.name = v; store.set(LS.name, v);
    $("#nameDlg").close();
    render();
  });
  $("#nameDlg").addEventListener("close", () => { if (nameResolver) { nameResolver(!!state.name); nameResolver = null; } });

  // ---------- Event editor ----------
  function fillPoleSelect() {
    const sel = $("#poleSelect"); sel.replaceChildren();
    CFG.poles.forEach(p => sel.append(h("option", { value: p.id }, p.name)));
  }

  function openEditor(e, day) {
    if (!configured) { toast("Le planning n'est pas encore relié à sa base de données.", true); return; }
    const f = $("#eventForm");
    fillPoleSelect();
    f.reset();
    state.editing = e ? { ...e } : null;
    const base = e || { title: "", pole: CFG.poles[0]?.id || "autre", date: day || todayStr(), start: "17:00", end: "18:30", allDay: false, location: "", notes: "" };
    f.title.value = base.title;
    f.pole.value = base.pole;
    f.date.value = base.date;
    f.endDate.value = base.endDate || "";
    f.allDay.checked = !!base.allDay;
    f.start.value = (base.start || "17:00").slice(0, 5);
    f.end.value = (base.end || "18:30").slice(0, 5);
    f.location.value = base.location || "";
    f.notes.value = base.notes || "";
    f.color.value = colorOf(base);
    f.author.value = state.name || "";
    f.dataset.custom = base.color ? "1" : "";
    f.classList.toggle("allday", f.allDay.checked);
    f.repeatUntil.value = "";
    $("#repeatBox").hidden = !!e;
    $("#scopeBox").hidden = !(e && e.seriesId);
    $("#deleteBtn").hidden = !e;
    $("#confirmBox").hidden = true;
    $("#eventDlgTitle").textContent = e ? "Modifier le créneau" : "Nouveau créneau";
    const who = e ? [e.createdBy && `Ajouté par ${e.createdBy}`, e.updatedBy && e.updatedBy !== e.createdBy && `modifié par ${e.updatedBy}`].filter(Boolean).join(", ") : "";
    $("#eventMeta").textContent = who;
    $("#eventDlg").showModal();
    if (!e) f.title.focus();
  }

  function readForm() {
    const f = $("#eventForm");
    const allDay = f.allDay.checked;
    const ev = {
      title: f.title.value.trim(),
      pole: f.pole.value,
      date: f.date.value,
      allDay,
      start: allDay ? "" : f.start.value,
      end: allDay ? "" : f.end.value,
      location: f.location.value.trim(),
      notes: f.notes.value.trim(),
      color: f.dataset.custom ? f.color.value : null,
      endDate: null
    };
    const author = f.author.value.trim();
    if (!ev.title) throw new Error("Donnez un titre au créneau.");
    if (!ev.date) throw new Error("Choisissez une date.");
    if (!allDay && (!ev.start || !ev.end || ev.end <= ev.start)) throw new Error("L'heure de fin doit être après l'heure de début.");
    if (allDay && f.endDate.value) {
      if (f.endDate.value < ev.date) throw new Error("La date de fin doit être après la date de début.");
      if (f.endDate.value > ev.date) ev.endDate = f.endDate.value;
    }
    if (!author) throw new Error("Indiquez votre prénom pour signer l'ajout.");
    return { ev, author };
  }

  function summaryOf(ev, extra = "") {
    const when = ev.allDay ? "" : ` ${hm(ev.start)}`;
    return `« ${ev.title} »${extra}${when}`;
  }

  async function saveEvent() {
    const f = $("#eventForm");
    let ev, author;
    try { ({ ev, author } = readForm()); } catch (err) { toast(err.message, true); return; }
    if (author !== state.name) { state.name = author; store.set(LS.name, author); }
    const old = state.editing;
    const scope = (f.querySelector("input[name=scope]:checked") || {}).value || "one";
    await busy(async () => {
      if (!old) {
        const dates = [ev.date];
        if (f.repeat.checked) {
          const until = f.repeatUntil.value;
          if (!until || until <= ev.date) throw new UserError("Indiquez jusqu'à quand répéter le créneau.");
          for (let d = addDays(ev.date, 7); d <= until && dates.length < 80; d = addDays(d, 7)) dates.push(d);
        }
        const seriesId = dates.length > 1 ? uuid() : null;
        const span = ev.endDate ? diffDays(ev.date, ev.endDate) : 0;
        const rows = dates.map(d => toRow({ ...ev, id: uuid(), date: d, endDate: span ? addDays(d, span) : null, seriesId, createdBy: author, updatedBy: author }));
        await q(sb.from("events").insert(rows));
        await logActivity("ajout", dates.length > 1 ? `${summaryOf(ev)}, chaque semaine jusqu'au ${shortDate(dates[dates.length - 1])} (${dates.length} séances)` : summaryOf(ev),
          { event_date: ev.date, pole: ev.pole, event_id: rows.length === 1 ? rows[0].id : null, count: rows.length });
        return "Créneau ajouté.";
      }
      if (old.seriesId && scope === "future") {
        const shift = diffDays(old.date, ev.date);
        const targets = state.events.filter(x => x.seriesId === old.seriesId && x.date >= old.date);
        const patch = toRow({ ...ev, seriesId: old.seriesId, createdBy: old.createdBy, updatedBy: author });
        delete patch.id; delete patch.created_by; delete patch.date; delete patch.end_date;
        if (shift === 0 && !ev.endDate && targets.every(x => !x.endDate)) {
          await q(sb.from("events").update(patch).eq("series_id", old.seriesId).gte("date", old.date));
        } else {
          for (const x of targets) {
            const nd = addDays(x.date, shift);
            await q(sb.from("events").update({ ...patch, date: nd, end_date: ev.endDate ? addDays(nd, diffDays(ev.date, ev.endDate)) : null }).eq("id", x.id));
          }
        }
        await logActivity("modification", `${summaryOf(ev)} à partir du ${shortDate(old.date)} (${targets.length} séances)`, { event_date: ev.date, pole: ev.pole, count: targets.length });
        return "Série modifiée.";
      }
      const row = toRow({ ...ev, id: old.id, seriesId: old.seriesId, createdBy: old.createdBy, updatedBy: author });
      delete row.id; delete row.created_by;
      await q(sb.from("events").update(row).eq("id", old.id));
      await logActivity("modification", summaryOf(ev), { event_date: ev.date, pole: ev.pole, event_id: old.id });
      return "Créneau modifié.";
    });
  }

  async function deleteEvent() {
    const old = state.editing; if (!old) return;
    const author = $("#eventForm").author.value.trim();
    if (!author) { toast("Indiquez votre prénom pour signer la suppression.", true); return; }
    if (author !== state.name) { state.name = author; store.set(LS.name, author); }
    const scope = ($("#eventForm").querySelector("input[name=scope]:checked") || {}).value || "one";
    const all = old.seriesId && scope === "future";
    const targets = all ? state.events.filter(x => x.seriesId === old.seriesId && x.date >= old.date) : [old];
    await busy(async () => {
      const snapshot = targets.map(x => toRow(x));
      if (all) await q(sb.from("events").delete().eq("series_id", old.seriesId).gte("date", old.date));
      else await q(sb.from("events").delete().eq("id", old.id));
      await logActivity("suppression", all ? `${summaryOf(old)} à partir du ${shortDate(old.date)} (${targets.length} séances)` : summaryOf(old),
        { event_date: old.date, pole: old.pole, count: targets.length, snapshot });
      return "Créneau supprimé. Il peut être restauré depuis les notifications.";
    });
  }

  class UserError extends Error {}
  async function busy(fn) {
    const btns = document.querySelectorAll("#eventDlg .dlg-foot .btn");
    btns.forEach(b => b.disabled = true);
    $("#saveBtn").textContent = "Enregistrement…";
    try {
      const msg = await fn();
      $("#eventDlg").close();
      toast(msg);
      await load();
    } catch (err) {
      console.error(err);
      toast(err instanceof UserError ? err.message : "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.", true);
    } finally {
      btns.forEach(b => b.disabled = false);
      $("#saveBtn").textContent = "Enregistrer";
    }
  }

  // ---------- ICS export ----------
  function exportIcs() {
    const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const compact = s => s.replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Metz Musical//Planning//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Metz Musical — Répétitions", "X-WR-TIMEZONE:Europe/Paris"];
    for (const e of state.events) {
      if (state.hidden.has(e.pole)) continue;
      lines.push("BEGIN:VEVENT", `UID:${e.id}@metz-musical`, `DTSTAMP:${stamp}`);
      if (e.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.endDate || e.date, 1))}`);
      } else {
        lines.push(`DTSTART;TZID=Europe/Paris:${compact(e.date)}T${e.start.slice(0, 5).replace(":", "")}00`, `DTEND;TZID=Europe/Paris:${compact(e.date)}T${e.end.slice(0, 5).replace(":", "")}00`);
      }
      lines.push(`SUMMARY:${esc(`[${poleOf(e.pole).name}] ${e.title}`)}`);
      if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
      if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "metz-musical-planning.ics" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Fichier .ics téléchargé : importez-le dans Google Agenda.");
  }

  // ---------- Wiring ----------
  function shiftMonth(n) {
    const d = new Date(state.year, state.month + n, 1);
    state.year = d.getFullYear(); state.month = d.getMonth(); state.selected = null;
    render();
  }
  $("#prevBtn").onclick = () => shiftMonth(-1);
  $("#nextBtn").onclick = () => shiftMonth(1);
  $("#todayBtn").onclick = () => { const t = new Date(); state.year = t.getFullYear(); state.month = t.getMonth(); state.selected = isPhone() ? todayStr() : null; render(); };
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { state.view = b.dataset.view; store.set(LS.view, state.view); render(); });
  $("#addBtn").onclick = () => openEditor(null, state.selected || (state.month === now.getMonth() && state.year === now.getFullYear() ? todayStr() : ymd(new Date(state.year, state.month, 1))));
  $("#nameBtn").onclick = askName;
  $("#bellBtn").onclick = () => $("#notifPanel").hidden ? openNotifs() : closeNotifs();
  $("#notifClose").onclick = closeNotifs;
  $("#icsBtn").onclick = exportIcs;
  $("#deleteBtn").onclick = () => { $("#deleteBtn").hidden = true; $("#confirmBox").hidden = false; };
  $("#confirmNo").onclick = () => { $("#deleteBtn").hidden = false; $("#confirmBox").hidden = true; };
  $("#confirmYes").onclick = deleteEvent;
  $("#resetColor").onclick = () => { const f = $("#eventForm"); f.dataset.custom = ""; f.color.value = poleOf(f.pole.value).color; };
  $("#f-color").addEventListener("input", () => { $("#eventForm").dataset.custom = "1"; });
  $("#poleSelect").addEventListener("change", () => { const f = $("#eventForm"); if (!f.dataset.custom) f.color.value = poleOf(f.pole.value).color; });
  $("#f-allday").addEventListener("change", e => $("#eventForm").classList.toggle("allday", e.target.checked));
  $("#eventForm").addEventListener("submit", e => {
    if (e.submitter?.value === "save") { e.preventDefault(); saveEvent(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#notifPanel").hidden) { closeNotifs(); return; }
    if (document.querySelector("dialog[open]") || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") shiftMonth(-1);
    if (e.key === "ArrowRight") shiftMonth(1);
  });
  document.addEventListener("click", e => {
    const p = $("#notifPanel");
    if (!p.hidden && !p.contains(e.target) && !$("#bellBtn").contains(e.target) && !e.target.closest("dialog")) closeNotifs();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !document.querySelector("dialog[open]")) load(); });
  matchMedia("(max-width: 720px)").addEventListener("change", render);

  if (isPhone()) state.selected = todayStr();
  render();
  load();
  subscribe();
})();
