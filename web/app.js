/* 교과서 보기 — 소주제를 골라 교과서 페이지를 보고, 본 쪽에 '봄' 표시 */

const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ───────── 저장 (폰 안) ─────────
   seen: { "과목:쪽": 표시한 날 }   last: { sid, ii, p } 마지막으로 보던 곳 */
const LS_KEY = 'textbook-v1';
const load = () => { try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {}; return { seen: s.seen || {}, last: s.last || null }; } catch (e) { return { seen: {}, last: null }; } };
const store = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {} };
const pk = (sid, p) => sid + ':' + p;

const { useState, useEffect, useRef } = React;
const html = htm.bind(React.createElement);

const Ico = {
  check: (c, s) => html`<svg width=${s || 14} height=${s || 14} viewBox="0 0 24 24" fill="none" stroke=${c || '#fff'} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
  chev: () => html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b5b5b5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  back: () => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
};

const rangeOf = (it) => it.pages[0] + '~' + it.pages[it.pages.length - 1] + '쪽';

/* ───────── 목록 ───────── */
function Home({ subj, subjects, setSid, st, open }) {
  const all = subj.items.flatMap((it) => it.pages);
  const seenAll = all.filter((p) => st.seen[pk(subj.id, p)]).length;
  const pct = all.length ? Math.round((seenAll / all.length) * 100) : 0;
  const last = st.last && st.last.sid === subj.id ? st.last : null;

  return html`<div class="flex flex-col gap-6">
    ${subjects.length > 1 ? html`<div class="flex gap-2 flex-wrap">${subjects.map((s) => html`<button key=${s.id} onClick=${() => setSid(s.id)}
      class=${'px-4 py-2 rounded-full text-sm font-bold ' + (s.id === subj.id ? 'bg-[#111] text-white' : 'border border-[#e5e5e5] text-[#525252]')}>${s.name}</button>`)}</div>` : null}

    <div class="flex justify-between items-end">
      <div class="flex flex-col gap-1">
        <div class="text-sm text-[#6b6b6b]">${subj.desc}</div>
        <h1 class="m-0 text-[34px] font-black tracking-tight">${subj.name}</h1>
      </div>
      <div class="text-sm font-bold tabular-nums pb-1.5">${seenAll} / ${all.length}쪽 봄</div>
    </div>

    <div class="h-1 bg-[#efefef] rounded -mt-3"><div class="h-1 rounded bg-[#111] transition-all" style=${{ width: pct + '%' }}></div></div>

    ${last ? html`<button onClick=${() => open(last.ii, last.p)} class="w-full py-4 rounded-2xl bg-[#111] text-white font-bold text-base flex items-center justify-center gap-2">
      이어서 보기 · ${last.p}쪽</button>` : null}

    <div class="flex flex-col">
      ${subj.items.map((it, ii) => {
        const n = it.pages.filter((p) => st.seen[pk(subj.id, p)]).length;
        const full = n === it.pages.length;
        const newG = ii === 0 || subj.items[ii - 1].g !== it.g;
        return html`<div key=${ii}>
          ${newG ? html`<div class="text-xs font-bold text-[#8a8a8a] pt-5 pb-1">${it.g}단원</div>` : null}
          <button onClick=${() => { const first = it.pages.find((p) => !st.seen[pk(subj.id, p)]); open(ii, first || it.pages[0]); }}
            class="w-full text-left flex gap-4 items-center py-4 border-b border-[#efefef] active:bg-neutral-50">
            ${full
              ? html`<span class="w-[26px] h-[26px] rounded-full bg-[#111] grid place-items-center shrink-0">${Ico.check()}</span>`
              : html`<span class=${'w-[26px] h-[26px] rounded-full border-2 shrink-0 ' + (n ? 'border-[#111]' : 'border-[#cfcfcf]')}></span>`}
            <span class="flex flex-col gap-0.5 flex-1 min-w-0">
              <span class="text-xs text-[#6b6b6b]">${it.tag}</span>
              <span class=${'text-[16px] font-bold leading-snug ' + (full ? 'text-[#9a9a9a]' : '')}>${it.t}</span>
              <span class="text-[13px] text-[#8a8a8a]">${rangeOf(it)}${n && !full ? ' · ' + n + '/' + it.pages.length + '쪽 봄' : ''}</span>
            </span>
            ${Ico.chev()}
          </button>
        </div>`;
      })}
    </div>
    ${subj.note ? html`<div class="text-xs text-[#9a9a9a]">${subj.note}</div>` : null}
  </div>`;
}

/* ───────── 교과서 보기 ───────── */
function Reader({ subj, ii, startP, st, toggle, markAll, back, go, setLast }) {
  const it = subj.items[ii];
  const [zoom, setZoom] = useState(null);
  const [cur, setCur] = useState(Math.max(0, it.pages.indexOf(startP)));
  const refs = useRef([]);

  useEffect(() => {
    const i = Math.max(0, it.pages.indexOf(startP));
    if (i > 0 && refs.current[i]) refs.current[i].scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setCur(Number(e.target.dataset.i)); }), { rootMargin: '-45% 0px -50% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [ii]);
  useEffect(() => { setLast(ii, it.pages[cur]); }, [ii, cur]);

  const n = it.pages.filter((p) => st.seen[pk(subj.id, p)]).length;
  const prev = ii > 0 ? subj.items[ii - 1] : null;
  const next = ii < subj.items.length - 1 ? subj.items[ii + 1] : null;

  return html`<div class="min-h-screen bg-white">
    <div class="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#efefef]" style=${{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div class="max-w-3xl mx-auto px-2 py-2 flex items-center gap-1">
        <button onClick=${back} class="w-11 h-11 grid place-items-center rounded-full active:bg-neutral-100" aria-label="목록으로">${Ico.back()}</button>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-semibold text-[#6b6b6b]">${it.tag}</div>
          <div class="text-sm font-bold truncate">${it.t}</div>
        </div>
        <div class="text-xs font-semibold text-[#6b6b6b] tabular-nums pr-2">${n}/${it.pages.length}쪽 봄</div>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-2 sm:px-4 pt-3 pb-10 flex flex-col gap-3">
      ${it.pages.map((p, i) => {
        const seen = !!st.seen[pk(subj.id, p)];
        return html`<figure key=${p} ref=${(el) => (refs.current[i] = el)} data-i=${i} class="m-0 border border-[#efefef] rounded-xl overflow-hidden scroll-mt-16">
          <img src=${subj.img(p)} alt=${p + '쪽'} loading=${Math.abs(i - it.pages.indexOf(startP)) < 2 ? 'eager' : 'lazy'} class="w-full h-auto block" style=${{ aspectRatio: '1150/1463' }} onClick=${() => setZoom(p)} />
          <figcaption class="flex items-center justify-between pl-3 pr-2 py-2 border-t border-[#f3f3f3]">
            <span class="text-sm text-[#6b6b6b] tabular-nums">${p}쪽</span>
            <button onClick=${() => toggle(p)} aria-pressed=${seen}
              class=${'flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-bold ' + (seen ? 'bg-[#111] text-white' : 'border border-[#d4d4d4] text-[#525252]')}>
              ${seen ? Ico.check() : null}${seen ? '봄' : '봄 표시'}</button>
          </figcaption>
        </figure>`;
      })}

      <div class="pt-3 flex flex-col gap-2">
        ${n < it.pages.length ? html`<button onClick=${() => markAll(ii)} class="w-full py-4 rounded-2xl bg-[#111] text-white font-bold text-base">이 소주제 전부 봄</button>` : html`<div class="text-center text-sm text-[#6b6b6b] py-2">이 소주제는 다 봤어요</div>`}
        <div class="flex gap-2">
          <button disabled=${!prev} onClick=${() => go(ii - 1)} class="flex-1 py-3 rounded-2xl border border-[#e5e5e5] text-sm font-semibold disabled:opacity-30">‹ 이전 소주제</button>
          <button disabled=${!next} onClick=${() => go(ii + 1)} class="flex-1 py-3 rounded-2xl border border-[#e5e5e5] text-sm font-semibold disabled:opacity-30">다음 소주제 ›</button>
        </div>
      </div>
    </div>

    ${zoom ? html`<div data-zoom class="fixed inset-0 z-50 bg-black flex flex-col">
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
  const [st, setSt] = useState(load);
  const [sid, setSid] = useState(SUBJECTS[0].id);
  const [reader, setReader] = useState(null);   // { ii, p }
  const navRef = useRef({}); navRef.current = { reader };
  const subj = SUBJECTS.find((s) => s.id === sid) || SUBJECTS[0];

  const save = (fn) => setSt((prev) => { const s = fn(prev); store(s); return s; });
  const toggle = (p) => save((s) => {
    const seen = { ...s.seen }; const k = pk(subj.id, p);
    if (seen[k]) delete seen[k]; else seen[k] = today();
    return { ...s, seen };
  });
  const markAll = (ii) => save((s) => {
    const seen = { ...s.seen };
    subj.items[ii].pages.forEach((p) => { const k = pk(subj.id, p); if (!seen[k]) seen[k] = today(); });
    return { ...s, seen };
  });
  const setLast = (ii, p) => save((s) => ({ ...s, last: { sid: subj.id, ii, p } }));
  const open = (ii, p) => setReader({ ii, p });
  const home = () => { setReader(null); window.scrollTo(0, 0); };

  // 안드로이드 뒤로가기: 확대 닫기 → 목록 → 앱 닫기
  useEffect(() => {
    const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!AppPlugin) return;
    const h = AppPlugin.addListener('backButton', () => {
      const z = document.querySelector('[data-zoom] button');
      if (z) z.click();
      else if (navRef.current.reader) home();
      else AppPlugin.exitApp();
    });
    return () => { Promise.resolve(h).then((x) => x && x.remove && x.remove()); };
  }, []);

  if (reader) {
    return html`<${Reader} key=${reader.ii} subj=${subj} ii=${reader.ii} startP=${reader.p} st=${st}
      toggle=${toggle} markAll=${markAll} setLast=${setLast} back=${home}
      go=${(ii) => setReader({ ii, p: subj.items[ii].pages[0] })} />`;
  }
  return html`<main class="min-h-screen bg-white w-full max-w-md mx-auto px-6 pb-16" style=${{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)' }}>
    <${Home} subj=${subj} subjects=${SUBJECTS} setSid=${setSid} st=${st} open=${open} />
  </main>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
