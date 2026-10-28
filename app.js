/* Planning des répétitions — Metz Musical
 * Page statique (GitHub Pages). Les créneaux sont stockés dans data/events.json
 * dans le dépôt ; les responsables les modifient via l'API GitHub avec leur jeton.
 */
(() => {
  "use strict";

  // ---------- Config ----------
  const CFG = Object.assign({}, window.PLANNING_CONFIG || {});
  if (location.hostname.endsWith(".github.io")) {
    CFG.owner = location.hostname.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    CFG.repo = seg || `${CFG.owner}.github.io`;
  }
  const API = `https://api.github.com/repos/${CFG.owner}/${CFG.repo}`;
  const LS = { auth: "mm-planning-auth", hidden: "mm-planning-hidden", view: "mm-planning-view" };

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  // ---------- Small helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const todayStr = () => ymd(new Date());
  const longDate = s => { const d = parse(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const shortDate = s => { const d = parse(s); return `${DAYS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`; };
  const hm = t => t ? t.replace(":", "h") : "";
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

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

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
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
    data: { poles: [], events: [] },
    sha: null,
    source: "",
    year: now.getFullYear(),
    month: now.getMonth(),
    view: store.get(LS.view, "month"),
    hidden: new Set(store.get(LS.hidden, [])),
    selected: null,
    auth: store.get(LS.auth, null),
    editing: null
  };
  const isPhone = () => matchMedia("(max-width: 720px)").matches;
  const poleOf = id => state.data.poles.find(p => p.id === id) || { id: "autre", name: "Autre", color: "#64748b" };
  const colorOf = ev => ev.color || poleOf(ev.pole).color;

  // ---------- GitHub I/O ----------
  function headers(withAuth) {
    const hd = { Accept: "application/vnd.github+json" };
    if (withAuth && state.auth?.token) hd.Authorization = `Bearer ${state.auth.token}`;
    return hd;
  }
  async function fetchRemote(withAuth) {
    const url = `${API}/contents/${CFG.dataPath}?ref=${encodeURIComponent(CFG.branch)}&t=${Date.now()}`;
    const r = await fetch(url, { headers: headers(withAuth), cache: "no-store" });
    if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
    const j = await r.json();
    return { data: normalize(JSON.parse(b64decode(j.content))), sha: j.sha };
  }
  function normalize(d) {
    d = d || {};
    d.poles = Array.isArray(d.poles) ? d.poles : [];
    d.events = Array.isArray(d.events) ? d.events : [];
    return d;
  }

  async function load() {
    try {
      const { data, sha } = await fetchRemote(!!state.auth);
      state.data = data; state.sha = sha; state.source = "github";
      setStatus("");
    } catch (err) {
      try {
        const r = await fetch(`${CFG.dataPath}?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        state.data = normalize(await r.json()); state.source = "local";
        if (state.auth) setStatus("Impossible de joindre GitHub pour le moment : affichage de la dernière version publiée. Les modifications peuvent échouer.");
      } catch {
        setStatus("Impossible de charger le planning. Vérifiez votre connexion puis rechargez la page.");
      }
    }
    render();
  }

  async function commit(mutate, message) {
    if (!state.auth?.token) { openAuth(); throw new Error("not-authenticated"); }
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      let fresh;
      try { fresh = await fetchRemote(true); }
      catch (e) { lastErr = e; break; }
      const data = fresh.data;
      mutate(data);
      data.updatedAt = new Date().toISOString();
      const body = {
        message: `${state.auth.name || "Responsable"} : ${message}`,
        content: b64encode(JSON.stringify(data, null, 2) + "\n"),
        sha: fresh.sha,
        branch: CFG.branch
      };
      const r = await fetch(`${API}/contents/${CFG.dataPath}`, {
        method: "PUT",
        headers: { ...headers(true), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (r.ok) {
        const j = await r.json();
        state.data = data; state.sha = j.content.sha; state.source = "github";
        render();
        return;
      }
      lastErr = new Error(`GitHub ${r.status}`); lastErr.status = r.status;
      if (r.status !== 409 && r.status !== 422) break; // 409/422 = someone saved meanwhile: retry on fresh copy
    }
    throw lastErr;
  }
  function explain(err) {
    const s = err?.status;
    if (s === 401) return "Jeton GitHub invalide ou expiré. Reconnectez-vous.";
    if (s === 403 || s === 404) return "Ce jeton n'a pas le droit d'écrire dans le dépôt.";
    if (s === 409 || s === 422) return "Quelqu'un a modifié le planning en même temps. Réessayez.";
    return "Échec de l'enregistrement. Vérifiez votre connexion.";
  }

  // ---------- Queries ----------
  function eventsOn(day) {
    return state.data.events
      .filter(e => !state.hidden.has(e.pole) && e.date <= day && day <= (e.endDate || e.date))
      .sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title));
  }
  const timeLabel = e => e.allDay ? (e.endDate && e.endDate !== e.date ? `jusqu'au ${shortDate(e.endDate)}` : "Journée") : `${hm(e.start)}–${hm(e.end)}`;
  const isHighlight = e => ["spectacle", "generale", "weekend"].includes(e.pole);

  // ---------- Render ----------
  function setStatus(msg) { const s = $("#status"); s.textContent = msg; s.hidden = !msg; }

  function render() {
    $("#monthLabel").textContent = `${MONTHS[state.month]} ${state.year}`;
    document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
    $("#monthView").hidden = state.view !== "month";
    $("#listView").hidden = state.view !== "list";
    $("#addBtn").hidden = !state.auth;
    $("#authBtn").textContent = state.auth ? `✓ ${state.auth.name}` : "Accès responsable";
    $("#authBtn").title = state.auth ? "Connecté — cliquer pour gérer l'accès" : "Se connecter pour ajouter des créneaux";
    renderLegend();
    renderCountdown();
    if (state.view === "month") renderMonth(); else renderList();
    renderDayPanel();
    const upd = state.data.updatedAt ? ` · mis à jour le ${new Date(state.data.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "";
    $("#sourceInfo").textContent = `${state.data.events.length} créneaux · dépôt ${CFG.owner}/${CFG.repo}${upd}`;
  }

  function renderLegend() {
    const box = $("#legend"); box.replaceChildren();
    for (const p of state.data.poles) {
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
    else el.append(`${CFG.showLabel[0].toUpperCase() + CFG.showLabel.slice(1)} a eu lieu le ${longDate(CFG.showDate)}`);
  }

  function evButton(e, solidOk = true) {
    return h("button", {
      type: "button", class: `ev${solidOk && isHighlight(e) ? " solid" : ""}`, style: `--c:${colorOf(e)}`,
      title: `${e.title} · ${timeLabel(e)}${e.location ? " · " + e.location : ""}`,
      onclick: ev => { ev.stopPropagation(); openEvent(e); }
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
    if (isPhone() || !state.auth) { selectDay(key); return; }
    openEditor(null, key);
  }
  function selectDay(key) {
    state.selected = state.selected === key && !isPhone() ? null : key;
    render();
    if (state.selected) $("#dayPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function rowFor(e) {
    const p = poleOf(e.pole);
    return h("button", { type: "button", class: "row", style: `--c:${colorOf(e)}`, onclick: () => openEvent(e) },
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
      h("h3", {}, longDate(key).replace(/^./, c => c.toUpperCase()), h("span", { class: "spacer" }),
        state.auth ? h("button", { type: "button", class: "btn small", onclick: () => openEditor(null, key) }, "+ Ajouter ce jour") : null,
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

  // ---------- Event dialogs ----------
  function openEvent(e) { state.auth ? openEditor(e) : openView(e); }

  function openView(e) {
    const p = poleOf(e.pole);
    $("#viewTitle").textContent = e.title;
    const dl = h("dl", { class: "vd" },
      h("dt", {}, "Pôle"), h("dd", {}, h("span", { class: "badge", style: `--c:${colorOf(e)}` }, p.name)),
      h("dt", {}, "Date"), h("dd", {}, e.endDate && e.endDate !== e.date ? `du ${longDate(e.date)} au ${longDate(e.endDate)}` : longDate(e.date)),
      h("dt", {}, "Horaire"), h("dd", {}, e.allDay ? "Horaire à préciser" : `${hm(e.start)} – ${hm(e.end)}`),
      e.location ? [h("dt", {}, "Lieu"), h("dd", {}, e.location)] : null,
      e.notes ? [h("dt", {}, "Notes"), h("dd", {}, e.notes)] : null);
    $("#viewBody").replaceChildren(dl);
    $("#viewDlg").showModal();
  }

  function fillPoleSelect() {
    const sel = $("#poleSelect"); sel.replaceChildren();
    state.data.poles.forEach(p => sel.append(h("option", { value: p.id }, p.name)));
  }

  function openEditor(e, day) {
    const f = $("#eventForm");
    fillPoleSelect();
    f.reset();
    state.editing = e ? { ...e } : null;
    const base = e || { title: "", pole: state.data.poles[0]?.id || "autre", date: day || todayStr(), start: "17:00", end: "18:30", allDay: false, location: "", notes: "" };
    f.title.value = base.title;
    f.pole.value = base.pole;
    f.date.value = base.date;
    f.endDate.value = base.endDate || "";
    f.allDay.checked = !!base.allDay;
    f.start.value = base.start || "17:00";
    f.end.value = base.end || "18:30";
    f.location.value = base.location || "";
    f.notes.value = base.notes || "";
    f.color.value = colorOf(base);
    f.dataset.custom = base.color ? "1" : "";
    f.classList.toggle("allday", f.allDay.checked);
    f.repeatUntil.value = "";
    $("#repeatBox").hidden = !!e;
    $("#scopeBox").hidden = !(e && e.seriesId);
    $("#deleteBtn").hidden = !e;
    $("#eventDlgTitle").textContent = e ? "Modifier le créneau" : "Nouveau créneau";
    $("#eventMeta").textContent = e?.updatedBy ? `Dernière modification : ${e.updatedBy}` : "";
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
      updatedBy: state.auth?.name || ""
    };
    if (allDay && f.endDate.value && f.endDate.value > ev.date) ev.endDate = f.endDate.value;
    if (!ev.title) throw new Error("Donnez un titre au créneau.");
    if (!ev.date) throw new Error("Choisissez une date.");
    if (!allDay && (!ev.start || !ev.end || ev.end <= ev.start)) throw new Error("L'heure de fin doit être après l'heure de début.");
    if (allDay && f.endDate.value && f.endDate.value < ev.date) throw new Error("La date de fin doit être après la date de début.");
    return ev;
  }

  async function saveEvent() {
    const f = $("#eventForm");
    let ev;
    try { ev = readForm(); } catch (err) { toast(err.message, true); return; }
    const old = state.editing;
    const scope = f.scope.value || "one";
    let msg, mutate;
    if (!old) {
      const dates = [ev.date];
      if (f.repeat.checked) {
        const until = f.repeatUntil.value;
        if (!until || until <= ev.date) { toast("Indiquez jusqu'à quand répéter le créneau.", true); return; }
        for (let d = addDays(ev.date, 7); d <= until && dates.length < 80; d = addDays(d, 7)) dates.push(d);
      }
      const seriesId = dates.length > 1 ? uid() : null;
      const created = dates.map(d => {
        const span = ev.endDate ? diffDays(ev.date, ev.endDate) : 0;
        const o = { id: uid(), ...ev, date: d, seriesId };
        if (span) o.endDate = addDays(d, span);
        return o;
      });
      mutate = data => { data.events.push(...created); };
      msg = dates.length > 1 ? `ajout de « ${ev.title} » (${dates.length} séances à partir du ${ev.date})` : `ajout de « ${ev.title} » (${ev.date})`;
    } else if (old.seriesId && scope === "future") {
      const shift = diffDays(old.date, ev.date);
      mutate = data => {
        data.events = data.events.map(x => {
          if (x.seriesId !== old.seriesId || x.date < old.date) return x;
          const nd = addDays(x.date, shift);
          const o = { ...x, ...ev, date: nd };
          if (ev.endDate) o.endDate = addDays(nd, diffDays(ev.date, ev.endDate)); else delete o.endDate;
          return o;
        });
      };
      msg = `modification de la série « ${ev.title} » à partir du ${old.date}`;
    } else {
      mutate = data => {
        data.events = data.events.map(x => {
          if (x.id !== old.id) return x;
          const o = { ...x, ...ev };
          if (!ev.endDate) delete o.endDate;
          return o;
        });
      };
      msg = `modification de « ${ev.title} » (${ev.date})`;
    }
    await run(mutate, msg, "Créneau enregistré.");
  }

  async function deleteEvent() {
    const old = state.editing; if (!old) return;
    const scope = $("#eventForm").scope.value || "one";
    const all = old.seriesId && scope === "future";
    const mutate = data => {
      data.events = data.events.filter(x => all ? !(x.seriesId === old.seriesId && x.date >= old.date) : x.id !== old.id);
    };
    await run(mutate, all ? `suppression de la série « ${old.title} » à partir du ${old.date}` : `suppression de « ${old.title} » (${old.date})`, "Créneau supprimé.");
  }

  async function run(mutate, msg, okMsg) {
    const btns = document.querySelectorAll("#eventDlg .dlg-foot .btn");
    btns.forEach(b => b.disabled = true);
    $("#saveBtn").textContent = "Enregistrement…";
    try {
      await commit(mutate, msg);
      $("#eventDlg").close();
      toast(okMsg);
    } catch (err) {
      if (err.message !== "not-authenticated") toast(explain(err), true);
    } finally {
      btns.forEach(b => b.disabled = false);
      $("#saveBtn").textContent = "Enregistrer";
    }
  }

  // ---------- Auth ----------
  function openAuth() {
    const f = $("#authForm");
    f.name.value = state.auth?.name || "";
    f.token.value = state.auth?.token || "";
    $("#authErr").hidden = true;
    $("#logoutBtn").hidden = !state.auth;
    $("#readmeLink").href = `https://github.com/${CFG.owner}/${CFG.repo}#readme`;
    $("#authDlg").showModal();
  }
  async function submitAuth() {
    const f = $("#authForm");
    const name = f.name.value.trim(), token = f.token.value.trim();
    const err = $("#authErr");
    if (!name || !token) return;
    err.hidden = true;
    try {
      const r = await fetch(API, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } });
      if (r.status === 401) throw new Error("Ce jeton n'est pas reconnu par GitHub.");
      if (!r.ok) throw new Error(`Le dépôt ${CFG.owner}/${CFG.repo} n'est pas accessible avec ce jeton.`);
      const j = await r.json();
      if (j.permissions && !j.permissions.push) throw new Error("Ce jeton peut lire le dépôt mais pas y écrire. Demandez à être ajouté comme collaborateur.");
      state.auth = { name, token };
      store.set(LS.auth, state.auth);
      $("#authDlg").close();
      toast(`Bienvenue ${name} ! Vous pouvez ajouter des créneaux.`);
      load();
    } catch (e) {
      err.textContent = e.message || "Vérification impossible. Vérifiez votre connexion.";
      err.hidden = false;
    }
  }

  // ---------- ICS export ----------
  function exportIcs() {
    const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const compact = s => s.replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Metz Musical//Planning//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Metz Musical — Répétitions", "X-WR-TIMEZONE:Europe/Paris"];
    for (const e of state.data.events) {
      if (state.hidden.has(e.pole)) continue;
      lines.push("BEGIN:VEVENT", `UID:${e.id}@metz-musical`, `DTSTAMP:${stamp}`);
      if (e.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.endDate || e.date, 1))}`);
      } else {
        lines.push(`DTSTART;TZID=Europe/Paris:${compact(e.date)}T${e.start.replace(":", "")}00`, `DTEND;TZID=Europe/Paris:${compact(e.date)}T${e.end.replace(":", "")}00`);
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
  $("#authBtn").onclick = openAuth;
  $("#icsBtn").onclick = exportIcs;
  $("#viewClose").onclick = () => $("#viewDlg").close();
  $("#viewLogin").onclick = () => { $("#viewDlg").close(); openAuth(); };
  $("#deleteBtn").onclick = () => { if (confirm("Supprimer ce créneau ?")) deleteEvent(); };
  $("#resetColor").onclick = () => { const f = $("#eventForm"); f.dataset.custom = ""; f.color.value = poleOf(f.pole.value).color; };
  $("#eventForm").color.addEventListener("input", () => { $("#eventForm").dataset.custom = "1"; });
  $("#eventForm").pole.addEventListener("change", () => { const f = $("#eventForm"); if (!f.dataset.custom) f.color.value = poleOf(f.pole.value).color; });
  $("#eventForm").allDay.addEventListener("change", e => $("#eventForm").classList.toggle("allday", e.target.checked));
  $("#eventForm").addEventListener("submit", e => {
    if (e.submitter?.value === "save") { e.preventDefault(); saveEvent(); }
  });
  $("#authForm").addEventListener("submit", e => {
    if (e.submitter?.value === "ok") { e.preventDefault(); submitAuth(); }
  });
  $("#logoutBtn").onclick = () => { state.auth = null; store.del(LS.auth); $("#authDlg").close(); toast("Déconnecté."); render(); };
  document.addEventListener("keydown", e => {
    if (document.querySelector("dialog[open]") || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") shiftMonth(-1);
    if (e.key === "ArrowRight") shiftMonth(1);
  });
  // Refresh when the tab comes back into view so everyone sees others' changes.
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !document.querySelector("dialog[open]")) load(); });
  matchMedia("(max-width: 720px)").addEventListener("change", render);

  if (isPhone()) state.selected = todayStr();
  render();
  load();
})();
