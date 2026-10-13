/* Daily Task — 과목별로 하루 분량을 나눠 읽고, 빼먹으면 벌칙 */

/* ───────── 날짜 ───────── */
const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => fmt(new Date());
const dnum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const dstr = (n) => { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
const md = (s) => Number(s.slice(5, 7)) + '/' + Number(s.slice(8));
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const longDate = () => { const d = new Date(); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WEEK[d.getDay()] + '요일'; };

/* ───────── 저장 ─────────
   done: { "과목:항목번호": 완료한 날 }   full: 그날 할 일을 다 끝낸 날들
   pen:  { "과목|날짜": 복습한 Day }     cfg:  { 과목: { perDay } }          */
const LS_KEY = 'daily-task-v1';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } };
const lsSet = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {} };
const empty = () => ({ done: {}, full: [], pen: {}, cfg: {} });
function norm(s) { s = s || {}; return { done: s.done || {}, full: s.full || [], pen: s.pen || {}, cfg: s.cfg || {} }; }
function merge(a, b) {
  a = norm(a); b = norm(b);
  const done = { ...a.done };
  for (const [k, v] of Object.entries(b.done)) if (!done[k] || v < done[k]) done[k] = v;
  return { done, full: [...new Set([...a.full, ...b.full])].sort(), pen: { ...a.pen, ...b.pen }, cfg: { ...a.cfg, ...b.cfg } };
}
let dbRef = null, writing = Promise.resolve();
const remoteSave = (s) => { if (!dbRef) return; writing = writing.then(() => dbRef.set(s)).catch(() => {}); };

/* ───────── 하루 묶음 ───────── */
const perDayOf = (subj, st) => (st.cfg[subj.id] && st.cfg[subj.id].perDay) || subj.perDay || 1;
function buildDays(subj, perDay) {
  const out = []; let cur = null;
  subj.items.forEach((it, ii) => {
    if (!cur || cur.g !== it.g || cur.iis.length >= perDay) { cur = { g: it.g, iis: [] }; out.push(cur); }
    cur.iis.push(ii);
  });
  return out.map((d) => ({ iis: d.iis, pages: d.iis.flatMap((ii) => (subj.items[ii].pages || []).map((p) => ({ ii, p }))) }));
}
const key = (sid, ii) => sid + ':' + (ii + 1);
const dayDone = (subj, st, d) => { const ds = d.iis.map((ii) => st.done[key(subj.id, ii)]); return ds.every(Boolean) ? [...ds].sort()[ds.length - 1] : null; };
const range = (d) => { const ps = d.pages.map((x) => x.p); return ps.length ? ps[0] + '~' + ps[ps.length - 1] + '쪽' : ''; };

/* ───────── 계획 + 벌칙 ─────────
   시작일 = 그 과목을 처음 완료한 날. 그날부터 하루에 Day 1개씩.
   아침 기준으로 밀렸으면: ① 마지막으로 끝낸 Day를 다시 읽어야(벌칙 복습) ② 밀린 Day가 열리고 ③ 밀린 것+오늘 것을 오늘 다 해야 함 */
function planOf(subj, days, st) {
  const t = today();
  const doneDates = days.map((d) => dayDone(subj, st, d));
  const mine = Object.entries(st.done).filter(([k]) => k.startsWith(subj.id + ':')).map(([, v]) => v).sort();
  const start = mine[0] || null;
  const diff = start ? dnum(t) - dnum(start) : 0;
  const doneBefore = doneDates.filter((x) => x && x < t).length;
  const behind = start ? Math.max(0, Math.min(diff, days.length) - doneBefore) : 0;
  let reviewIdx = -1;
  doneDates.forEach((x, i) => { if (x && x < t) reviewIdx = i; });
  const penalty = behind > 0 && reviewIdx >= 0;
  const penDone = !!st.pen[subj.id + '|' + t];
  const due = [];
  for (let i = 0; i <= Math.min(diff, days.length - 1); i++) if (!doneDates[i]) due.push(i);
  const doneToday = doneDates.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
  const next = doneDates.findIndex((x) => !x);
  return { start, behind, reviewIdx, penalty, penDone, locked: penalty && !penDone, due, doneToday, next, doneDates };
}

