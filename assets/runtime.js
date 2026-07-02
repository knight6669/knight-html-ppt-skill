/* knight-html-ppt-skill :: runtime.js
 * Keyboard-driven deck runtime. Zero dependencies.
 *
 * Features:
 *   ← → / space / PgUp PgDn / Home End  navigation
 *   F  fullscreen
 *   S  presenter mode (opens a NEW WINDOW with current/next slide preview + notes + timer)
 *       The original window stays as audience view, synced via BroadcastChannel.
 *       Slide previews use CSS transform:scale() at design resolution for pixel-perfect layout.
 *   N  quick notes overlay (bottom drawer)
 *   O  slide overview grid
 *   E  page navigator with slide thumbnails
 *   T  cycle themes (reads data-themes on <html> or <body>)
 *   A  cycle demo animation on current slide
 *   URL hash #/N  deep-link to slide N (1-based)
 *   Progress bar auto-managed
 */
(function () {
  'use strict';

  const runtimeScript = document.currentScript;

  const ANIMS = ['fade-up','fade-down','fade-left','fade-right','rise-in','drop-in',
    'zoom-pop','blur-in','glitch-in','typewriter','neon-glow','shimmer-sweep',
    'gradient-flow','stagger-list','counter-up','path-draw','parallax-tilt',
    'card-flip-3d','cube-rotate-3d','page-turn-3d','perspective-zoom',
    'marquee-scroll','kenburns','confetti-burst','spotlight','morph-shape','ripple-reveal'];

  function ready(fn){ if(document.readyState!='loading')fn(); else document.addEventListener('DOMContentLoaded',fn);}

  function loadDeckEditorAssets() {
    if (window.KnightDeckEditor || window.__knightDeckEditorLoading) return;
    if (getPreviewIdx() >= 0 || getQueryParam('presenter') === '1') return;
    if (window.matchMedia && window.matchMedia('print').matches) return;

    const src = runtimeScript && runtimeScript.getAttribute('src');
    const base = src && src.indexOf('/') >= 0 ? src.slice(0, src.lastIndexOf('/') + 1) : 'assets/';
    window.__knightDeckEditorLoading = true;

    if (!document.querySelector('link[data-knight-editor-asset="css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = base + 'editor.css';
      link.setAttribute('data-knight-editor-asset', 'css');
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-knight-editor-asset="js"]')) {
      const script = document.createElement('script');
      script.src = base + 'editor.js';
      script.defer = true;
      script.setAttribute('data-knight-editor-asset', 'js');
      script.addEventListener('error', () => { window.__knightDeckEditorLoading = false; });
      document.head.appendChild(script);
    }
  }

  /* ========== Parse URL for preview-only mode ==========
   * When loaded as iframe.src = "index.html?preview=3", runtime enters a
   * locked single-slide mode: only slide N is visible, no chrome, no keys,
   * no hash updates. This is how the presenter window shows pixel-perfect
   * previews — by loading the actual deck file in an iframe and telling it
   * to display only a specific slide.
   */
  function getPreviewIdx() {
    const m = /[?&]preview=(\d+)/.exec(location.search || '');
    return m ? parseInt(m[1], 10) - 1 : -1;
  }
  function getQueryParam(name) {
    try { return new URLSearchParams(location.search || '').get(name); }
    catch(e) { return null; }
  }
  function getPresenterIdx(total) {
    if (getQueryParam('presenter') !== '1') return -1;
    const raw = parseInt(getQueryParam('slide') || '1', 10);
    const idx = Number.isFinite(raw) ? raw - 1 : 0;
    return Math.max(0, Math.min(total - 1, idx));
  }
  function getDeckBaseUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    return url.href;
  }
  function getCounterConfig(el) {
    const targetRaw = String(el.getAttribute('data-to') || el.textContent || '').replace(/,/g, '');
    const target = parseFloat(targetRaw);
    if (!Number.isFinite(target)) return null;
    const fromRaw = String(el.getAttribute('data-from') || '0').replace(/,/g, '');
    const from = Number.isFinite(parseFloat(fromRaw)) ? parseFloat(fromRaw) : 0;
    const text = String(el.textContent || '').trim();
    const match = text.match(/^([^0-9+\-.,]*)([-+]?\d[\d,]*(?:\.\d+)?)(.*)$/);
    const prefix = el.getAttribute('data-prefix') ?? (match ? match[1] : '');
    const suffix = el.getAttribute('data-suffix') ?? (match ? match[3] : '');
    const decimalsAttr = el.getAttribute('data-decimals');
    const decimalMatch = targetRaw.match(/\.(\d+)/);
    const decimals = decimalsAttr !== null
      ? Math.max(0, Math.min(6, parseInt(decimalsAttr, 10) || 0))
      : (decimalMatch ? Math.min(6, decimalMatch[1].length) : 0);
    const dur = Math.max(0, parseInt(el.getAttribute('data-dur') || '1200', 10) || 1200);
    return { target, from, prefix, suffix, decimals, dur };
  }
  function formatCounterValue(value, cfg) {
    const number = cfg.decimals > 0 ? value.toFixed(cfg.decimals) : String(Math.round(value));
    return cfg.prefix + number + cfg.suffix;
  }
  function setCounterValue(el, value, cfg) {
    const conf = cfg || getCounterConfig(el);
    if (!conf) return;
    el.textContent = formatCounterValue(value, conf);
  }
  function finalizeCounters(root) {
    root.querySelectorAll('.counter').forEach(el => {
      const cfg = getCounterConfig(el);
      if (cfg) setCounterValue(el, cfg.target, cfg);
    });
  }
  function animateCounters(root) {
    root.querySelectorAll('.counter').forEach(el => {
      const cfg = getCounterConfig(el);
      if (!cfg) return;
      const runId = String((parseInt(el.getAttribute('data-counter-run') || '0', 10) || 0) + 1);
      el.setAttribute('data-counter-run', runId);
      const start = performance.now();
      setCounterValue(el, cfg.from, cfg);
      function tick(now) {
        if (el.getAttribute('data-counter-run') !== runId) return;
        const t = cfg.dur === 0 ? 1 : Math.min(1, (now - start) / cfg.dur);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = cfg.from + (cfg.target - cfg.from) * eased;
        setCounterValue(el, value, cfg);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  function makePresenterNotesFingerprint(slideMeta) {
    const text = slideMeta.map(item => (item.title || '') + '\n' + (item.notes || '')).join('\n---\n');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  ready(function () {
    const deck = document.querySelector('.deck');
    if (!deck) return;
    const slides = Array.from(deck.querySelectorAll('.slide'));
    if (!slides.length) return;
    const total = slides.length;
    const CHANNEL_NAME = 'html-ppt-presenter-' + location.pathname;

    const previewOnlyIdx = getPreviewIdx();
    const isPreviewMode = previewOnlyIdx >= 0 && previewOnlyIdx < slides.length;

    /* ===== Preview-only mode: show one slide, hide everything else ===== */
    if (isPreviewMode) {
      function showSlide(i) {
        slides.forEach((s, j) => {
          const active = (j === i);
          s.classList.toggle('is-active', active);
          s.style.display = active ? '' : 'none';
          if (active) {
            s.style.opacity = '1';
            s.style.transform = 'none';
            s.style.pointerEvents = 'auto';
          }
        });
      }
      showSlide(previewOnlyIdx);
      finalizeCounters(slides[previewOnlyIdx]);
      /* Hide chrome that the presenter shouldn't see in preview */
      const hideSel = '.progress-bar, .notes-overlay, .overview, .notes, aside.notes, .speaker-notes';
      document.querySelectorAll(hideSel).forEach(el => { el.style.display = 'none'; });
      document.documentElement.setAttribute('data-preview', '1');
      document.body.setAttribute('data-preview', '1');
      /* Auto-detect theme base path for theme switching in preview mode */
      function getPreviewThemeBase() {
        const base = document.documentElement.getAttribute('data-theme-base');
        if (base) return base;
        const tl = document.getElementById('theme-link');
        if (tl) {
          const raw = tl.getAttribute('href') || '';
          const ls = raw.lastIndexOf('/');
          if (ls >= 0) return raw.substring(0, ls + 1);
        }
        return 'assets/themes/';
      }
      const previewThemeBase = getPreviewThemeBase();

      /* Listen for postMessage from parent presenter window:
       *  - preview-goto: switch visible slide WITHOUT reloading
       *  - preview-theme: switch theme CSS link to match audience window */
      window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'preview-goto') {
          const n = parseInt(e.data.idx, 10);
          if (n >= 0 && n < slides.length) showSlide(n);
        } else if (e.data.type === 'preview-theme' && e.data.name) {
          let link = document.getElementById('theme-link');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.id = 'theme-link';
            document.head.appendChild(link);
          }
          link.href = previewThemeBase + e.data.name + '.css';
          document.documentElement.setAttribute('data-theme', e.data.name);
        }
      });
      /* Signal to parent that preview iframe is ready */
      try { window.parent && window.parent.postMessage({ type: 'preview-ready' }, '*'); } catch(e) {}
      return;
    }

    const presenterOnlyIdx = getPresenterIdx(total);
    if (presenterOnlyIdx >= 0) {
      const deckUrl = getDeckBaseUrl();
      const slideMeta = slides.map((s, i) => {
        const note = s.querySelector('.notes, aside.notes, .speaker-notes');
        return {
          title: s.getAttribute('data-title') ||
            (s.querySelector('h1,h2,h3')||{}).textContent || ('Slide '+(i+1)),
          notes: note ? note.innerHTML : ''
        };
      });
      const presenterTheme = getQueryParam('theme') ||
        document.documentElement.getAttribute('data-theme') || '';
      const notesVersionAttr = ((document.documentElement && document.documentElement.getAttribute('data-notes-version')) ||
        (document.body && document.body.getAttribute('data-notes-version')) || '').trim();
      const notesVersion = [notesVersionAttr, makePresenterNotesFingerprint(slideMeta)].filter(Boolean).join(':');
      document.open();
      document.write(buildPresenterHTML(deckUrl, slideMeta, total, presenterOnlyIdx, CHANNEL_NAME, presenterTheme, notesVersion));
      document.close();
      return;
    }

    let idx = 0;

    /* ===== BroadcastChannel for presenter sync ===== */
    let bc;
    try { bc = new BroadcastChannel(CHANNEL_NAME); } catch(e) { bc = null; }

    // Are we running inside the presenter popup? (legacy flag, now unused)
    const isPresenterWindow = false;

    /* ===== progress bar ===== */
    let bar = document.querySelector('.progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.innerHTML = '<span></span>';
      document.body.appendChild(bar);
    }
    const barFill = bar.querySelector('span');

    /* ===== notes overlay (N key) ===== */
    let notes = document.querySelector('.notes-overlay');
    if (!notes) {
      notes = document.createElement('div');
      notes.className = 'notes-overlay';
      document.body.appendChild(notes);
    }

    /* ===== overview grid (O key) ===== */
    injectOverviewStyles();
    const overviewItems = [];
    const overviewBaseWidth = 1600;
    const overviewBaseHeight = 1000;
    const overviewAspect = overviewBaseWidth / overviewBaseHeight;
    let overview = document.querySelector('.overview');
    if (!overview) {
      overview = document.createElement('div');
      overview.className = 'overview';
      document.body.appendChild(overview);
    }
    overview.setAttribute('aria-hidden', 'true');
    overview.style.setProperty('--overview-aspect', String(overviewAspect));
    overview.style.setProperty('--overview-base-w', overviewBaseWidth + 'px');
    overview.style.setProperty('--overview-base-h', overviewBaseHeight + 'px');
    overview.innerHTML = '';
    const overviewHeader = document.createElement('div');
    overviewHeader.className = 'overview-header';
    const overviewTitle = document.createElement('div');
    overviewTitle.className = 'overview-title';
    overviewTitle.textContent = '页面总览';
    const overviewCount = document.createElement('div');
    overviewCount.className = 'overview-count';
    overviewCount.textContent = total + ' 页';
    const overviewClose = document.createElement('button');
    overviewClose.type = 'button';
    overviewClose.className = 'overview-close';
    overviewClose.setAttribute('aria-label', '关闭页面总览');
    overviewClose.textContent = '×';
    overviewClose.addEventListener('click', () => toggleOverview(false));
    overviewHeader.append(overviewTitle, overviewCount, overviewClose);
    const overviewGrid = document.createElement('div');
    overviewGrid.className = 'overview-grid';
    overview.append(overviewHeader, overviewGrid);
    slides.forEach((slide, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'overview-card';
      card.style.setProperty('--overview-order', String(Math.min(i, 15)));
      card.setAttribute('aria-label', '跳转到第 ' + (i + 1) + ' 页');

      const thumbStage = document.createElement('div');
      thumbStage.className = 'overview-thumb-stage';
      const thumbDeck = document.createElement('div');
      thumbDeck.className = 'overview-thumb-deck';
      thumbDeck.appendChild(cloneSlideForNavigator(slide, i));
      thumbStage.appendChild(thumbDeck);

      const meta = document.createElement('div');
      meta.className = 'overview-meta';
      const num = document.createElement('span');
      num.className = 'overview-num';
      num.textContent = String(i + 1).padStart(2, '0');
      const title = document.createElement('span');
      title.className = 'overview-label';
      title.textContent = getSlideTitle(slide, i);
      meta.append(num, title);

      card.append(thumbStage, meta);
      card.addEventListener('click', () => { go(i); toggleOverview(false); });
      overviewGrid.appendChild(card);
      overviewItems.push(card);
    });

    /* ===== page navigator (E key) ===== */
    injectPageNavigatorStyles();
    const pageNavItems = [];
    const pageNavBaseWidth = 1600;
    const pageNavBaseHeight = 1000;
    const pageNavAspect = pageNavBaseWidth / pageNavBaseHeight;
    let pageNavigator = document.querySelector('.page-navigator');
    if (!pageNavigator) pageNavigator = document.createElement('div');
    pageNavigator.classList.add('page-navigator');
    pageNavigator.setAttribute('aria-hidden', 'true');
    pageNavigator.setAttribute('data-wheel-ignore', '');
    pageNavigator.style.setProperty('--page-nav-aspect', String(pageNavAspect));
    pageNavigator.style.setProperty('--page-nav-base-w', pageNavBaseWidth + 'px');
    pageNavigator.style.setProperty('--page-nav-base-h', pageNavBaseHeight + 'px');
    pageNavigator.innerHTML = '';
    let pageNavigatorMode = null;
    let pageNavigatorHoverOpenTimer = 0;
    let pageNavigatorHoverCloseTimer = 0;

    const pageNavPanel = document.createElement('div');
    pageNavPanel.className = 'page-nav-panel';
    const pageNavHeader = document.createElement('div');
    pageNavHeader.className = 'page-nav-header';
    const pageNavTitle = document.createElement('div');
    pageNavTitle.className = 'page-nav-title';
    pageNavTitle.textContent = '页面导览';
    const pageNavCount = document.createElement('div');
    pageNavCount.className = 'page-nav-count';
    pageNavCount.textContent = total + ' 页';
    const pageNavClose = document.createElement('button');
    pageNavClose.type = 'button';
    pageNavClose.className = 'page-nav-close';
    pageNavClose.setAttribute('aria-label', '关闭页面导览');
    pageNavClose.textContent = '×';
    pageNavClose.addEventListener('click', () => togglePageNavigator(false));
    pageNavHeader.append(pageNavTitle, pageNavCount, pageNavClose);

    const pageNavList = document.createElement('div');
    pageNavList.className = 'page-nav-list';
    pageNavPanel.append(pageNavHeader, pageNavList);
    pageNavigator.appendChild(pageNavPanel);
    pageNavigator.addEventListener('click', e => {
      if (e.target === pageNavigator) togglePageNavigator(false);
    });
    document.body.appendChild(pageNavigator);

    let pageNavHotspot = document.querySelector('.page-nav-hotspot');
    if (!pageNavHotspot) pageNavHotspot = document.createElement('div');
    pageNavHotspot.className = 'page-nav-hotspot';
    pageNavHotspot.setAttribute('aria-hidden', 'true');
    pageNavHotspot.addEventListener('mouseenter', schedulePageNavigatorHoverOpen);
    pageNavHotspot.addEventListener('mousemove', schedulePageNavigatorHoverOpen);
    pageNavHotspot.addEventListener('mouseleave', clearPageNavigatorHoverOpen);
    document.body.appendChild(pageNavHotspot);
    pageNavPanel.addEventListener('mouseenter', clearPageNavigatorHoverClose);
    pageNavPanel.addEventListener('mouseleave', schedulePageNavigatorHoverClose);

    slides.forEach((slide, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'page-nav-item';
      item.style.setProperty('--page-nav-order', String(Math.min(i, 9)));
      item.setAttribute('aria-label', '跳转到第 ' + (i + 1) + ' 页');

      const thumbStage = document.createElement('div');
      thumbStage.className = 'page-nav-thumb-stage';
      const thumbDeck = document.createElement('div');
      thumbDeck.className = 'page-nav-thumb-deck';
      thumbDeck.appendChild(cloneSlideForNavigator(slide, i));
      thumbStage.appendChild(thumbDeck);

      const meta = document.createElement('div');
      meta.className = 'page-nav-meta';
      const num = document.createElement('span');
      num.className = 'page-nav-num';
      num.textContent = String(i + 1).padStart(2, '0');
      const title = document.createElement('span');
      title.className = 'page-nav-label';
      title.textContent = getSlideTitle(slide, i);
      meta.append(num, title);

      item.append(thumbStage, meta);
      item.addEventListener('click', () => { go(i); togglePageNavigator(false); });
      pageNavList.appendChild(item);
      pageNavItems.push(item);
    });

    function getSlideTitle(slide, i) {
      const title = slide.getAttribute('data-title') ||
        (slide.querySelector('h1,h2,h3') || {}).textContent ||
        ('第 ' + (i + 1) + ' 页');
      return title.trim().slice(0, 80);
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function makeCloneIdsUnique(root, suffix) {
      const idMap = new Map();
      root.querySelectorAll('[id]').forEach(el => {
        const oldId = el.getAttribute('id');
        if (!oldId) return;
        const newId = oldId + suffix;
        idMap.set(oldId, newId);
        el.setAttribute('id', newId);
      });
      if (!idMap.size) return;
      const attrs = ['href', 'xlink:href', 'fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end'];
      root.querySelectorAll('*').forEach(el => {
        attrs.forEach(attr => {
          const raw = el.getAttribute(attr);
          if (!raw) return;
          let next = raw;
          idMap.forEach((newId, oldId) => {
            next = next.replace(new RegExp('url\\(#' + escapeRegExp(oldId) + '\\)', 'g'), 'url(#' + newId + ')');
            if (next === '#' + oldId) next = '#' + newId;
          });
          if (next !== raw) el.setAttribute(attr, next);
        });
      });
    }

    function cloneSlideForNavigator(slide, i) {
      const clone = slide.cloneNode(true);
      clone.classList.add('is-active');
      clone.classList.remove('is-prev');
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('.notes, aside.notes, .speaker-notes, script, style').forEach(el => el.remove());
      clone.querySelectorAll('.counter').forEach(el => {
        const cfg = getCounterConfig(el);
        if (cfg) setCounterValue(el, cfg.target, cfg);
      });
      clone.querySelectorAll('svg text[data-number-original]').forEach(el => {
        el.textContent = el.getAttribute('data-number-original') || el.textContent;
      });
      makeCloneIdsUnique(clone, '-nav-' + i);
      return clone;
    }

    function syncPageNavigatorScale() {
      pageNavigator.querySelectorAll('.page-nav-thumb-stage').forEach(stage => {
        const mini = stage.querySelector('.page-nav-thumb-deck');
        if (!mini || !stage.clientWidth) return;
        mini.style.transform = 'scale(' + (stage.clientWidth / pageNavBaseWidth) + ')';
      });
    }

    function syncOverviewScale() {
      updateOverviewGridFit();
      overview.querySelectorAll('.overview-thumb-stage').forEach(stage => {
        const mini = stage.querySelector('.overview-thumb-deck');
        if (!mini || !stage.clientWidth || !stage.clientHeight) return;
        const scale = Math.max(0.01, Math.min(stage.clientWidth / overviewBaseWidth, stage.clientHeight / overviewBaseHeight));
        mini.style.left = ((stage.clientWidth - overviewBaseWidth * scale) / 2) + 'px';
        mini.style.top = ((stage.clientHeight - overviewBaseHeight * scale) / 2) + 'px';
        mini.style.transform = 'scale(' + scale + ')';
      });
    }

    function updateOverviewGridFit() {
      const rect = overview.getBoundingClientRect();
      const width = rect.width || window.innerWidth || 1600;
      const height = rect.height || window.innerHeight || 1000;
      const inset = 12;
      const gap = 10;
      const availableW = Math.max(1, width - inset * 2);
      const availableH = Math.max(1, height - inset * 2);
      let best = { cols: Math.ceil(Math.sqrt(total)), rows: Math.ceil(Math.sqrt(total)), score: -Infinity };
      for (let cols = 1; cols <= total; cols++) {
        const rows = Math.ceil(total / cols);
        const cellW = (availableW - gap * (cols - 1)) / cols;
        const cellH = (availableH - gap * (rows - 1)) / rows;
        if (cellW <= 0 || cellH <= 0) continue;
        const ratioPenalty = Math.abs(Math.log((cellW / cellH) / overviewAspect));
        const emptyPenalty = (cols * rows - total) / (cols * rows);
        const score = cellW * cellH * (1 - Math.min(0.55, ratioPenalty * 0.28)) * (1 - emptyPenalty * 0.18);
        if (score > best.score) best = { cols, rows, score };
      }
      overview.style.setProperty('--overview-cols', String(best.cols));
      overview.style.setProperty('--overview-rows', String(best.rows));
      overview.style.setProperty('--overview-gap', gap + 'px');
    }

    function updateOverviewActive() {
      overviewItems.forEach((item, i) => {
        const active = i === idx;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }

    function updatePageNavigatorActive() {
      pageNavItems.forEach((item, i) => {
        const active = i === idx;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }

    function clearPageNavigatorHoverClose() {
      if (pageNavigatorHoverCloseTimer) {
        clearTimeout(pageNavigatorHoverCloseTimer);
        pageNavigatorHoverCloseTimer = 0;
      }
    }

    function clearPageNavigatorHoverOpen() {
      if (pageNavigatorHoverOpenTimer) {
        clearTimeout(pageNavigatorHoverOpenTimer);
        pageNavigatorHoverOpenTimer = 0;
      }
      if (!pageNavigator.classList.contains('open')) {
        pageNavHotspot.classList.remove('is-hot');
      }
    }

    function schedulePageNavigatorHoverClose() {
      if (pageNavigatorMode !== 'hover') return;
      clearPageNavigatorHoverClose();
      clearPageNavigatorHoverOpen();
      pageNavigatorHoverCloseTimer = setTimeout(() => {
        if (pageNavigatorMode === 'hover') togglePageNavigator(false);
      }, 120);
    }

    function schedulePageNavigatorHoverOpen() {
      pageNavHotspot.classList.add('is-hot');
      if (pageNavigator.classList.contains('open')) return;
      if (pageNavigatorHoverOpenTimer) return;
      pageNavigatorHoverOpenTimer = setTimeout(() => {
        pageNavigatorHoverOpenTimer = 0;
        if (!pageNavigator.classList.contains('open')) togglePageNavigator(true, 'hover');
      }, 170);
    }

    function togglePageNavigator(force, mode) {
      const wasOpen = pageNavigator.classList.contains('open');
      let open;
      if (force !== undefined) {
        open = force;
      } else if (mode === 'manual' && wasOpen && pageNavigatorMode === 'hover') {
        open = true;
      } else {
        open = !wasOpen;
      }
      clearPageNavigatorHoverClose();
      clearPageNavigatorHoverOpen();
      pageNavigatorMode = open ? (mode || pageNavigatorMode || 'manual') : null;
      pageNavigator.classList.toggle('open', open);
      pageNavHotspot.classList.toggle('is-hot', open && pageNavigatorMode === 'hover');
      pageNavigator.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('page-navigator-open', open);
      if (open) {
        toggleOverview(false);
        toggleNotes(false);
        updatePageNavigatorActive();
        requestAnimationFrame(() => {
          syncPageNavigatorScale();
          const active = pageNavItems[idx];
          if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
        });
      }
    }

    function injectOverviewStyles() {
      if (document.querySelector('style[data-overview-style]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-overview-style', 'true');
      style.textContent = `
.overview {
  position: fixed;
  inset: 0;
  z-index: 90;
  --overview-accent: var(--accent, var(--accent-2, #3b6cff));
  --overview-accent-2: var(--accent-2, var(--accent, #7a5cff));
  --overview-bg-1: color-mix(in srgb, var(--bg, #ffffff) 84%, var(--text-1, #111216) 16%);
  --overview-bg-2: color-mix(in srgb, var(--bg-soft, #f7f7f8) 72%, var(--text-1, #111216) 28%);
  --overview-glass: color-mix(in srgb, var(--surface, #ffffff) 82%, transparent);
  --overview-glass-strong: color-mix(in srgb, var(--surface, #ffffff) 92%, transparent);
  --overview-line: color-mix(in srgb, var(--border-strong, rgba(0,0,0,.18)) 72%, var(--overview-accent) 28%);
  --overview-muted: color-mix(in srgb, var(--text-2, #55596a) 78%, var(--bg, #ffffff) 22%);
  display: block;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  padding: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--overview-accent) 15%, transparent), transparent 32%),
    radial-gradient(circle at 88% 14%, color-mix(in srgb, var(--accent-3, var(--overview-accent)) 12%, transparent), transparent 34%),
    linear-gradient(135deg, var(--overview-bg-1), var(--overview-bg-2));
  -webkit-backdrop-filter: blur(12px) saturate(1.06);
  backdrop-filter: blur(12px) saturate(1.06);
  transition: opacity 0.24s ease, visibility 0s linear 0.24s;
}
.overview.open {
  display: block;
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transition: opacity 0.24s ease, visibility 0s;
}
.overview-header {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  z-index: 3;
  display: none;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  color: var(--text-1, #111216);
}
.overview-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  line-height: 1.15;
  font-weight: 850;
}
.overview-title::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--overview-accent), var(--overview-accent-2));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--overview-accent) 14%, transparent);
}
.overview-count {
  margin-left: auto;
  color: var(--overview-muted);
  font-size: 12px;
  font-weight: 800;
}
.overview-close {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--overview-line);
  border-radius: 9px;
  background: var(--overview-glass);
  color: var(--text-1, #111216);
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
}
.overview-close:hover,
.overview-close:focus-visible {
  outline: none;
  background: var(--overview-glass-strong);
  transform: translateY(-1px);
}
.overview-grid {
  position: absolute;
  inset: 12px;
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(var(--overview-cols, 5), minmax(0, 1fr));
  grid-template-rows: repeat(var(--overview-rows, 4), minmax(0, 1fr));
  align-content: stretch;
  gap: var(--overview-gap, 12px);
  padding: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.overview-grid::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.overview-card {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 24px;
  gap: 5px;
  min-width: 0;
  min-height: 0;
  padding: 6px;
  overflow: hidden;
  border: 1px solid var(--overview-line);
  border-radius: calc(var(--radius-sm, 12px) + 4px);
  background: var(--overview-glass);
  color: var(--text-1, #111216);
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-lg, 0 18px 46px rgba(0, 0, 0, 0.14));
  -webkit-backdrop-filter: blur(14px) saturate(1.04);
  backdrop-filter: blur(14px) saturate(1.04);
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.26s ease,
    transform 0.3s cubic-bezier(.2, .85, .2, 1),
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.overview.open .overview-card {
  opacity: 1;
  transform: translateY(0);
  transition-delay: calc(var(--overview-order, 0) * 14ms), calc(var(--overview-order, 0) * 14ms), 0s, 0s;
}
.overview-card:hover,
.overview-card:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--overview-accent) 58%, var(--border-strong, rgba(0,0,0,.2)));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--overview-accent) 18%, transparent), var(--shadow-lg, 0 20px 54px rgba(0,0,0,.16));
}
.overview-card.is-active {
  border-color: color-mix(in srgb, var(--overview-accent) 78%, var(--border-strong, rgba(0,0,0,.2)));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--overview-accent) 22%, transparent),
    var(--shadow-lg, 0 22px 58px rgba(0, 0, 0, 0.18));
}
.overview-thumb-stage {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: auto;
  overflow: hidden;
  border-radius: 10px;
  background: var(--bg, #fff);
  border: 1px solid color-mix(in srgb, var(--border, rgba(0,0,0,.1)) 68%, transparent);
}
.overview-card::after {
  display: none;
}
.overview-thumb-deck {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--overview-base-w, 1600px);
  height: var(--overview-base-h, 1000px);
  transform-origin: 0 0;
  pointer-events: none;
}
.overview-thumb-deck .slide {
  position: absolute !important;
  inset: 0 !important;
  display: flex !important;
  width: var(--overview-base-w, 1600px) !important;
  height: var(--overview-base-h, 1000px) !important;
  opacity: 1 !important;
  pointer-events: none !important;
  transform: none !important;
  transition: none !important;
}
.overview-thumb-deck .notes,
.overview-thumb-deck aside.notes,
.overview-thumb-deck .speaker-notes {
  display: none !important;
}
.overview-meta {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: 2;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  min-height: 0;
  height: 24px;
  padding: 0 3px 1px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.overview-num {
  min-width: 28px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--overview-accent);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
  text-align: center;
}
.overview-card.is-active .overview-num {
  background: transparent;
  color: var(--overview-accent);
  border-color: transparent;
}
.overview-label {
  overflow: hidden;
  color: var(--text-1, #243247);
  font-size: 13px;
  line-height: 1.2;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .overview-grid {
    inset: 10px;
  }
  .overview-header {
    top: 8px;
    left: 10px;
    right: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .overview,
  .overview-card {
    transition: none !important;
  }
}
`;
      document.head.appendChild(style);
    }

    function injectPageNavigatorStyles() {
      if (document.querySelector('style[data-page-navigator-style]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-page-navigator-style', 'true');
      style.textContent = `
.page-navigator {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: block;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg,
      color-mix(in srgb, var(--bg) 70%, transparent) 0%,
      color-mix(in srgb, var(--surface) 48%, transparent) 28%,
      color-mix(in srgb, var(--bg) 30%, transparent) 100%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--accent) 8%, transparent),
      color-mix(in srgb, var(--accent-2) 8%, transparent));
  -webkit-backdrop-filter: blur(5px) saturate(1.03);
  backdrop-filter: blur(5px) saturate(1.03);
  transition:
    opacity 0.28s ease,
    visibility 0s linear 0.28s,
    backdrop-filter 0.28s ease;
}
.page-navigator.open {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transition:
    opacity 0.28s ease,
    visibility 0s,
    backdrop-filter 0.28s ease;
}
.page-nav-hotspot {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 79;
  width: 8px;
  background: transparent;
  pointer-events: auto;
}
.page-nav-hotspot::before {
  content: "";
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  width: 3px;
  border-radius: 0;
  opacity: 0;
  transform: scaleY(0.82);
  transform-origin: center;
  background: var(--grad, linear-gradient(180deg, var(--accent), var(--accent-2), var(--accent-3)));
  box-shadow:
    0 0 12px color-mix(in srgb, var(--accent) 48%, transparent),
    0 0 24px color-mix(in srgb, var(--accent-2) 28%, transparent);
  transition: opacity 0.12s ease, transform 0.18s cubic-bezier(.2, .85, .2, 1);
}
.page-nav-hotspot:hover::before,
.page-nav-hotspot.is-hot::before {
  opacity: 1;
  transform: scaleY(1);
}
.page-nav-panel {
  position: relative;
  box-sizing: border-box;
  width: min(206px, 16vw);
  min-width: 196px;
  height: 100%;
  padding: 10px 6px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow: visible;
  background:
    linear-gradient(180deg,
      color-mix(in srgb, var(--surface) 96%, transparent),
      color-mix(in srgb, var(--bg-soft, var(--bg)) 92%, transparent)),
    linear-gradient(90deg,
      color-mix(in srgb, var(--surface) 74%, transparent),
      color-mix(in srgb, var(--accent) 10%, transparent));
  border-right: 0;
  border-radius: 0;
  box-shadow:
    inset -1px 0 0 color-mix(in srgb, var(--surface) 70%, transparent),
    5px 0 16px color-mix(in srgb, var(--text-1) 9%, transparent);
  transform: translateX(-18px);
  opacity: 0;
  transition:
    transform 0.24s cubic-bezier(.2, .85, .2, 1),
    opacity 0.18s ease;
}
.page-nav-panel::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 1px;
  background: var(--grad, linear-gradient(180deg, var(--accent), var(--accent-2), var(--accent-3)));
  opacity: 0.74;
}
.page-nav-panel::after {
  content: "";
  position: absolute;
  top: 0;
  right: -7px;
  width: 8px;
  height: 100%;
  z-index: 2;
  background:
    linear-gradient(90deg,
      color-mix(in srgb, var(--accent-2) 28%, transparent) 0,
      color-mix(in srgb, var(--accent) 18%, transparent) 1px,
      color-mix(in srgb, var(--accent-2) 6%, transparent) 48%,
      transparent 100%);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent-2) 12%, transparent));
  pointer-events: none;
}
.page-navigator.open .page-nav-panel {
  transform: translateX(0);
  opacity: 1;
}
.page-nav-header {
  flex: none;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  color: var(--text-1);
}
.page-nav-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 900;
}
.page-nav-title::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--grad, linear-gradient(135deg, var(--accent), var(--accent-2)));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 9%, transparent);
}
.page-nav-count {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 2px;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.25;
  font-weight: 750;
  letter-spacing: 0;
}
.page-nav-close {
  width: 22px;
  height: 22px;
  margin-left: 0;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-2, var(--surface)) 45%, transparent);
  color: var(--text-2);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  box-shadow: none;
  opacity: 0.86;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease;
}
.page-nav-close:hover,
.page-nav-close:focus-visible {
  outline: none;
  opacity: 1;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text-1);
  border-color: color-mix(in srgb, var(--border-strong, var(--border)) 55%, transparent);
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--surface) 86%, transparent),
    0 6px 14px color-mix(in srgb, var(--text-1) 10%, transparent);
}
.page-nav-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 2px 2px 10px 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 16px), transparent 100%);
}
.page-nav-list::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.page-nav-item {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  padding: 2px 3px 5px;
  border: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text-1);
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  opacity: 0;
  transform: translateX(-8px);
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(.2, .85, .2, 1),
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}
.page-navigator.open .page-nav-item {
  opacity: 1;
  transform: translateX(0);
  transition-delay: calc(var(--page-nav-order, 0) * 18ms), calc(var(--page-nav-order, 0) * 18ms), 0s, 0s, 0s;
}
.page-nav-item:hover,
.page-nav-item:focus-visible {
  outline: none;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  transform: translateY(-1px);
}
.page-nav-item.is-active {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
.page-nav-thumb-stage {
  position: relative;
  width: 100%;
  aspect-ratio: var(--page-nav-aspect, 1.6);
  overflow: hidden;
  border-radius: 7px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--text-1) 6%, transparent);
}
.page-nav-item:hover .page-nav-thumb-stage,
.page-nav-item:focus-visible .page-nav-thumb-stage {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  box-shadow: 0 5px 14px color-mix(in srgb, var(--accent) 10%, transparent);
}
.page-nav-item.is-active .page-nav-thumb-stage {
  border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent),
    0 6px 16px color-mix(in srgb, var(--accent) 12%, transparent);
}
.page-nav-thumb-deck {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--page-nav-base-w, 1600px);
  height: var(--page-nav-base-h, 1000px);
  transform-origin: 0 0;
  pointer-events: none;
}
.page-nav-thumb-deck .slide {
  position: absolute !important;
  inset: 0 !important;
  display: flex !important;
  width: var(--page-nav-base-w, 1600px) !important;
  height: var(--page-nav-base-h, 1000px) !important;
  opacity: 1 !important;
  pointer-events: none !important;
  transform: none !important;
  transition: none !important;
}
.page-nav-thumb-deck .notes,
.page-nav-thumb-deck aside.notes,
.page-nav-thumb-deck .speaker-notes {
  display: none !important;
}
.page-nav-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 1px;
}
.page-nav-num {
  flex: none;
  width: fit-content;
  min-width: 28px;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 14px;
  line-height: 1.2;
  font-weight: 900;
  text-align: center;
}
.page-nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.25;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-nav-item.is-active .page-nav-num {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
@media (max-width: 760px) {
  .page-nav-panel {
    width: min(70vw, 206px);
    min-width: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .page-navigator,
  .page-nav-panel,
  .page-nav-item {
    transition: none !important;
  }
}
`;
      document.head.appendChild(style);
    }

    window.addEventListener('resize', () => {
      syncPageNavigatorScale();
      syncOverviewScale();
    });

    /* ===== navigation ===== */
    function go(n, fromRemote){
      n = Math.max(0, Math.min(total-1, n));
      slides.forEach((s,i) => {
        s.classList.toggle('is-active', i===n);
        s.classList.toggle('is-prev', i<n);
      });
      idx = n;
      updatePageNavigatorActive();
      updateOverviewActive();
      barFill.style.width = ((n+1)/total*100)+'%';
      const numEl = document.querySelector('.slide-number');
      if (numEl) { numEl.setAttribute('data-current', n+1); numEl.setAttribute('data-total', total); }

      // notes (bottom overlay)
      const note = slides[n].querySelector('.notes, aside.notes, .speaker-notes');
      notes.innerHTML = note ? note.innerHTML : '';

      // hash
      const hashTarget = '#/'+(n+1);
      if (location.hash !== hashTarget && !isPresenterWindow) {
        history.replaceState(null,'', hashTarget);
      }

      // re-trigger entry animations
      slides[n].querySelectorAll('[data-anim]').forEach(el => {
        const a = el.getAttribute('data-anim');
        el.classList.remove('anim-'+a);
        void el.offsetWidth;
        el.classList.add('anim-'+a);
      });

      // counter-up
      animateCounters(slides[n]);

      // Broadcast to other window (audience ↔ presenter)
      if (!fromRemote && bc) {
        bc.postMessage({ type: 'go', idx: n });
      }
    }

    /* ===== listen for remote navigation / theme changes ===== */
    if (bc) {
      bc.onmessage = function(e) {
        if (!e.data) return;
        if (e.data.type === 'go' && typeof e.data.idx === 'number') {
          go(e.data.idx, true);
        } else if (e.data.type === 'theme' && e.data.name) {
          /* Sync theme across windows */
          const i = themes.indexOf(e.data.name);
          if (i >= 0) themeIdx = i;
          applyTheme(e.data.name);
        } else if (e.data.type === 'notes-update' && typeof e.data.idx === 'number') {
          const slide = slides[e.data.idx];
          if (!slide) return;
          let note = slide.querySelector('.notes, aside.notes, .speaker-notes');
          if (!note) {
            note = document.createElement('aside');
            note.className = 'notes';
            slide.appendChild(note);
          }
          note.innerHTML = e.data.html || '';
          if (e.data.idx === idx) notes.innerHTML = note.innerHTML;
        }
      };
    }

    function toggleNotes(force){ notes.classList.toggle('open', force!==undefined?force:!notes.classList.contains('open')); }
    function toggleOverview(force){
      const open = force !== undefined ? force : !overview.classList.contains('open');
      overview.classList.toggle('open', open);
      overview.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        togglePageNavigator(false);
        toggleNotes(false);
        updateOverviewActive();
        requestAnimationFrame(() => {
          syncOverviewScale();
          const active = overviewItems[idx];
          if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
        });
      }
    }

    /* ===== mouse wheel navigation ===== */
    let wheelAccum = 0;
    let lastWheelEventAt = 0;
    let lastWheelNavAt = 0;
    const WHEEL_THRESHOLD = 90;
    const WHEEL_COOLDOWN = 360;

    function shouldIgnoreWheel(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return true;
      const target = e.target && e.target.closest
        ? e.target.closest('input, textarea, select, [contenteditable="true"], .notes-overlay.open, .overview.open, .page-navigator.open, [data-wheel-ignore]')
        : null;
      return !!target;
    }

    document.addEventListener('wheel', function(e) {
      if (shouldIgnoreWheel(e)) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const now = Date.now();
      if (now - lastWheelEventAt > 300) wheelAccum = 0;
      lastWheelEventAt = now;
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
      if (now - lastWheelNavAt < WHEEL_COOLDOWN) {
        e.preventDefault();
        return;
      }
      go(idx + (wheelAccum > 0 ? 1 : -1));
      wheelAccum = 0;
      lastWheelNavAt = now;
      e.preventDefault();
    }, { passive: false });

    /* ========== PRESENTER MODE — Magnetic-card popup window ========== */
    /* Opens a new window with 4 draggable, resizable cards:
     *   CURRENT  — iframe(?preview=N)   pixel-perfect preview of current slide
     *   NEXT     — iframe(?preview=N+1) pixel-perfect preview of next slide
     *   SCRIPT   — large speaker notes (逐字稿)
     *   TIMER    — elapsed timer + page counter + controls
     * Cards remember position/size in localStorage.
     * Two windows sync via BroadcastChannel.
     */
    let presenterWin = null;

    function presenterWindowStorageKey() {
      return 'html-ppt-presenter-window:v2:' + location.pathname;
    }
    function readPresenterWindowState() {
      try {
        const saved = localStorage.getItem(presenterWindowStorageKey());
        return saved ? JSON.parse(saved) : null;
      } catch(e) {
        return null;
      }
    }
    function presenterWindowFeatures(state) {
      const w = Math.max(900, Math.min(2600, Math.round((state && (state.innerW || state.w)) || 1500)));
      const h = Math.max(650, Math.min(1800, Math.round((state && (state.innerH || state.h)) || 920)));
      const parts = ['width=' + w, 'height=' + h, 'menubar=no', 'toolbar=no'];
      if (state && Number.isFinite(state.x)) parts.push('left=' + Math.round(state.x));
      if (state && Number.isFinite(state.y)) parts.push('top=' + Math.round(state.y));
      return parts.join(',');
    }

    function openPresenterWindow() {
      if (presenterWin && !presenterWin.closed) {
        presenterWin.focus();
        if (bc) bc.postMessage({ type: 'go', idx: idx });
        return;
      }

      const deckUrl = getDeckBaseUrl();
      const currentTheme = root.getAttribute('data-theme') || (themes[themeIdx] || '');
      const presenterUrl = deckUrl + '?presenter=1&slide=' + (idx + 1) +
        (currentTheme ? '&theme=' + encodeURIComponent(currentTheme) : '');
      const features = presenterWindowFeatures(readPresenterWindowState());

      presenterWin = window.open(presenterUrl, 'html-ppt-presenter', features);
      if (!presenterWin) {
        alert('请允许弹出窗口以使用演讲者视图');
        return;
      }
      presenterWin.focus();
    }

    function buildPresenterHTML(deckUrl, slideMeta, total, startIdx, channelName, currentTheme, notesVersion) {
      const metaJSON = JSON.stringify(slideMeta);
      const deckUrlJSON = JSON.stringify(deckUrl);
      const channelJSON = JSON.stringify(channelName);
      const themeJSON = JSON.stringify(currentTheme || '');
      const storageKey = 'html-ppt-presenter:v5:' + location.pathname;
      const notesVersionRaw = (notesVersion || '').trim();
      const notesVersionSuffix = notesVersionRaw ? ':' + notesVersionRaw.replace(/[^a-zA-Z0-9_.-]/g, '_') : '';
      const notesStorageKey = 'html-ppt-presenter-notes:v3' + notesVersionSuffix + ':' + location.pathname;
      const windowStorageKey = 'html-ppt-presenter-window:v2:' + location.pathname;

      // Build the document as a single template string for clarity
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>Presenter View</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%; overflow: hidden;
    background: #1a1d24;
    background-image:
      radial-gradient(circle at 20% 30%, rgba(88,166,255,.04), transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(188,140,255,.04), transparent 50%);
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  }
  /* Stage: positioned area where cards live */
  #stage { position: absolute; inset: 0 0 34px 0; overflow: hidden; }

  /* Magnetic card */
  .pcard {
    position: absolute;
    z-index: 1;
    background: #0d1117;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.02);
    display: flex; flex-direction: column;
    overflow: hidden;
    min-width: 220px; min-height: 120px;
    transition: box-shadow .2s, border-color .2s;
  }
  .pcard.dragging { box-shadow: 0 16px 48px rgba(0,0,0,.6), 0 0 0 2px rgba(88,166,255,.5); border-color: #58a6ff; transition: none; z-index: 9999; }
  .pcard.resizing { box-shadow: 0 16px 48px rgba(0,0,0,.6), 0 0 0 2px rgba(63,185,80,.5); border-color: #3fb950; transition: none; z-index: 9999; }
  .pcard:hover { border-color: rgba(88,166,255,.3); }
  #card-cur { z-index: 40; }
  #card-nxt { z-index: 30; }
  #card-notes { z-index: 20; }
  #card-timer { z-index: 10; }

  /* Card header (drag handle) */
  .pcard-head {
    display: flex; align-items: center; gap: 10px;
    height: 38px;
    padding: 0 14px;
    background: rgba(255,255,255,.04);
    border-bottom: 1px solid rgba(255,255,255,.06);
    cursor: move;
    user-select: none;
    flex-shrink: 0;
  }
  .pcard-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot-color, #58a6ff); flex-shrink: 0; }
  .pcard-title {
    font-size: 11px; letter-spacing: .15em; text-transform: uppercase;
    font-weight: 700; color: #8b949e; flex: 1;
  }
  .pcard-meta { font-size: 11px; color: #6e7681; }

  /* Card body */
  .pcard-body { flex: 1; position: relative; overflow: hidden; min-height: 0; }

  /* Preview cards (CURRENT/NEXT) — iframe-based pixel-perfect render */
  .pcard-preview .pcard-body { background: #000; }
  .pcard-preview iframe {
    position: absolute; top: 0; left: 0;
    width: 1600px; height: 1000px;
    border: none;
    transform-origin: top left;
    pointer-events: none;
    background: transparent;
  }
  .pcard-preview .preview-end {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: #484f58; font-size: 14px; letter-spacing: .12em;
  }

  /* Notes card */
  .pcard-notes .pcard-body {
    padding: 26px 28px 32px;
    overflow-y: auto;
    font-size: clamp(20px, 1.18vw, 28px); line-height: 1.8;
    color: #d0d7de;
    font-family: "Noto Sans SC", -apple-system, sans-serif;
    outline: none;
    caret-color: #f0883e;
  }
  .pcard-notes .pcard-body:focus {
    background: linear-gradient(180deg, rgba(240,136,62,.055), transparent 34%);
  }
  .pcard-notes .pcard-body.is-empty::before {
    content: attr(data-placeholder);
    color: #6e7681;
    font-style: italic;
  }
  .pcard-notes .pcard-body p { margin: 0 0 .86em 0; }
  .pcard-notes .pcard-body strong,
  .pcard-notes .pcard-body b {
    color: #f0883e;
    font-weight: 800;
  }
  .pcard-notes .pcard-body em { color: #58a6ff; font-style: normal; }
  .pcard-notes .pcard-body code {
    font-family: "SF Mono", monospace; font-size: .9em;
    background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 4px;
  }
  .pcard-notes .empty { color: #484f58; font-style: italic; }
  .notes-edit-status {
    font-size: 11px;
    color: #6e7681;
    letter-spacing: 0;
    text-transform: none;
    font-weight: 600;
  }
  .notes-edit-status.is-dirty { color: #f0883e; }
  .notes-edit-status.is-saved { color: #3fb950; }

  /* Timer card */
  .pcard-timer { min-height: 204px; }
  .pcard-timer .pcard-body {
    display: flex; flex-direction: column; gap: clamp(8px, 1.1vh, 12px);
    padding: clamp(14px, 1.6vh, 22px) 24px 18px;
    justify-content: center;
    overflow: hidden;
  }
  .timer-display {
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: clamp(42px, 3.65vw, 66px); font-weight: 700;
    color: #3fb950;
    letter-spacing: .03em;
    line-height: .96;
    white-space: nowrap;
    flex-shrink: 1;
  }
  .timer-row {
    display: flex; align-items: center; gap: 12px;
    font-size: 13px; color: #8b949e;
    flex-shrink: 0;
  }
  .timer-row .label { font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: #6e7681; }
  .timer-row .val { color: #e6edf3; font-weight: 600; font-family: "SF Mono", monospace; }
  .timer-controls { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
  .timer-btn {
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    color: #e6edf3;
    padding: 6px 11px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.1;
    min-height: 30px;
    cursor: pointer;
    font-family: inherit;
  }
  .timer-btn:hover { background: rgba(88,166,255,.15); border-color: #58a6ff; }
  .timer-btn:active { transform: translateY(1px); }

  /* Resize handle */
  .pcard-resize {
    position: absolute; right: 0; bottom: 0;
    width: 18px; height: 18px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,.25) 50%, rgba(255,255,255,.25) 60%, transparent 60%, transparent 70%, rgba(255,255,255,.25) 70%, rgba(255,255,255,.25) 80%, transparent 80%);
    z-index: 5;
  }
  .pcard-resize:hover { background: linear-gradient(135deg, transparent 50%, #58a6ff 50%, #58a6ff 60%, transparent 60%, transparent 70%, #58a6ff 70%, #58a6ff 80%, transparent 80%); }

  /* Bottom hint bar */
  .hint-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255,255,255,.08);
    min-height: 34px;
    padding: 6px 16px;
    font-size: 11px; color: #8b949e;
    display: flex; gap: 18px; align-items: center;
    z-index: 1000;
  }
  .hint-bar kbd {
    background: rgba(255,255,255,.08);
    padding: 1px 6px; border-radius: 3px;
    font-family: "SF Mono", monospace;
    font-size: 10px;
    border: 1px solid rgba(255,255,255,.1);
    color: #e6edf3;
  }
  .hint-bar .reset-layout {
    margin-left: auto;
    background: transparent; border: 1px solid rgba(255,255,255,.15);
    color: #8b949e; padding: 3px 10px; border-radius: 4px;
    font-size: 11px; cursor: pointer; font-family: inherit;
  }
  .hint-bar .reset-layout:hover { background: rgba(248,81,73,.15); border-color: #f85149; color: #f85149; }

  body.is-dragging-card * { user-select: none !important; }
  body.is-dragging-card iframe { pointer-events: none !important; }
</style>
</head>
<body>

<div id="stage">
  <div class="pcard pcard-preview" id="card-cur" style="--dot-color:#58a6ff">
    <div class="pcard-head" data-drag>
      <span class="pcard-dot"></span>
      <span class="pcard-title">CURRENT</span>
      <span class="pcard-meta" id="cur-meta">—</span>
    </div>
    <div class="pcard-body"><iframe id="iframe-cur"></iframe></div>
    <div class="pcard-resize" data-resize></div>
  </div>

  <div class="pcard pcard-preview" id="card-nxt" style="--dot-color:#bc8cff">
    <div class="pcard-head" data-drag>
      <span class="pcard-dot"></span>
      <span class="pcard-title">NEXT</span>
      <span class="pcard-meta" id="nxt-meta">—</span>
    </div>
    <div class="pcard-body"><iframe id="iframe-nxt"></iframe></div>
    <div class="pcard-resize" data-resize></div>
  </div>

  <div class="pcard pcard-notes" id="card-notes" style="--dot-color:#f0883e">
    <div class="pcard-head" data-drag>
      <span class="pcard-dot"></span>
      <span class="pcard-title">SPEAKER SCRIPT · 逐字稿</span>
      <span class="notes-edit-status" id="notes-status">editable</span>
    </div>
    <div class="pcard-body" id="notes-body" contenteditable="true" spellcheck="false" data-placeholder="Click here to edit speaker notes."></div>
    <div class="pcard-resize" data-resize></div>
  </div>

  <div class="pcard pcard-timer" id="card-timer" style="--dot-color:#3fb950">
    <div class="pcard-head" data-drag>
      <span class="pcard-dot"></span>
      <span class="pcard-title">TIMER</span>
    </div>
    <div class="pcard-body">
      <div class="timer-display" id="timer-display">00:00</div>
      <div class="timer-row">
        <span class="label">Slide</span>
        <span class="val" id="timer-count">1 / ${total}</span>
      </div>
      <div class="timer-controls">
        <button class="timer-btn" id="btn-prev">← Prev</button>
        <button class="timer-btn" id="btn-next">Next →</button>
        <button class="timer-btn" id="btn-reset">⏱ Reset</button>
      </div>
    </div>
    <div class="pcard-resize" data-resize></div>
  </div>
</div>

<div class="hint-bar">
  <span><kbd>← →</kbd> 翻页</span>
  <span><kbd>R</kbd> 重置计时</span>
  <span><kbd>Esc</kbd> 关闭</span>
  <span style="color:#6e7681">拖动卡片头部移动 · 拖动右下角调整大小</span>
  <button class="reset-layout" id="reset-layout">重置布局</button>
</div>

<script>
(function(){
  var slideMeta = ${metaJSON};
  var total = ${total};
  var idx = ${startIdx};
  var deckUrl = ${deckUrlJSON};
  var STORAGE_KEY = ${JSON.stringify(storageKey)};
  var NOTES_STORAGE_KEY = ${JSON.stringify(notesStorageKey)};
  var WINDOW_STORAGE_KEY = ${JSON.stringify(windowStorageKey)};
  var bc;
  try { bc = new BroadcastChannel(${channelJSON}); } catch(e) {}

  var iframeCur = document.getElementById('iframe-cur');
  var iframeNxt = document.getElementById('iframe-nxt');
  var notesBody = document.getElementById('notes-body');
  var curMeta = document.getElementById('cur-meta');
  var nxtMeta = document.getElementById('nxt-meta');
  var timerDisplay = document.getElementById('timer-display');
  var timerCount = document.getElementById('timer-count');
  var notesStatus = document.getElementById('notes-status');
  var editedNotes = readEditedNotes();
  var renderNotesLock = false;
  var saveNotesTimer = 0;

  function readEditedNotes() {
    try {
      var saved = localStorage.getItem(NOTES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch(e) {
      return {};
    }
  }
  function getNoteHtml(n) {
    return Object.prototype.hasOwnProperty.call(editedNotes, n) ? editedNotes[n] : (slideMeta[n] && slideMeta[n].notes) || '';
  }
  function setNotesStatus(text, cls) {
    if (!notesStatus) return;
    notesStatus.textContent = text;
    notesStatus.className = 'notes-edit-status' + (cls ? ' ' + cls : '');
  }
  function renderNotes(n) {
    renderNotesLock = true;
    var html = getNoteHtml(n);
    notesBody.innerHTML = html || '';
    notesBody.classList.toggle('is-empty', !html);
    setNotesStatus('editable', '');
    renderNotesLock = false;
  }
  function saveCurrentNotes() {
    if (renderNotesLock) return;
    var html = notesBody.innerHTML || '';
    editedNotes[idx] = html;
    if (slideMeta[idx]) slideMeta[idx].notes = html;
    notesBody.classList.toggle('is-empty', !html);
    try { localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(editedNotes)); } catch(e) {}
    if (bc) bc.postMessage({ type: 'notes-update', idx: idx, html: html });
    setNotesStatus('saved', 'is-saved');
  }
  function scheduleNotesSave() {
    if (renderNotesLock) return;
    setNotesStatus('editing', 'is-dirty');
    clearTimeout(saveNotesTimer);
    saveNotesTimer = setTimeout(saveCurrentNotes, 360);
  }
  function normalizeNotesEmphasis() {
    notesBody.querySelectorAll('b').forEach(function(node){
      var strong = document.createElement('strong');
      while (node.firstChild) strong.appendChild(node.firstChild);
      node.replaceWith(strong);
    });
    notesBody.querySelectorAll('span[style]').forEach(function(node){
      var weight = node.style && node.style.fontWeight;
      var numeric = parseInt(weight, 10);
      if (weight === 'bold' || numeric >= 600) {
        var strong = document.createElement('strong');
        while (node.firstChild) strong.appendChild(node.firstChild);
        node.replaceWith(strong);
      }
    });
  }
  notesBody.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key || '').toLowerCase() === 'b') {
      e.preventDefault();
      notesBody.focus();
      try { document.execCommand('bold', false, null); } catch(err) {}
      normalizeNotesEmphasis();
      scheduleNotesSave();
    }
  });
  notesBody.addEventListener('input', scheduleNotesSave);
  notesBody.addEventListener('blur', saveCurrentNotes);

  /* ===== Default card layout ===== */
  function defaultLayout() {
    var w = window.innerWidth;
    var h = window.innerHeight - 34; /* leave room for hint bar */
    var pad = 6;
    var gap = 8;
    var header = 38;
    var availableW = Math.max(320, w - pad * 2);
    var availableH = Math.max(480, h - pad * 2);
    if (availableW < 980) {
      var oneW = availableW;
      var timerHSmall = Math.min(230, Math.max(204, availableH * 0.22));
      var notesMinSmall = Math.min(180, Math.max(110, availableH * 0.22));
      var previewSpace = Math.max(180, availableH - timerHSmall - notesMinSmall - gap * 3);
      var curHSmall = Math.min(previewSpace * 0.64, header + oneW / 1.6);
      var nextHSmall = Math.min(previewSpace - curHSmall, header + oneW / 1.6);
      var notesHSmall = Math.max(96, availableH - curHSmall - nextHSmall - timerHSmall - gap * 3);
      return {
        'card-cur':   { x: pad, y: pad, w: oneW, h: Math.round(curHSmall) },
        'card-nxt':   { x: pad, y: Math.round(pad + curHSmall + gap), w: oneW, h: Math.round(nextHSmall) },
        'card-notes': { x: pad, y: Math.round(pad + curHSmall + gap + nextHSmall + gap), w: oneW, h: Math.round(notesHSmall) },
        'card-timer': { x: pad, y: Math.round(h - pad - timerHSmall), w: oneW, h: Math.round(timerHSmall) }
      };
    }
    var columnW = availableW - gap;
    var leftW = Math.round(columnW * 0.66);
    var rightW = columnW - leftW;
    var timerMinH = Math.min(238, Math.max(204, availableH * 0.21));
    var curMaxH = Math.max(280, availableH - gap - timerMinH);
    var curH = Math.min(Math.round(header + leftW / 1.6), curMaxH);
    curH = Math.max(Math.min(360, curMaxH), curH);
    var timerH = availableH - curH - gap;
    var nextH = Math.round(header + rightW / 1.6);
    nextH = Math.max(260, Math.min(nextH, availableH - gap - 320));
    var notesH = availableH - nextH - gap;
    return {
      'card-cur':   { x: pad, y: pad, w: leftW, h: curH },
      'card-timer': { x: pad, y: pad + curH + gap, w: leftW, h: timerH },
      'card-nxt':   { x: pad + leftW + gap, y: pad, w: rightW, h: nextH },
      'card-notes': { x: pad + leftW + gap, y: pad + nextH + gap, w: rightW, h: notesH }
    };
  }

  /* ===== Apply / save / restore layout ===== */
  function applyLayout(layout) {
    Object.keys(layout).forEach(function(id){
      var el = document.getElementById(id);
      var l = layout[id];
      if (el && l) {
        var maxW = Math.max(220, window.innerWidth - 12);
        var maxH = Math.max(120, window.innerHeight - 46);
        var ww = Math.max(220, Math.min(l.w, maxW));
        var hh = Math.max(120, Math.min(l.h, maxH));
        var xx = Math.max(0, Math.min(l.x, window.innerWidth - ww - 6));
        var yy = Math.max(0, Math.min(l.y, window.innerHeight - hh - 40));
        el.style.left = xx + 'px';
        el.style.top = yy + 'px';
        el.style.width = ww + 'px';
        el.style.height = hh + 'px';
      }
    });
    rescaleAll();
  }
  function readLayout() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return defaultLayout();
  }
  function saveLayout() {
    var layout = {};
    ['card-cur','card-nxt','card-notes','card-timer'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) {
        layout[id] = {
          x: parseInt(el.style.left,10) || 0,
          y: parseInt(el.style.top,10) || 0,
          w: parseInt(el.style.width,10) || 300,
          h: parseInt(el.style.height,10) || 200
        };
      }
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch(e) {}
  }

  /* ===== iframe rescale to fit card body ===== */
  function rescaleIframe(iframe) {
    if (!iframe || iframe.style.display === 'none') return;
    var body = iframe.parentElement;
    var cw = body.clientWidth, ch = body.clientHeight;
    if (!cw || !ch) return;
    var baseW = 1600;
    var baseH = 1000;
    var s = Math.max(cw / baseW, ch / baseH) * 1.002;
    iframe.style.transform = 'scale(' + s + ')';
    /* Center the scaled iframe in the body */
    var sw = baseW * s, sh = baseH * s;
    iframe.style.left = Math.max(0, (cw - sw) / 2) + 'px';
    iframe.style.top = Math.max(0, (ch - sh) / 2) + 'px';
  }
  function rescaleAll() {
    rescaleIframe(iframeCur);
    rescaleIframe(iframeNxt);
  }
  function readWindowState() {
    try {
      var saved = localStorage.getItem(WINDOW_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch(e) {
      return null;
    }
  }
  function saveWindowState() {
    try {
      localStorage.setItem(WINDOW_STORAGE_KEY, JSON.stringify({
        innerW: window.innerWidth,
        innerH: window.innerHeight,
        outerW: window.outerWidth || window.innerWidth,
        outerH: window.outerHeight || window.innerHeight,
        x: Number.isFinite(window.screenX) ? window.screenX : undefined,
        y: Number.isFinite(window.screenY) ? window.screenY : undefined,
        savedAt: Date.now()
      }));
    } catch(e) {}
  }
  function restoreWindowState() {
    var state = readWindowState();
    if (!state) return false;
    var targetW = Number(state.innerW || state.w);
    var targetH = Number(state.innerH || state.h);
    try {
      if (Number.isFinite(state.x) && Number.isFinite(state.y) && window.moveTo) {
        window.moveTo(Math.round(state.x), Math.round(state.y));
      }
      if (Number.isFinite(targetW) && Number.isFinite(targetH) && window.resizeBy) {
        var dx = Math.round(targetW - window.innerWidth);
        var dy = Math.round(targetH - window.innerHeight);
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) window.resizeBy(dx, dy);
      }
      return true;
    } catch(e) {
      return false;
    }
  }
  var windowStateTimer = 0;
  var layoutResetTimer = 0;
  function scheduleWindowStateSave() {
    clearTimeout(windowStateTimer);
    windowStateTimer = setTimeout(saveWindowState, 150);
  }
  function resetLayoutForViewport() {
    applyLayout(defaultLayout());
    saveLayout();
    rescaleAll();
  }
  window.addEventListener('resize', function(){
    scheduleWindowStateSave();
    clearTimeout(layoutResetTimer);
    layoutResetTimer = setTimeout(resetLayoutForViewport, 120);
  });
  window.addEventListener('beforeunload', function(){
    saveCurrentNotes();
    saveWindowState();
  });
  setInterval(saveWindowState, 1600);

  /* ===== Drag (move card by header) ===== */
  document.querySelectorAll('[data-drag]').forEach(function(handle){
    handle.addEventListener('mousedown', function(e){
      if (e.button !== 0) return;
      var card = handle.closest('.pcard');
      if (!card) return;
      e.preventDefault();
      card.classList.add('dragging');
      document.body.classList.add('is-dragging-card');
      var startX = e.clientX, startY = e.clientY;
      var startL = parseInt(card.style.left,10) || 0;
      var startT = parseInt(card.style.top,10)  || 0;
      function onMove(ev){
        var nx = Math.max(0, Math.min(window.innerWidth - 100, startL + ev.clientX - startX));
        var ny = Math.max(0, Math.min(window.innerHeight - 50, startT + ev.clientY - startY));
        card.style.left = nx + 'px';
        card.style.top = ny + 'px';
      }
      function onUp(){
        card.classList.remove('dragging');
        document.body.classList.remove('is-dragging-card');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveLayout();
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  /* ===== Resize (drag bottom-right corner) ===== */
  document.querySelectorAll('[data-resize]').forEach(function(handle){
    handle.addEventListener('mousedown', function(e){
      if (e.button !== 0) return;
      var card = handle.closest('.pcard');
      if (!card) return;
      e.preventDefault(); e.stopPropagation();
      card.classList.add('resizing');
      document.body.classList.add('is-dragging-card');
      var startX = e.clientX, startY = e.clientY;
      var startW = parseInt(card.style.width,10)  || card.offsetWidth;
      var startH = parseInt(card.style.height,10) || card.offsetHeight;
      function onMove(ev){
        var nw = Math.max(180, startW + ev.clientX - startX);
        var nh = Math.max(100, startH + ev.clientY - startY);
        if (card.classList.contains('pcard-preview')) {
          nh = Math.max(100, 38 + (nw / 1.6));
        }
        card.style.width = nw + 'px';
        card.style.height = nh + 'px';
        if (card.querySelector('iframe')) rescaleIframe(card.querySelector('iframe'));
      }
      function onUp(){
        card.classList.remove('resizing');
        document.body.classList.remove('is-dragging-card');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        rescaleAll();
        saveLayout();
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  /* ===== Preview iframe ready tracking =====
   * Each iframe loads the deck ONCE with ?preview=1 on init. Subsequent
   * slide changes are sent via postMessage('preview-goto') so the iframe
   * just toggles visibility of a different .slide — no reload, no flicker.
   */
  var iframeReady = { cur: false, nxt: false };
  var currentTheme = ${themeJSON};
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'preview-ready') return;
    var iframe = null;
    if (e.source === iframeCur.contentWindow) {
      iframeReady.cur = true;
      iframe = iframeCur;
      postPreviewGoto(iframeCur, idx);
    } else if (e.source === iframeNxt.contentWindow) {
      iframeReady.nxt = true;
      iframe = iframeNxt;
      postPreviewGoto(iframeNxt, idx + 1 < total ? idx + 1 : idx);
    }
    /* Sync current theme to the iframe */
    if (iframe && currentTheme) {
      try { iframe.contentWindow.postMessage({ type: 'preview-theme', name: currentTheme }, '*'); } catch(err) {}
    }
    if (iframe) rescaleIframe(iframe);
  });

  function postPreviewGoto(iframe, n) {
    try {
      iframe.contentWindow.postMessage({ type: 'preview-goto', idx: n }, '*');
    } catch(e) {}
  }

  /* ===== Update content =====
   * Smooth (no-reload) navigation: send postMessage to iframes instead of
   * resetting src. Iframes stay loaded, just switch visible .slide.
   */
  function update(n) {
    n = Math.max(0, Math.min(total - 1, n));
    if (n !== idx) saveCurrentNotes();
    idx = n;

    /* Current preview — postMessage (smooth) */
    if (iframeReady.cur) postPreviewGoto(iframeCur, n);
    curMeta.textContent = (n + 1) + '/' + total;

    /* Next preview */
    if (n + 1 < total) {
      iframeNxt.style.display = '';
      var endEl = document.querySelector('#card-nxt .preview-end');
      if (endEl) endEl.remove();
      if (iframeReady.nxt) postPreviewGoto(iframeNxt, n + 1);
      nxtMeta.textContent = (n + 2) + '/' + total;
    } else {
      iframeNxt.style.display = 'none';
      var body = document.querySelector('#card-nxt .pcard-body');
      if (body && !body.querySelector('.preview-end')) {
        var end = document.createElement('div');
        end.className = 'preview-end';
        end.textContent = '— END OF DECK —';
        body.appendChild(end);
      }
      nxtMeta.textContent = 'END';
    }

    /* Notes */
    renderNotes(n);

    /* Timer count */
    timerCount.textContent = (n + 1) + ' / ' + total;
  }

  /* ===== Timer ===== */
  var tStart = Date.now();
  setInterval(function(){
    var s = Math.floor((Date.now() - tStart) / 1000);
    var mm = String(Math.floor(s/60)).padStart(2,'0');
    var ss = String(s%60).padStart(2,'0');
    timerDisplay.textContent = mm + ':' + ss;
  }, 1000);
  function resetTimer(){ tStart = Date.now(); timerDisplay.textContent = '00:00'; }

  /* ===== BroadcastChannel sync ===== */
  if (bc) {
    bc.onmessage = function(e){
      if (!e.data) return;
      if (e.data.type === 'go') update(e.data.idx);
      else if (e.data.type === 'theme' && e.data.name) {
        currentTheme = e.data.name;
        /* Forward theme change to preview iframes */
        [iframeCur, iframeNxt].forEach(function(iframe){
          try {
            iframe.contentWindow.postMessage({ type: 'preview-theme', name: e.data.name }, '*');
          } catch(err) {}
        });
      }
    };
  }
  function go(n) {
    update(n);
    if (bc) bc.postMessage({ type: 'go', idx: idx });
  }

  /* ===== Mouse wheel on CURRENT preview to navigate ===== */
  (function initCurrentSlideWheel(){
    var body = document.querySelector('#card-cur .pcard-body');
    if (!body) return;
    var wheelAccum = 0;
    var lastWheelAt = 0;
    var lastWheelNavAt = 0;
    var WHEEL_THRESHOLD = 55;
    var WHEEL_COOLDOWN = 320;
    body.addEventListener('wheel', function(e){
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var now = Date.now();
      if (now - lastWheelAt > 280) wheelAccum = 0;
      lastWheelAt = now;
      var delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 1) return;
      wheelAccum += delta;
      e.preventDefault();
      if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
      if (now - lastWheelNavAt < WHEEL_COOLDOWN) {
        wheelAccum = 0;
        return;
      }
      go(idx + (wheelAccum > 0 ? 1 : -1));
      wheelAccum = 0;
      lastWheelNavAt = now;
    }, { passive: false });
  })();

  /* ===== Buttons ===== */
  document.getElementById('btn-prev').addEventListener('click', function(){ go(idx - 1); });
  document.getElementById('btn-next').addEventListener('click', function(){ go(idx + 1); });
  document.getElementById('btn-reset').addEventListener('click', resetTimer);
  document.getElementById('reset-layout').addEventListener('click', function(){
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
    applyLayout(defaultLayout());
    saveLayout();
  });

  /* ===== Keyboard ===== */
  document.addEventListener('keydown', function(e){
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var editing = e.target && e.target.closest && e.target.closest('#notes-body, [contenteditable="true"], textarea, input, select');
    if (editing) {
      if (e.key === 'Escape') {
        editing.blur();
        e.preventDefault();
      }
      return;
    }
    switch(e.key) {
      case 'ArrowRight': case ' ': case 'PageDown': go(idx + 1); e.preventDefault(); break;
      case 'ArrowLeft':  case 'PageUp':   go(idx - 1); e.preventDefault(); break;
      case 'Home': go(0); break;
      case 'End':  go(total - 1); break;
      case 'r': case 'R': resetTimer(); break;
      case 'Escape': window.close(); break;
    }
  });

  /* ===== Iframe load → rescale (catches initial size) ===== */
  iframeCur.addEventListener('load', function(){ rescaleIframe(iframeCur); });
  iframeNxt.addEventListener('load', function(){ rescaleIframe(iframeNxt); });

  /* ===== Init =====
   * Load each iframe ONCE with the deck file. After they post
   * 'preview-ready', all subsequent navigation is via postMessage
   * (smooth, no reload, no flicker).
   */
  restoreWindowState();
  resetLayoutForViewport();
  setTimeout(resetLayoutForViewport, 180);
  setTimeout(saveWindowState, 260);
  iframeCur.src = deckUrl + '?preview=' + (idx + 1);
  if (idx + 1 < total) iframeNxt.src = deckUrl + '?preview=' + (idx + 2);
  /* Initialize notes/timer/count without touching iframes */
  renderNotes(idx);
  curMeta.textContent = (idx + 1) + '/' + total;
  nxtMeta.textContent = (idx + 2) + '/' + total;
  timerCount.textContent = (idx + 1) + ' / ' + total;
})();
</` + `script>
</body></html>`;
    }
    function fullscreen(){ const el=document.documentElement;
      if (!document.fullscreenElement) el.requestFullscreen&&el.requestFullscreen();
      else document.exitFullscreen&&document.exitFullscreen();
    }

    // theme cycling
    const root = document.documentElement;
    const themesAttr = root.getAttribute('data-themes') || document.body.getAttribute('data-themes');
    function normalizeThemeName(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const clean = raw.split(/[?#]/)[0].replace(/\\/g, '/');
      const file = clean.substring(clean.lastIndexOf('/') + 1);
      return file.replace(/\.css$/i, '').trim();
    }
    const themes = themesAttr
      ? Array.from(new Set(themesAttr.split(',').map(normalizeThemeName).filter(Boolean)))
      : [];
    let themeIdx = 0;

    // Auto-detect theme base path from existing <link id="theme-link">
    let themeBase = root.getAttribute('data-theme-base');
    if (!themeBase) {
      const existingLink = document.getElementById('theme-link');
      if (existingLink) {
        // el.getAttribute('href') gives the raw relative path written in HTML
        const rawHref = existingLink.getAttribute('href') || '';
        const lastSlash = rawHref.lastIndexOf('/');
        themeBase = lastSlash >= 0 ? rawHref.substring(0, lastSlash + 1) : 'assets/themes/';
      } else {
        themeBase = 'assets/themes/';
      }
    }

    function applyTheme(name) {
      name = normalizeThemeName(name);
      if (!name) return;
      let link = document.getElementById('theme-link');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.id = 'theme-link';
        document.head.appendChild(link);
      }
      link.href = themeBase + name + '.css';
      root.setAttribute('data-theme', name);
      const ind = document.querySelector('.theme-indicator');
      if (ind) ind.textContent = name;
    }
    (function initThemeState() {
      if (!themes.length) return;
      const existingLink = document.getElementById('theme-link');
      const currentTheme = normalizeThemeName(root.getAttribute('data-theme')) ||
        normalizeThemeName(existingLink && (existingLink.getAttribute('href') || existingLink.href));
      const currentIdx = themes.indexOf(currentTheme);
      themeIdx = currentIdx >= 0 ? currentIdx : 0;
      applyTheme(themes[themeIdx]);
    })();
    function cycleTheme(fromRemote){
      if (!themes.length) return;
      themeIdx = (themeIdx+1) % themes.length;
      const name = themes[themeIdx];
      applyTheme(name);
      /* Broadcast to other window (audience ↔ presenter) */
      if (!fromRemote && bc) bc.postMessage({ type: 'theme', name: name });
    }

    // animation cycling on current slide
    let animIdx = 0;
    function cycleAnim(){
      animIdx = (animIdx+1) % ANIMS.length;
      const a = ANIMS[animIdx];
      const target = slides[idx].querySelector('[data-anim-target]') || slides[idx];
      ANIMS.forEach(x => target.classList.remove('anim-'+x));
      void target.offsetWidth;
      target.classList.add('anim-'+a);
      target.setAttribute('data-anim', a);
      const ind = document.querySelector('.anim-indicator');
      if (ind) ind.textContent = a;
    }

    document.addEventListener('keydown', function (e) {
      if (e.metaKey||e.ctrlKey||e.altKey) return;
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': case 'Enter': go(idx+1); e.preventDefault(); break;
        case 'ArrowLeft': case 'PageUp': case 'Backspace': go(idx-1); e.preventDefault(); break;
        case 'Home': go(0); break;
        case 'End': go(total-1); break;
        case 'f': case 'F': fullscreen(); break;
        case 's': case 'S': openPresenterWindow(); break;
        case 'n': case 'N': toggleNotes(); break;
        case 'o': case 'O': toggleOverview(); e.preventDefault(); break;
        case 'e': case 'E': togglePageNavigator(); e.preventDefault(); break;
        case 't': case 'T': cycleTheme(); break;
        case 'a': case 'A': cycleAnim(); break;
        case 'Escape': togglePageNavigator(false); toggleOverview(false); toggleNotes(false); break;
      }
    });

    // hash deep-link
    function fromHash(){
      const m = /^#\/(\d+)/.exec(location.hash||'');
      if (m) go(Math.max(0, parseInt(m[1],10)-1));
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
    go(idx);
    loadDeckEditorAssets();
  });
})();
