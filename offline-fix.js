(() => {
  "use strict";

  const FIX_VERSION = "4.0.2";
  const CACHE_PREFIX = "imdoc-offline-v";
  const EST_MIN_MB = 80;
  const EST_MAX_MB = 250;
  let running = false;

  const fixedStyles = [
    "https://cdn.jsdelivr.net/gh/toss/tossface/dist/tossface.css",
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css",
    "https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.1/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css",
    "https://cdn.jsdelivr.net/gh/fonts-archive/GmarketSans/subsets/GmarketSans-dynamic-subset.css",
    "https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css"
  ];

  const coreFiles = [
    "./index.html",
    "./style.css",
    "./editor.js",
    `./offline-fix.js?v=${FIX_VERSION}`,
    "./sw.js",
    "./version.json",
    "./manifest.webmanifest"
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  }

  function openDialog(title, html, init) {
    const backdrop = $("#dialogBackdrop");
    const titleEl = $("#dialogTitle");
    const body = $("#dialogBody");
    if (!backdrop || !titleEl || !body) return;
    titleEl.textContent = title;
    body.innerHTML = html;
    backdrop.classList.add("open");
    init?.();
  }

  function closeDialog() {
    if (running) return;
    $("#dialogBackdrop")?.classList.remove("open");
    const body = $("#dialogBody");
    if (body) body.innerHTML = "";
  }

  function showToast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => el.classList.remove("show"), 1500);
  }

  async function onlineVersion() {
    try {
      const r = await fetch(`./version.json?t=${Date.now()}`, {cache: "no-store"});
      if (!r.ok) throw new Error("version");
      return (await r.json()).version || FIX_VERSION;
    } catch (_) {
      return navigator.onLine ? FIX_VERSION : "확인 불가 (오프라인)";
    }
  }

  function installedVersion() {
    return localStorage.getItem("imdocOfflineVersion") || "설치 안 됨";
  }

  async function freeStorageText() {
    if (!navigator.storage?.estimate) return "확인 불가";
    try {
      const e = await navigator.storage.estimate();
      return formatBytes(Math.max(0, (e.quota || 0) - (e.usage || 0)));
    } catch (_) {
      return "확인 불가";
    }
  }

  function webFontFamilies() {
    const group = $$('#fontFamily optgroup').find(g => g.label === "웹 글꼴");
    return group ? $$('option', group).map(o => o.value).filter(Boolean) : [];
  }

  function candidateCssUrls(family) {
    const f = encodeURIComponent(family).replace(/%20/g, "+");
    return [...new Set([
      `https://fonts.googleapis.com/css2?family=${f}&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@400&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@300&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@500&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@700&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@100&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@200&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@600&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@800&display=swap`,
      `https://fonts.googleapis.com/css2?family=${f}:wght@900&display=swap`
    ])];
  }

  function readStyleMap() {
    try { return JSON.parse(localStorage.getItem("imdocGoogleFontStyleMap") || "{}") || {}; }
    catch (_) { return {}; }
  }

  function writeStyleMap(map) {
    try { localStorage.setItem("imdocGoogleFontStyleMap", JSON.stringify(map)); }
    catch (_) {}
  }

  async function resolveFontCss(family) {
    const remembered = readStyleMap()[family];
    if (!navigator.onLine && remembered) {
      const hit = await caches.match(remembered);
      if (hit) return {url: remembered, response: hit.clone()};
    }

    let last = null;
    for (const url of candidateCssUrls(family)) {
      try {
        const r = await fetch(url, {cache: "no-store"});
        if (r.ok || r.type === "opaque") {
          const map = readStyleMap();
          map[family] = url;
          writeStyleMap(map);
          return {url, response: r};
        }
        last = new Error(`${r.status} ${r.statusText}`);
      } catch (e) {
        last = e;
      }
    }
    throw new Error(`${family}: 사용 가능한 Google Fonts 스타일을 찾지 못했습니다${last?.message ? ` (${last.message})` : ""}`);
  }

  function cssResourceUrls(text, base) {
    const out = [];
    const re = /url\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[1].trim().replace(/^['"]|['"]$/g, "");
      if (!raw || raw.startsWith("data:")) continue;
      try { out.push(new URL(raw, base).href); } catch (_) {}
    }
    return out;
  }

  async function putResponse(cache, key, response) {
    let bytes = 0;
    try { bytes = (await response.clone().arrayBuffer()).byteLength; } catch (_) {}
    await cache.put(key, response.clone());
    return bytes;
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${FIX_VERSION}`, {
        scope: "./",
        updateViaCache: "none"
      });
      await reg.update().catch(() => {});
      await navigator.serviceWorker.ready;
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function progressUI() {
    openDialog("오프라인 설치 중", `
      <div class="offline-step">
        <div id="fixPhase"><strong>설치를 준비하고 있습니다.</strong></div>
        <div class="offline-progress-wrap">
          <div class="offline-progress"><div id="fixBar" class="offline-progress-bar"></div></div>
          <div class="offline-progress-line"><strong id="fixPercent">0%</strong><span id="fixCaption">준비 중</span></div>
          <div id="fixCurrent" class="offline-current">리소스 목록을 준비하는 중...</div>
          <div class="offline-stats">
            <div class="offline-stat"><span>받은 용량</span><strong id="fixBytes">0 MB</strong></div>
            <div class="offline-stat"><span>완료</span><strong id="fixDone">0개</strong></div>
            <div class="offline-stat"><span>남음</span><strong id="fixRemain">계산 중</strong></div>
          </div>
        </div>
      </div>`);
  }

  function progress({percent, caption, current, bytes, done, remain, phase}) {
    if (percent != null) {
      const p = Math.max(0, Math.min(100, percent));
      if ($("#fixBar")) $("#fixBar").style.width = `${p}%`;
      if ($("#fixPercent")) $("#fixPercent").textContent = `${Math.round(p)}%`;
    }
    if (caption != null && $("#fixCaption")) $("#fixCaption").textContent = caption;
    if (current != null && $("#fixCurrent")) $("#fixCurrent").textContent = current;
    if (bytes != null && $("#fixBytes")) $("#fixBytes").textContent = formatBytes(bytes);
    if (done != null && $("#fixDone")) $("#fixDone").textContent = `${done}개`;
    if (remain != null && $("#fixRemain")) $("#fixRemain").textContent = `${remain}개`;
    if (phase != null && $("#fixPhase")) $("#fixPhase").innerHTML = `<strong>${esc(phase)}</strong>`;
  }

  async function install(version) {
    if (running) return;
    running = true;
    progressUI();
    const closeBtn = $("#dialogCloseBtn");
    if (closeBtn) closeBtn.disabled = true;
    const cacheName = `${CACHE_PREFIX}${version}`;
    let bytes = 0;

    try {
      if (!(await registerSW())) throw new Error("Service Worker를 등록할 수 없습니다.");
      const cache = await caches.open(cacheName);
      const fonts = webFontFamilies();
      const fontFiles = new Set();
      const skipped = [];
      const cssTotal = fixedStyles.length + fonts.length;
      let cssDone = 0;

      progress({phase: "글꼴 정보 확인 중", current: "폰트 스타일시트를 확인하고 있습니다."});

      for (const url of fixedStyles) {
        cssDone++;
        progress({percent: (cssDone / cssTotal) * 12, caption: `폰트 목록 ${cssDone}/${cssTotal}`, current: `확인 중: ${url}`, bytes, done: cssDone, remain: cssTotal - cssDone});
        try {
          const r = await fetch(url, {cache: "no-store"});
          if (!r.ok && r.type !== "opaque") throw new Error(`${r.status}`);
          const copy = r.clone();
          bytes += await putResponse(cache, url, r);
          if (copy.type !== "opaque") {
            const text = await copy.text();
            cssResourceUrls(text, url).forEach(u => fontFiles.add(u));
          }
        } catch (e) {
          console.warn("고정 폰트 스타일 건너뜀", url, e);
        }
      }

      for (const family of fonts) {
        cssDone++;
        progress({percent: (cssDone / cssTotal) * 12, caption: `폰트 목록 ${cssDone}/${cssTotal}${skipped.length ? ` · 건너뜀 ${skipped.length}` : ""}`, current: `글꼴 확인: ${family}`, bytes, done: cssDone, remain: cssTotal - cssDone});
        try {
          const resolved = await resolveFontCss(family);
          const copy = resolved.response.clone();
          bytes += await putResponse(cache, resolved.url, resolved.response);
          if (copy.type !== "opaque") {
            const text = await copy.text();
            cssResourceUrls(text, resolved.url).forEach(u => fontFiles.add(u));
          }
        } catch (e) {
          skipped.push(family);
          console.warn("웹폰트 건너뜀", family, e);
        }
      }

      const resources = [...coreFiles, ...fontFiles];
      let cursor = 0, completed = 0;
      progress({phase: "편집기와 폰트 다운로드 중", percent: 12, done: 0, remain: resources.length, current: "다운로드를 시작합니다."});

      async function worker() {
        while (true) {
          const i = cursor++;
          if (i >= resources.length) return;
          const url = resources[i];
          progress({current: `받는 중: ${url}`});
          try {
            const r = await fetch(url, {cache: "reload"});
            if (!r.ok && r.type !== "opaque") throw new Error(`${r.status}`);
            bytes += await putResponse(cache, url, r);
          } catch (e) {
            if (coreFiles.includes(url)) throw new Error(`편집기 파일 다운로드 실패: ${url}`);
            console.warn("폰트 파일 건너뜀", url, e);
          }
          completed++;
          progress({percent: 12 + (completed / Math.max(1, resources.length)) * 88, caption: `${completed}/${resources.length}`, current: `완료: ${url}`, bytes, done: completed, remain: resources.length - completed});
        }
      }

      await Promise.all(Array.from({length: Math.min(4, Math.max(1, resources.length))}, worker));

      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== cacheName).map(k => caches.delete(k)));
      localStorage.setItem("imdocOfflineVersion", version);
      localStorage.setItem("imdocOfflineBytes", String(bytes));
      localStorage.setItem("imdocOfflineInstalledAt", new Date().toISOString());

      running = false;
      if (closeBtn) closeBtn.disabled = false;
      const latest = await onlineVersion();
      openDialog("다운로드 완료!", `
        <div class="offline-complete-icon tossface">✅</div>
        <div class="offline-step" style="text-align:center"><strong>오프라인 설치가 완료되었습니다!</strong><br>인터넷 연결이 끊기면 편집기 상단에 <b>오프라인 모드</b>라고 표시되고 다운로드한 버전으로 실행합니다.</div>
        <div class="offline-callout">실제 저장된 용량: <b>${formatBytes(bytes)}</b>${skipped.length ? `<br><br>오프라인 저장에서 제외된 웹폰트: <b>${skipped.length}개</b><br>${esc(skipped.join(", "))}` : ""}</div>
        <div class="offline-version-box"><span>다운받은 버전</span><span class="value">v${esc(version)}</span><span>온라인 버전</span><span class="value">v${esc(latest)}</span></div>
        <div class="dialog-actions"><button id="fixDone" class="primary">완료</button></div>`, () => {
          $("#fixDone").onclick = closeDialog;
        });
    } catch (e) {
      running = false;
      if (closeBtn) closeBtn.disabled = false;
      try { await caches.delete(cacheName); } catch (_) {}
      openDialog("오프라인 설치 실패", `
        <div class="offline-warning"><strong>설치를 완료하지 못했습니다.</strong><br>${esc(e?.message || e)}</div>
        <div class="offline-callout">특정 웹폰트 하나의 오류 때문에 전체 설치가 중단되지는 않습니다. 위 오류가 편집기 핵심 파일이라면 네트워크/배포 상태를 확인해 주세요.</div>
        <div class="dialog-actions"><button id="fixFail" class="primary">확인</button></div>`, () => {
          $("#fixFail").onclick = closeDialog;
        });
    }
  }

  async function wizard() {
    const secure = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
    if (!secure) {
      openDialog("오프라인 설치", `<div class="offline-warning"><strong>HTTPS 또는 localhost가 필요합니다.</strong><br>Service Worker는 file://에서 설치할 수 없습니다.</div><div class="dialog-actions"><button id="fixOk" class="primary">확인</button></div>`, () => $("#fixOk").onclick = closeDialog);
      return;
    }

    const online = await onlineVersion();
    const installed = installedVersion();

    const step1 = () => openDialog("오프라인 설치", `<div class="offline-step"><strong>이 편집기를 오프라인에서도 사용할 수 있도록 설치할까요?</strong><div class="offline-callout">편집기 본체, Service Worker, 주요 웹폰트와 글꼴 목록의 웹폰트를 이 브라우저에 저장합니다.</div></div><div class="dialog-actions"><button id="fixCancel">취소</button><button id="fixNext" class="primary">다음</button></div>`, () => {$("#fixCancel").onclick = closeDialog;$("#fixNext").onclick = step2;});

    const step2 = () => openDialog("오프라인 설치 · 안내", `<div class="offline-step"><strong>오프라인 버전은 다운로드한 시점의 편집기입니다.</strong><div class="offline-warning"><b>온라인 버전이 바뀌면 검토 → 오프라인 설치에서 새 버전을 다시 다운로드해야 합니다.</b><br>기존 오프라인 버전은 자동으로 최신 버전이 되지 않습니다.</div><div class="offline-version-box"><span>현재 다운로드된 버전</span><span class="value">v${esc(installed)}</span><span>현재 온라인 버전</span><span class="value">v${esc(online)}</span></div></div><div class="dialog-actions"><button id="fixBack">이전</button><button id="fixNext" class="primary">다음</button></div>`, () => {$("#fixBack").onclick = step1;$("#fixNext").onclick = step3;});

    const step3 = () => openDialog("오프라인 설치 · 주의", `<div class="offline-warning"><strong>설치 전에 확인하세요.</strong><br>• 사이트 데이터/캐시를 삭제하면 설치본도 삭제될 수 있습니다.<br>• 설치 중에는 탭을 닫거나 새로고침하지 마세요.<br>• iframe, YouTube, 외부 영상 등 인터넷 콘텐츠는 오프라인에서 표시되지 않을 수 있습니다.<br>• 웹폰트 하나가 제공되지 않으면 그 글꼴만 건너뛰고 설치를 계속합니다.</div><div class="dialog-actions"><button id="fixBack">이전</button><button id="fixNext" class="primary">다음</button></div>`, () => {$("#fixBack").onclick = step2;$("#fixNext").onclick = async () => step4(await freeStorageText());});

    const step4 = free => openDialog("오프라인 설치 · 다운로드 확인", `<div class="offline-step"><strong>다음 항목을 다운로드합니다.</strong><ul class="offline-download-list"><li>편집기 최신 버전 v${esc(online)}</li><li>Service Worker / 버전 정보 / PWA 파일</li><li>Tossface, Pretendard, Wanted Sans Variable, G마켓 산스, Paperlogy</li><li>웹 글꼴 목록 ${webFontFamilies().length}종과 실제 WOFF/WOFF2 파일</li></ul><div class="offline-callout"><b>예상 다운로드 용량: 약 ${EST_MIN_MB}~${EST_MAX_MB} MB</b><br>실제 용량은 Google Fonts가 제공하는 한글/라틴 분할 파일에 따라 달라집니다.<br>확인되는 남은 저장공간: <b>${esc(free)}</b></div></div><div class="dialog-actions"><button id="fixBack">이전</button><button id="fixInstall" class="primary">설치</button></div>`, () => {$("#fixBack").onclick = step3;$("#fixInstall").onclick = () => install(online);});

    step1();
  }

  async function loadFontFixed(select) {
    const family = select.value;
    const group = select.selectedOptions[0]?.parentElement;
    if (!group || group.label !== "웹 글꼴") return;
    try {
      const resolved = await resolveFontCss(family);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = resolved.url;
      document.head.appendChild(link);
      document.execCommand("fontName", false, family);
    } catch (e) {
      console.warn(e);
      showToast(`${family} 글꼴을 불러오지 못했습니다.`);
    }
  }

  function hook() {
    const installBtn = $("#offlineInstallBtn");
    if (installBtn) installBtn.onclick = wizard;

    for (const id of ["fontFamily", "mobileFontFamily"]) {
      const select = $(`#${id}`);
      if (!select) continue;
      const old = select.onchange;
      select.onchange = async e => {
        const group = e.target.selectedOptions[0]?.parentElement;
        if (group?.label === "웹 글꼴") {
          e.stopImmediatePropagation?.();
          await loadFontFixed(e.target);
        } else {
          old?.call(select, e);
        }
      };
    }

    const sheet = $("#sheetActions");
    if (sheet) {
      const patchSheet = () => {
        $$('button', sheet).forEach(btn => {
          if (btn.textContent.includes("오프라인 설치")) btn.onclick = () => {
            $("#sheetBackdrop")?.classList.remove("open");
            setTimeout(wizard, 0);
          };
        });
      };
      new MutationObserver(patchSheet).observe(sheet, {childList: true, subtree: true});
      patchSheet();
    }
  }

  hook();
})();