function streakOf(full) {
  const set = new Set(full); let n = 0; const d = new Date();
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
  while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ───────── 아이콘 ───────── */
const { useState, useEffect, useRef, useMemo } = React;
const html = htm.bind(React.createElement);
const ACC = '#2563eb', MISS = '#ea580c';
const Ico = {
  flame: (c) => html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke=${c} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg>`,
  check: (c) => html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke=${c || '#fff'} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
  chev: () => html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b5b5b5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  back: () => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
  lock: () => html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b5b5b5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  today: (c) => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke=${c} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
  cal: (c) => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke=${c} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`,
  flag: (c) => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke=${c} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V4M4 4h11l-2 4 2 4H4"/></svg>`,
  left: () => html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
  right: () => html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
};

/* ───────── 오늘 ───────── */
function TaskRow({ kind, subj, di, days, onClick, locked }) {
  const d = days[di];
  const n = d.iis.length;
  const done = kind === 'done' || kind === 'reviewed';
  const review = kind === 'review' || kind === 'reviewed';
  const label = review ? 'Day ' + (di + 1) + ' 다시 읽기' : subj.unit + ' ' + n + '개 읽기';
  const sub = (review ? '벌칙 복습 · ' : '') + subj.name + ' · Day ' + (di + 1) + '/' + days.length;
  const circle = done
    ? html`<span class="w-[26px] h-[26px] rounded-full grid place-items-center shrink-0 mt-0.5" style=${{ background: review ? MISS : '#111' }}>${Ico.check()}</span>`
    : html`<span class="w-[26px] h-[26px] rounded-full border-2 shrink-0 mt-0.5" style=${{ borderColor: review ? MISS : '#cfcfcf' }}></span>`;
  return html`<button onClick=${onClick} class="w-full text-left flex gap-4 items-start py-[18px] border-b border-[#efefef] active:bg-neutral-50">
    ${circle}
    <span class="flex flex-col gap-1 flex-1 min-w-0">
      <span class="text-xs" style=${{ color: review ? MISS : '#6b6b6b' }}>${sub}</span>
      <span class=${'text-[17px] font-bold ' + (done ? 'text-[#9a9a9a] line-through' : '')}>${label}</span>
      <span class=${'text-[13px] truncate ' + (done ? 'text-[#9a9a9a]' : 'text-[#6b6b6b]')}>${range(d)}${d.iis.length ? ' · ' + d.iis.map((ii) => subj.items[ii].t).join(', ') : ''}</span>
    </span>
    <span class="mt-3.5 shrink-0">${locked ? Ico.lock() : done ? null : Ico.chev()}</span>
  </button>`;
}

function Today({ subjects, st, open, say }) {
  const rows = [];
  let total = 0, finished = 0, anyPenalty = null, allClear = true;
  subjects.forEach(({ subj, days, plan }) => {
    if (plan.penalty) {
      total++; if (plan.penDone) finished++;
      if (!plan.penDone) anyPenalty = anyPenalty || { subj, plan };
      rows.push(html`<${TaskRow} key=${subj.id + 'r'} kind=${plan.penDone ? 'reviewed' : 'review'} subj=${subj} days=${days} di=${plan.reviewIdx}
        onClick=${() => !plan.penDone && open(subj.id, plan.reviewIdx, true)} />`);
    }
    plan.doneToday.forEach((i) => { total++; finished++; rows.push(html`<${TaskRow} key=${subj.id + 'd' + i} kind="done" subj=${subj} days=${days} di=${i} onClick=${() => open(subj.id, i)} />`); });
    plan.due.forEach((i) => {
      total++; allClear = false;
      rows.push(html`<${TaskRow} key=${subj.id + 'u' + i} kind="todo" subj=${subj} days=${days} di=${i} locked=${plan.locked}
        onClick=${() => (plan.locked ? say('벌칙 복습부터 끝내야 열려요') : open(subj.id, i))} />`);
    });
  });
  const pct = total ? Math.round((finished / total) * 100) : 0;
  const streak = streakOf(st.full);
  const ahead = subjects.filter(({ plan }) => plan.due.length === 0 && plan.next !== -1);

  return html`<div class="flex flex-col gap-7">
    <div class="flex justify-between items-start">
      <div class="flex flex-col gap-1">
        <div class="text-sm text-[#6b6b6b]">${longDate()}</div>
        <h1 class="m-0 text-[34px] font-black tracking-tight">오늘</h1>
      </div>
      <div class="flex items-center gap-1.5 border border-[#e5e5e5] rounded-full px-3 py-2 text-[13px] font-bold">${Ico.flame(streak ? ACC : '#b5b5b5')}${streak}일 연속</div>
    </div>

    ${anyPenalty ? html`<div class="rounded-2xl px-4 py-3.5 border border-[#fed7aa] bg-[#fff7ed] flex flex-col gap-1">
      <span class="text-sm font-bold text-[#9a3412]">${anyPenalty.subj.name} ${anyPenalty.plan.behind}일 밀렸어요</span>
      <span class="text-[13px] text-[#7c2d12]">벌칙 복습을 끝내야 밀린 분량이 열려요. 연속 기록은 0부터 다시예요.</span>
    </div>` : null}

    <div class="flex flex-col gap-2">
      <div class="flex justify-between text-[13px] text-[#6b6b6b]"><span>${total ? total + '개 중 ' + finished + '개 끝' : '오늘 할 일 없음'}</span><span>${pct}%</span></div>
      <div class="h-1 bg-[#efefef] rounded"><div class="h-1 rounded transition-all" style=${{ width: pct + '%', background: ACC }}></div></div>
    </div>

    <div class="flex flex-col -mt-3">${rows}</div>

    ${allClear && total ? html`<div class="text-sm text-[#6b6b6b] -mt-3">오늘 할 일 끝. 내일 또 봐요.</div>` : null}
    ${ahead.length ? html`<div class="flex flex-col gap-1 -mt-3">
      ${ahead.map(({ subj, plan }) => html`<button key=${subj.id} onClick=${() => open(subj.id, plan.next)} class="self-start text-[15px] text-[#6b6b6b] py-1 underline underline-offset-4 decoration-[#d4d4d4]">${subj.name} Day ${plan.next + 1} 미리 읽기</button>`)}
    </div>` : null}
  </div>`;
}

/* ───────── 기록 ───────── */
function Log({ subjects, st }) {
  const t = today();
  const [ym, setYm] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()]; });
  const [y, m] = ym;
  const allDone = Object.values(st.done).sort();
  const start = allDone[0] || null;
  const studied = new Set(Object.values(st.done));
  const full = new Set(st.full);
  const first = new Date(y, m, 1); const lead = (first.getDay() + 6) % 7; const nd = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let n = 1; n <= nd; n++) {
    const s = fmt(new Date(y, m, n));
    let kind = 'none';
    if (full.has(s)) kind = 'full';
    else if (studied.has(s)) kind = s === t ? 'part' : 'partmiss';
    else if (start && s >= start && s < t) kind = 'miss';
    cells.push({ n, s, kind, isToday: s === t });
  }
  let missCount = 0;
  if (start) for (let k = dnum(start); k < dnum(t); k++) if (!full.has(dstr(k))) missCount++;
  const penCount = Object.keys(st.pen).length;
  const shift = (k) => { const d = new Date(y, m + k, 1); setYm([d.getFullYear(), d.getMonth()]); };
  const style = (c) => {
    if (c.kind === 'full') return { background: ACC, color: '#fff' };
    if (c.kind === 'miss') return { background: MISS, color: '#fff' };
    if (c.kind === 'partmiss') return { background: '#fed7aa', color: '#7c2d12' };
    if (c.kind === 'part') return { background: '#dbeafe', color: '#1e3a8a' };
    return { background: '#f8fafc', color: c.s < t ? '#a3a3a3' : '#6b6b6b' };
  };

  return html`<div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <h1 class="m-0 text-[34px] font-black tracking-tight">기록</h1>
      <div class="flex items-center gap-1">
        <button onClick=${() => shift(-1)} class="w-10 h-10 grid place-items-center rounded-full active:bg-neutral-100" aria-label="이전 달">${Ico.left()}</button>
        <span class="text-[15px] font-bold text-center whitespace-nowrap px-1">${y}년 ${m + 1}월</span>
        <button onClick=${() => shift(1)} class="w-10 h-10 grid place-items-center rounded-full active:bg-neutral-100" aria-label="다음 달">${Ico.right()}</button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2.5">
      ${[['연속', streakOf(st.full), '일', '#111'], ['완료', st.full.length, '일', '#111'], ['빠짐', missCount, '일', missCount ? MISS : '#111']].map(([l, v, u, c]) => html`<div key=${l} class="border border-[#e5e5e5] rounded-2xl px-3.5 py-3 flex flex-col">
        <span class="text-xs text-[#6b6b6b]">${l}</span>
        <span class="text-[22px] font-bold tabular-nums" style=${{ color: c }}>${v}<span class="text-[13px] font-medium"> ${u}</span></span>
      </div>`)}
    </div>

    <div class="flex flex-col gap-2">
      <div class="grid grid-cols-7 gap-1.5 text-[11px] text-[#a3a3a3] text-center">${['월', '화', '수', '목', '금', '토', '일'].map((w) => html`<span key=${w}>${w}</span>`)}</div>
      <div class="grid grid-cols-7 gap-1.5">
        ${cells.map((c, i) => c ? html`<div key=${i} class="h-10 rounded-[10px] grid place-items-center text-xs font-medium tabular-nums box-border"
          style=${{ ...style(c), border: c.isToday ? '2px solid #111' : 'none' }}>${c.n}</div>` : html`<div key=${i}></div>`)}
      </div>
      <div class="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-[#525252] pt-1">
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-[3px]" style=${{ background: ACC }}></span>다 함</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-[3px]" style=${{ background: '#fed7aa' }}></span>일부만</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-[3px]" style=${{ background: MISS }}></span>빠짐</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-[3px] border-2 border-[#111] box-border"></span>오늘</span>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      ${subjects.map(({ subj, days, plan }) => {
        const n = plan.doneDates.filter(Boolean).length;
        return html`<div key=${subj.id} class="flex flex-col gap-1.5">
          <div class="flex justify-between text-sm"><span class="font-bold">${subj.name}</span><span class="text-[#6b6b6b]">${n} / ${days.length}일</span></div>
          <div class="h-1.5 rounded bg-[#f1f1f1]"><div class="h-1.5 rounded" style=${{ width: (n / days.length) * 100 + '%', background: ACC }}></div></div>
        </div>`;
      })}
    </div>
    ${penCount ? html`<div class="text-xs text-[#6b6b6b]">지금까지 벌칙 복습 ${penCount}번</div>` : null}
  </div>`;
}

/* ───────── 과목 ───────── */
function Subjects({ subjects, st, setPerDay, open }) {
  const [openId, setOpenId] = useState(null);
  return html`<div class="flex flex-col gap-6">
    <h1 class="m-0 text-[34px] font-black tracking-tight">과목</h1>
    ${subjects.map(({ subj, days, plan }) => {
      const pd = perDayOf(subj, st);
      const started = !!plan.start;
      const n = plan.doneDates.filter(Boolean).length;
      return html`<div key=${subj.id} class="flex flex-col gap-4 border-b border-[#efefef] pb-6">
        <div class="flex justify-between items-baseline">
          <div class="flex flex-col gap-0.5"><span class="text-xl font-bold">${subj.name}</span><span class="text-[13px] text-[#6b6b6b]">${subj.desc} · ${subj.unit} ${subj.items.length}개</span></div>
          <span class="text-[13px] text-[#6b6b6b]">${n}/${days.length}일</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm">하루에 ${subj.unit}</span>
          <div class="flex border border-[#e5e5e5] rounded-full p-0.5">
            ${[1, 2, 3].map((k) => html`<button key=${k} disabled=${started && k !== pd} onClick=${() => setPerDay(subj.id, k)}
              class=${'w-11 h-9 rounded-full text-sm font-bold disabled:opacity-30 ' + (k === pd ? 'bg-[#111] text-white' : 'text-[#525252]')}>${k}개</button>`)}
          </div>
        </div>
        ${started ? html`<div class="text-xs text-[#9a9a9a] -mt-2">시작한 뒤에는 하루 분량을 바꿀 수 없어요</div>` : null}
        <button onClick=${() => setOpenId(openId === subj.id ? null : subj.id)} class="self-start text-sm text-[#6b6b6b] underline underline-offset-4 decoration-[#d4d4d4]">${openId === subj.id ? '전체 일정 접기' : '전체 일정 보기'} · ${days.length}일</button>
        ${openId === subj.id ? html`<div class="flex flex-col">
          ${days.map((d, i) => {
            const dn = plan.doneDates[i];
            const locked = plan.locked && !dn;
            return html`<button key=${i} onClick=${() => !locked && open(subj.id, i)} class="text-left flex gap-3 items-center py-3 border-b border-[#f3f3f3] active:bg-neutral-50">
              <span class=${'w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ' + (dn ? 'bg-[#111] text-white' : i === plan.next ? 'text-white' : 'bg-[#f3f3f3] text-[#6b6b6b]')} style=${!dn && i === plan.next ? { background: ACC } : null}>${dn ? Ico.check() : i + 1}</span>
              <span class="flex-1 min-w-0">
                ${d.iis.map((ii) => html`<span key=${ii} class=${'block text-sm font-semibold truncate ' + (dn ? 'text-[#9a9a9a]' : '')}>${subj.items[ii].t}</span>`)}
                <span class="block text-xs text-[#9a9a9a]">${range(d)}${dn ? ' · ' + md(dn) + ' 완료' : ''}</span>
              </span>
              ${locked ? Ico.lock() : null}
            </button>`;
          })}
        </div>` : null}
        ${subj.note ? html`<div class="text-xs text-[#9a9a9a]">${subj.note}</div>` : null}
      </div>`;
    })}
  </div>`;
}

/* ───────── 읽기 화면 ───────── */
function Reader({ subj, days, di, review, st, back, complete }) {
  const d = days[di];
  const dn = dayDone(subj, st, d);
  const [zoom, setZoom] = useState(null);
  const [cur, setCur] = useState(0);
  const refs = useRef([]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setCur(Number(e.target.dataset.i)); }), { rootMargin: '-45% 0px -50% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const it = d.pages[Math.min(cur, d.pages.length - 1)];
  const item = subj.items[it.ii];
  const acc = review ? MISS : ACC;

  return html`<div class="min-h-screen bg-white">
    <div class="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#efefef]" style=${{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div class="max-w-3xl mx-auto px-2 py-2 flex items-center gap-1">
        <button onClick=${back} class="w-11 h-11 grid place-items-center rounded-full active:bg-neutral-100" aria-label="뒤로">${Ico.back()}</button>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-semibold" style=${{ color: acc }}>${review ? '벌칙 복습 · ' : ''}${subj.name} · Day ${di + 1}</div>
          <div class="text-sm font-bold truncate">${item.t}</div>
        </div>
        <div class="text-xs font-semibold text-[#6b6b6b] tabular-nums pr-2">${it.p}쪽 · ${cur + 1}/${d.pages.length}</div>
      </div>
      <div class="h-[3px] bg-[#f1f1f1]"><div class="h-[3px] transition-all" style=${{ width: ((cur + 1) / d.pages.length) * 100 + '%', background: acc }}></div></div>
    </div>

    <div class="max-w-3xl mx-auto px-2 sm:px-4 pt-3 pb-10 flex flex-col gap-3">
      ${d.pages.map((x, i) => html`<div key=${x.p} class="flex flex-col gap-2">
        ${i === 0 || d.pages[i - 1].ii !== x.ii ? html`<div class=${'flex flex-col gap-0.5 px-2 ' + (i ? 'pt-5' : 'pt-1')}>
          <span class="text-xs font-semibold" style=${{ color: acc }}>${subj.items[x.ii].tag || ''}</span>
          <span class="text-lg font-bold">${subj.items[x.ii].t}</span>
        </div>` : null}
        <figure ref=${(el) => (refs.current[i] = el)} data-i=${i} class="m-0 border border-[#efefef] rounded-xl overflow-hidden">
          <img src=${subj.img(x.p)} alt=${x.p + '쪽'} loading=${i < 2 ? 'eager' : 'lazy'} class="w-full h-auto block" style=${{ aspectRatio: '1150/1463' }} onClick=${() => setZoom(x.p)} />
          <figcaption class="flex justify-between px-3 py-1.5 text-xs text-[#9a9a9a] border-t border-[#f3f3f3]"><span>${x.p}쪽</span><span>누르면 크게</span></figcaption>
        </figure>
      </div>`)}

      <div class="pt-4 pb-2 flex flex-col gap-2">
        ${review
          ? html`<button onClick=${() => complete(subj.id, di, true)} class="w-full py-4 rounded-2xl text-white font-bold text-base" style=${{ background: MISS }}>벌칙 복습 완료</button>`
          : dn ? html`<div class="text-center text-sm text-[#6b6b6b] py-3">${md(dn)}에 끝낸 분량이에요</div>`
          : html`<button onClick=${() => complete(subj.id, di, false)} class="w-full py-4 rounded-2xl bg-[#111] text-white font-bold text-base">다 읽었어요</button>`}
        <button onClick=${back} class="w-full py-3 text-sm text-[#6b6b6b]">나중에 마저 읽기</button>
      </div>
    </div>

    ${zoom ? html`<div class="fixed inset-0 z-50 bg-black flex flex-col">
      <div class="flex items-center justify-between px-4 py-2 text-white" style=${{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <span class="text-sm font-semibold">${zoom}쪽</span>
        <button onClick=${() => setZoom(null)} class="px-4 py-2 rounded-full bg-white/15 text-sm font-semibold">닫기</button>
      </div>
      <div class="flex-1 overflow-auto"><img src=${subj.img(zoom)} alt=${zoom + '쪽 크게'} class="block max-w-none" style=${{ width: 'max(200%, 1150px)' }} /></div>
    </div>` : null}
  </div>`;
}

/* ───────── 앱 ───────── */
function App() {
  const [st, setSt] = useState(() => merge(empty(), lsGet() || {}));
  const [tab, setTab] = useState('today');
  const [reader, setReader] = useState(null);
  const [toast, setToast] = useState(null);
  const [, tick] = useState(0);
  const stRef = useRef(st); stRef.current = st;

  useEffect(() => {
    const f = () => tick((n) => n + 1);
    document.addEventListener('visibilitychange', f);
    const iv = setInterval(f, 60000);
    return () => { document.removeEventListener('visibilitychange', f); clearInterval(iv); };
  }, []);

  // Claude 안에서 열었을 때만: 계정 저장소와 동기화
  useEffect(() => {
    (async () => {
      try {
        if (!window.claude || !claude.use) return;
        const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
        if (!db || !user) return;
        const uid = await user.id(); if (!uid) return;
        dbRef = db.doc('data/users/' + uid + '/daily-task');
        const snap = await dbRef.get();
        const m = merge(snap.exists ? snap.data() : empty(), stRef.current);
        setSt(m); lsSet(m);
      } catch (e) { dbRef = null; }
    })();
  }, []);

  const subjects = SUBJECTS.map((subj) => {
    const days = buildDays(subj, perDayOf(subj, st));
    return { subj, days, plan: planOf(subj, days, st) };
  });
  const save = (s) => { setSt(s); lsSet(s); remoteSave(s); };
  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(null), 2200); };

  const open = (sid, di, review) => { setReader({ sid, di, review: !!review }); };
  const complete = (sid, di, review) => {
    const t = today();
    const x = subjects.find((s) => s.subj.id === sid);
    let s;
    if (review) s = { ...st, pen: { ...st.pen, [sid + '|' + t]: di + 1 } };
    else {
      const done = { ...st.done };
      x.days[di].iis.forEach((ii) => { if (!done[key(sid, ii)]) done[key(sid, ii)] = t; });
      s = { ...st, done };
    }
    const after = SUBJECTS.map((subj) => { const days = buildDays(subj, perDayOf(subj, s)); return planOf(subj, days, s); });
    const left = after.reduce((a, p) => a + p.due.length + (p.locked ? 1 : 0), 0);
    const started = after.some((p) => p.start);
    if (!left && started && !s.full.includes(t)) s = { ...s, full: [...s.full, t].sort() };
    save(s);
    setReader(null); setTab('today'); window.scrollTo(0, 0);
    say(review ? '복습 끝! 밀린 분량이 열렸어요' : left ? '좋아요 · 오늘 ' + left + '개 남음' : '오늘 할 일 끝! ' + streakOf(s.full) + '일 연속');
  };
  const setPerDay = (sid, k) => save({ ...st, cfg: { ...st.cfg, [sid]: { perDay: k } } });

  if (reader) {
    const x = subjects.find((s) => s.subj.id === reader.sid);
    return html`<${Reader} subj=${x.subj} days=${x.days} di=${reader.di} review=${reader.review} st=${st}
      back=${() => { setReader(null); window.scrollTo(0, 0); }} complete=${complete} />`;
  }

  const tabs = [['today', '오늘', Ico.today], ['log', '기록', Ico.cal], ['subjects', '과목', Ico.flag]];
  return html`<div class="min-h-screen bg-white flex flex-col">
    <main class="flex-1 w-full max-w-md mx-auto px-6 pb-28" style=${{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
      ${tab === 'today' ? html`<${Today} subjects=${subjects} st=${st} open=${open} say=${say} />`
        : tab === 'log' ? html`<${Log} subjects=${subjects} st=${st} />`
        : html`<${Subjects} subjects=${subjects} st=${st} setPerDay=${setPerDay} open=${open} />`}
    </main>
    <nav class="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#efefef] z-30" style=${{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div class="max-w-md mx-auto flex justify-around">
        ${tabs.map(([id, label, ic]) => html`<button key=${id} onClick=${() => { setTab(id); window.scrollTo(0, 0); }}
          class=${'flex flex-col items-center gap-1 py-2.5 w-20 text-xs ' + (tab === id ? 'font-bold text-[#111]' : 'text-[#8a8a8a]')} aria-current=${tab === id ? 'page' : null}>
          ${ic(tab === id ? '#111' : '#8a8a8a')}${label}</button>`)}
      </div>
    </nav>
    ${toast ? html`<div class="fixed left-1/2 -translate-x-1/2 z-50 bg-[#111] text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap" style=${{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}>${toast}</div>` : null}
  </div>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.claude) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
