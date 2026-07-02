/* knight-html-ppt-skill :: editor.js */
(function () {
  'use strict';

  if (window.KnightDeckEditor) return;
  if (/[?&](preview|presenter)=/.test(location.search || '')) return;

  const deck = document.querySelector('.deck');
  if (!deck) return;

  const state = {
    active: false,
    dirty: false,
    selected: null,
    editingText: null,
    history: [],
    historyIndex: -1,
    idSeq: 1,
    drag: null,
    fileHandle: null,
    fileHandleReady: null,
    toastTimer: 0
  };

  const EXCLUDED_SELECTOR = [
    '.knight-editor-ui',
    '.deck-footer',
    '.slide-number',
    '.notes',
    'aside.notes',
    '.speaker-notes',
    '.progress-bar',
    '.notes-overlay',
    '.overview',
    '.page-navigator',
    '.page-nav-hotspot',
    '.slide-fx',
    'script',
    'style',
    'link',
    '[data-knight-flow-placeholder-for]',
    '[data-edit-lock="true"]'
  ].join(',');

  const TEXT_SELECTOR = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'li',
    'span',
    'strong',
    'em',
    'small',
    '.h1',
    '.h2',
    '.h3',
    '.h4',
    '.lede',
    '.kicker',
    '.eyebrow',
    '.small-label',
    '.label',
    '.value',
    '.unit'
  ].join(',');

  const BLOCK_SELECTOR = [
    TEXT_SELECTOR,
    'img',
    'svg',
    '.card',
    '.card-soft',
    '.metric-card',
    '.mini-kpi',
    '.scan-card',
    '.state-card',
    '.comparison-panel',
    '.scan-board',
    '.kpi-wall',
    '.cover-layout',
    '.section-title',
    '.image-layer',
    '.image-vignette',
    '.two-pane',
    '.grid',
    '.row'
  ].join(',');

  const COLOR_SWATCHES = [
    ['墨黑', '#111827'],
    ['深灰', '#374151'],
    ['纯白', '#ffffff'],
    ['品牌蓝', '#2563eb'],
    ['湖蓝', '#0ea5e9'],
    ['青绿', '#14b8a6'],
    ['绿色', '#10b981'],
    ['琥珀', '#f59e0b'],
    ['橙色', '#f97316'],
    ['红色', '#ef4444'],
    ['玫红', '#ec4899'],
    ['紫色', '#8b5cf6']
  ];

  const draftKey = 'knight-html-ppt-editor-draft:v1:' + location.pathname;
  const fileHandleKey = 'file-handle:' + location.pathname;
  const HANDLE_DB = 'knight-html-ppt-editor';
  const HANDLE_STORE = 'file-handles';

  const ui = buildUI();
  document.body.append(ui.toolbar, ui.selection, ui.toast, ui.modalBackdrop);

  state.history = [captureSlides()];
  state.historyIndex = 0;
  state.fileHandleReady = restoreFileHandle();
  updateToolbarState();
  maybeOfferDraftRestore();

  window.KnightDeckEditor = {
    enter,
    exit,
    save,
    undo,
    redo,
    isActive: () => state.active
  };

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('dblclick', onDoubleClick, true);
  window.addEventListener('resize', syncSelectionBox);
  window.addEventListener('scroll', syncSelectionBox, true);

  function buildUI() {
    const toolbar = document.createElement('div');
    toolbar.className = 'knight-editor-toolbar knight-editor-ui';
    toolbar.setAttribute('data-wheel-ignore', 'true');
    const colorSwatches = COLOR_SWATCHES.map(([name, value]) => [
      '<button class="knight-editor-color-swatch" data-editor-color="', value,
      '" type="button" title="', name,
      '" style="--swatch:', value, '"><span>', name, '</span></button>'
    ].join('')).join('');
    toolbar.innerHTML = [
      '<button class="knight-editor-button knight-editor-primary" data-editor-action="save" type="button" title="保存 Ctrl+S">保存</button>',
      '<button class="knight-editor-button" data-editor-action="undo" type="button" title="撤销 Ctrl+Z">↶</button>',
      '<button class="knight-editor-button" data-editor-action="redo" type="button" title="重做 Ctrl+Y">↷</button>',
      '<span class="knight-editor-separator" aria-hidden="true"></span>',
      '<button class="knight-editor-button" data-editor-command="bold" type="button" title="加粗">B</button>',
      '<label class="knight-editor-field">字号 <input class="knight-editor-font-size" type="number" min="10" max="180" step="1" value="32"></label>',
      '<div class="knight-editor-color-group">',
      '<button class="knight-editor-color-button" data-editor-action="color-menu" type="button" title="文字颜色">',
      '<span>颜色</span><i class="knight-editor-current-color" aria-hidden="true"></i>',
      '</button>',
      '<div class="knight-editor-color-menu" role="menu" aria-label="文字颜色">',
      '<div class="knight-editor-color-title">常用颜色</div>',
      '<div class="knight-editor-color-grid">', colorSwatches, '</div>',
      '<label class="knight-editor-color-custom">自定义 <input class="knight-editor-color" type="color" value="#111216"></label>',
      '</div>',
      '</div>',
      '<span class="knight-editor-separator" aria-hidden="true"></span>',
      '<button class="knight-editor-button" data-editor-align="left" type="button" title="左对齐">左</button>',
      '<button class="knight-editor-button" data-editor-align="center" type="button" title="居中">中</button>',
      '<button class="knight-editor-button" data-editor-align="right" type="button" title="右对齐">右</button>',
      '<span class="knight-editor-separator" aria-hidden="true"></span>',
      '<span class="knight-editor-status">按 V 进入编辑，Esc 退出</span>'
    ].join('');

    const selection = document.createElement('div');
    selection.className = 'knight-editor-selection knight-editor-ui';
    selection.setAttribute('data-wheel-ignore', 'true');
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(handle => {
      const node = document.createElement('span');
      node.className = 'knight-editor-handle';
      node.setAttribute('data-handle', handle);
      selection.appendChild(node);
    });

    const toast = document.createElement('div');
    toast.className = 'knight-editor-toast knight-editor-ui';

    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'knight-editor-modal-backdrop knight-editor-ui';
    modalBackdrop.setAttribute('data-wheel-ignore', 'true');
    modalBackdrop.innerHTML = [
      '<div class="knight-editor-modal" role="dialog" aria-modal="true" aria-labelledby="knight-editor-exit-title">',
      '<h2 id="knight-editor-exit-title">保存本次编辑？</h2>',
      '<p>当前页面有未保存修改。保存会优先写出 HTML 文件；如果浏览器不支持，会自动下载一份新 HTML。</p>',
      '<div class="knight-editor-modal-actions">',
      '<button class="knight-editor-button" data-modal-action="discard" type="button">不保存</button>',
      '<button class="knight-editor-button" data-modal-action="cancel" type="button">继续编辑</button>',
      '<button class="knight-editor-button knight-editor-primary" data-modal-action="save" type="button">保存并退出</button>',
      '</div>',
      '</div>'
    ].join('');

    toolbar.addEventListener('pointerdown', stopUIEvent);
    toolbar.addEventListener('click', onToolbarClick);
    toolbar.querySelector('.knight-editor-font-size').addEventListener('change', onFontSizeChange);
    toolbar.querySelector('.knight-editor-font-size').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onFontSizeChange();
      }
    });
    toolbar.querySelector('.knight-editor-color').addEventListener('input', onColorChange);
    toolbar.querySelector('.knight-editor-color').addEventListener('change', closeColorMenu);
    modalBackdrop.addEventListener('pointerdown', stopUIEvent);
    modalBackdrop.addEventListener('click', onModalClick);

    return {
      toolbar,
      selection,
      toast,
      modalBackdrop,
      status: toolbar.querySelector('.knight-editor-status'),
      sizeInput: toolbar.querySelector('.knight-editor-font-size'),
      colorInput: toolbar.querySelector('.knight-editor-color'),
      colorButton: toolbar.querySelector('.knight-editor-color-button'),
      colorMenu: toolbar.querySelector('.knight-editor-color-menu'),
      undoButton: toolbar.querySelector('[data-editor-action="undo"]'),
      redoButton: toolbar.querySelector('[data-editor-action="redo"]')
    };
  }

  function stopUIEvent(event) {
    event.stopPropagation();
  }

  function onKeyDown(event) {
    const typingTarget = isTypingTarget(event.target);
    const key = String(event.key || '');
    const mod = event.ctrlKey || event.metaKey;

    if (!state.active && !typingTarget && !mod && !event.altKey && key.toLowerCase() === 'v') {
      enter();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!state.active) return;

    if (key === 'Escape' && isColorMenuOpen()) {
      closeColorMenu();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (mod && key.toLowerCase() === 's') {
      save();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (mod && key.toLowerCase() === 'z') {
      if (event.shiftKey) redo();
      else undo();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (mod && key.toLowerCase() === 'y') {
      redo();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (key === 'Escape') {
      if (state.editingText) finishTextEdit();
      else exit();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (typingTarget) {
      event.stopPropagation();
      return;
    }

    if (isDeckNavigationKey(key)) {
      return;
    }
    event.stopPropagation();
  }

  function isTypingTarget(target) {
    return !!(target && target.closest &&
      target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function isDeckNavigationKey(key) {
    return [
      'ArrowRight',
      'ArrowLeft',
      'ArrowUp',
      'ArrowDown',
      ' ',
      'PageDown',
      'PageUp',
      'Home',
      'End',
      'Enter',
      'Backspace'
    ].includes(key);
  }

  function enter() {
    if (state.active) return;
    state.active = true;
    document.body.classList.add('knight-editor-active');
    setStatus('点击选择 · 拖动移动 · 双击改字');
    showToast('已进入编辑模式。按 Esc 退出，Ctrl+Z 撤销。');
    syncSelectionBox();
  }

  async function exit(options) {
    const opts = options || {};
    if (!state.active) return true;
    if (state.dirty && !opts.force) {
      return showExitPrompt();
    }
    finishTextEdit();
    clearSelection();
    state.active = false;
    document.body.classList.remove('knight-editor-active');
    setStatus(state.dirty ? '有未保存修改' : '已退出编辑模式', state.dirty ? 'dirty' : '');
    return true;
  }

  async function showExitPrompt() {
    ui.modalBackdrop.classList.add('is-open');
    return new Promise(resolve => {
      ui.modalResolve = resolve;
    });
  }

  async function onModalClick(event) {
    const button = event.target.closest('[data-modal-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.getAttribute('data-modal-action');
    if (action === 'cancel') {
      closeModal(false);
      return;
    }
    if (action === 'discard') {
      closeModal(true);
      await exit({ force: true });
      return;
    }
    if (action === 'save') {
      const result = await save();
      if (result && result.cancelled) {
        closeModal(false);
        return;
      }
      closeModal(true);
      await exit({ force: true });
    }
  }

  function closeModal(result) {
    ui.modalBackdrop.classList.remove('is-open');
    if (ui.modalResolve) {
      ui.modalResolve(result);
      ui.modalResolve = null;
    }
  }

  function onPointerDown(event) {
    if (!state.active) return;
    if (isColorMenuOpen() && event.target.closest && !event.target.closest('.knight-editor-color-group')) {
      closeColorMenu();
    }
    const handle = event.target.closest && event.target.closest('.knight-editor-handle');
    if (handle && state.selected) {
      startResize(event, handle.getAttribute('data-handle'));
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.target.closest && event.target.closest('.knight-editor-ui')) return;

    if (state.editingText && event.target.closest('[contenteditable="true"]')) {
      event.stopPropagation();
      return;
    }

    const editable = findEditableElement(event.target);
    if (!editable) {
      clearSelection();
      event.stopPropagation();
      return;
    }

    selectElement(editable);
    if (event.button === 0 && !state.editingText) {
      startDrag(event, editable);
      event.preventDefault();
    }
    event.stopPropagation();
  }

  function onDoubleClick(event) {
    if (!state.active) return;
    if (event.target.closest && event.target.closest('.knight-editor-ui')) return;
    const editable = findEditableElement(event.target);
    if (!editable || !isTextEditable(editable)) return;
    selectElement(editable);
    startTextEdit(editable);
    event.preventDefault();
    event.stopPropagation();
  }

  function findEditableElement(target) {
    let node = target && target.nodeType === 1 ? target : target && target.parentElement;
    if (!node || !node.closest) return null;
    if (node.closest('.knight-editor-ui')) return null;
    const slide = node.closest('.slide');
    if (!slide || !slide.classList.contains('is-active')) return null;

    for (let el = node; el && el !== slide && el !== deck; el = el.parentElement) {
      if (isExcluded(el)) return null;
      if (el.matches && el.matches(BLOCK_SELECTOR)) return el;
    }
    return null;
  }

  function isExcluded(el) {
    return !!(el && el.closest && el.closest(EXCLUDED_SELECTOR));
  }

  function isTextEditable(el) {
    const text = (el.textContent || '').trim();
    return !!text && el.matches(TEXT_SELECTOR);
  }

  function selectElement(el) {
    if (state.selected === el) {
      syncSelectionBox();
      return;
    }
    finishTextEdit();
    if (state.selected) state.selected.removeAttribute('data-knight-edit-selected');
    state.selected = el;
    ensureEditId(el);
    el.setAttribute('data-knight-edit-selected', 'true');
    document.body.classList.add('knight-editor-has-selection');
    syncToolbarFromSelection();
    syncSelectionBox();
  }

  function clearSelection() {
    finishTextEdit();
    if (state.selected) state.selected.removeAttribute('data-knight-edit-selected');
    state.selected = null;
    document.body.classList.remove('knight-editor-has-selection');
    ui.selection.classList.remove('is-visible');
    syncToolbarFromSelection();
  }

  function ensureEditId(el) {
    if (!el.hasAttribute('data-knight-edit-id')) {
      el.setAttribute('data-knight-edit-id', 'e' + state.idSeq++);
    }
  }

  function syncSelectionBox() {
    if (!state.active || !state.selected || !document.body.contains(state.selected)) {
      ui.selection.classList.remove('is-visible');
      return;
    }
    const rect = state.selected.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      ui.selection.classList.remove('is-visible');
      return;
    }
    ui.selection.style.left = rect.left + 'px';
    ui.selection.style.top = rect.top + 'px';
    ui.selection.style.width = rect.width + 'px';
    ui.selection.style.height = rect.height + 'px';
    ui.selection.classList.add('is-visible');
  }

  function startDrag(event, el) {
    state.drag = {
      type: 'drag',
      pointerId: event.pointerId,
      el,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      box: null
    };
    try { el.setPointerCapture && el.setPointerCapture(event.pointerId); } catch (err) {}
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
  }

  function startResize(event, handle) {
    const el = state.selected;
    const box = freezeElement(el);
    state.drag = {
      type: 'resize',
      pointerId: event.pointerId,
      el,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      moved: true,
      box
    };
    try { ui.selection.setPointerCapture && ui.selection.setPointerCapture(event.pointerId); } catch (err) {}
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
  }

  function onPointerMove(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    if (!drag.moved) {
      drag.box = freezeElement(drag.el);
      drag.moved = true;
    }

    if (drag.type === 'drag') {
      setElementBox(drag.el, {
        left: drag.box.left + dx,
        top: drag.box.top + dy,
        width: drag.box.width,
        height: drag.box.height
      });
    } else {
      setElementBox(drag.el, nextResizeBox(drag.box, drag.handle, dx, dy));
    }
    syncSelectionBox();
    markDirty();
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerUp(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    if (drag.moved) recordState();
    state.drag = null;
    event.preventDefault();
    event.stopPropagation();
  }

  function freezeElement(el) {
    const box = readElementBox(el);
    const computed = getComputedStyle(el);
    if (computed.position !== 'absolute') {
      ensureFlowPlaceholder(el, box, computed);
      el.style.position = 'absolute';
      el.style.left = box.left + 'px';
      el.style.top = box.top + 'px';
      el.style.width = box.width + 'px';
      el.style.height = box.height + 'px';
      el.style.margin = '0';
      if (!el.style.zIndex) el.style.zIndex = '20';
    }
    return readElementBox(el);
  }

  function ensureFlowPlaceholder(el, box, computed) {
    if (!el.parentElement || computed.position === 'fixed') return;
    if (findFlowPlaceholder(el)) return;

    const placeholder = createFlowPlaceholderElement(el);
    placeholder.className = 'knight-editor-flow-placeholder';
    placeholder.setAttribute('data-knight-flow-placeholder-for', ensureFlowId(el));
    placeholder.setAttribute('data-edit-lock', 'true');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.setAttribute('role', 'presentation');
    applyFlowPlaceholderStyle(placeholder, box, computed);
    el.parentElement.insertBefore(placeholder, el);
  }

  function ensureFlowId(el) {
    let id = el.getAttribute('data-knight-flow-id');
    if (!id) {
      id = 'f' + Date.now().toString(36) + '-' + state.idSeq++;
      el.setAttribute('data-knight-flow-id', id);
    }
    return id;
  }

  function findFlowPlaceholder(el) {
    const id = el.getAttribute('data-knight-flow-id');
    if (!id || !el.parentElement) return null;
    return Array.from(el.parentElement.children)
      .find(child => child.getAttribute('data-knight-flow-placeholder-for') === id) || null;
  }

  function createFlowPlaceholderElement(el) {
    if (el.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      return document.createElement(el.tagName.toLowerCase());
    }
    return document.createElement('div');
  }

  function applyFlowPlaceholderStyle(placeholder, box, computed) {
    const display = computed.display === 'inline' ? 'inline-block' : (computed.display === 'contents' ? 'block' : computed.display);
    placeholder.style.setProperty('display', display || 'block');
    placeholder.style.setProperty('box-sizing', 'border-box');
    placeholder.style.setProperty('width', Math.max(1, box.width) + 'px');
    placeholder.style.setProperty('height', Math.max(1, box.height) + 'px');
    placeholder.style.setProperty('min-width', '0');
    placeholder.style.setProperty('min-height', '0');
    placeholder.style.setProperty('margin-top', computed.marginTop);
    placeholder.style.setProperty('margin-right', computed.marginRight);
    placeholder.style.setProperty('margin-bottom', computed.marginBottom);
    placeholder.style.setProperty('margin-left', computed.marginLeft);
    placeholder.style.setProperty('padding', '0');
    placeholder.style.setProperty('border', '0');
    placeholder.style.setProperty('overflow', 'hidden');
    placeholder.style.setProperty('visibility', 'hidden', 'important');
    placeholder.style.setProperty('opacity', '0', 'important');
    placeholder.style.setProperty('pointer-events', 'none', 'important');
    placeholder.style.setProperty('user-select', 'none', 'important');
    placeholder.style.setProperty('flex-grow', computed.flexGrow);
    placeholder.style.setProperty('flex-shrink', computed.flexShrink);
    placeholder.style.setProperty('flex-basis', computed.flexBasis);
    placeholder.style.setProperty('align-self', computed.alignSelf);
    placeholder.style.setProperty('justify-self', computed.justifySelf);
    placeholder.style.setProperty('order', computed.order);
    placeholder.style.setProperty('grid-column-start', computed.gridColumnStart);
    placeholder.style.setProperty('grid-column-end', computed.gridColumnEnd);
    placeholder.style.setProperty('grid-row-start', computed.gridRowStart);
    placeholder.style.setProperty('grid-row-end', computed.gridRowEnd);
    placeholder.style.setProperty('vertical-align', computed.verticalAlign);
  }

  function readElementBox(el) {
    const context = getPositionContext(el);
    const contextRect = context && context.getBoundingClientRect
      ? context.getBoundingClientRect()
      : { left: 0, top: 0 };
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - contextRect.left,
      top: rect.top - contextRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function getPositionContext(el) {
    if (getComputedStyle(el).position === 'fixed') return document.documentElement;
    const offsetParent = el.offsetParent;
    if (offsetParent && offsetParent.nodeType === 1) return offsetParent;

    for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position !== 'static' || createsContainingBlock(style)) return node;
    }
    return document.documentElement;
  }

  function createsContainingBlock(style) {
    return style.transform !== 'none' ||
      style.perspective !== 'none' ||
      style.filter !== 'none' ||
      style.backdropFilter !== 'none' ||
      style.contain.indexOf('layout') !== -1 ||
      style.contain.indexOf('paint') !== -1;
  }

  function setElementBox(el, box) {
    el.style.left = Math.round(box.left) + 'px';
    el.style.top = Math.round(box.top) + 'px';
    el.style.width = Math.max(24, Math.round(box.width)) + 'px';
    el.style.height = Math.max(18, Math.round(box.height)) + 'px';
  }

  function nextResizeBox(box, handle, dx, dy) {
    const next = {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height
    };
    if (handle.includes('e')) next.width = box.width + dx;
    if (handle.includes('s')) next.height = box.height + dy;
    if (handle.includes('w')) {
      next.left = box.left + dx;
      next.width = box.width - dx;
    }
    if (handle.includes('n')) {
      next.top = box.top + dy;
      next.height = box.height - dy;
    }
    if (next.width < 24) {
      if (handle.includes('w')) next.left -= 24 - next.width;
      next.width = 24;
    }
    if (next.height < 18) {
      if (handle.includes('n')) next.top -= 18 - next.height;
      next.height = 18;
    }
    return next;
  }

  function startTextEdit(el) {
    finishTextEdit();
    state.editingText = el;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-knight-editing-text', 'true');
    el.addEventListener('paste', onPlainTextPaste);
    el.addEventListener('input', onTextInput);
    el.addEventListener('blur', finishTextEdit, { once: true });
    placeCaretAtEnd(el);
    setStatus('正在编辑文字，Esc 完成');
  }

  function finishTextEdit() {
    const el = state.editingText;
    if (!el) return;
    el.removeEventListener('paste', onPlainTextPaste);
    el.removeEventListener('input', onTextInput);
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.removeAttribute('data-knight-editing-text');
    state.editingText = null;
    recordState();
    syncSelectionBox();
    setStatus(state.dirty ? '已修改，记得保存' : '点击选择 · 拖动移动 · 双击改字', state.dirty ? 'dirty' : '');
  }

  function onPlainTextPaste(event) {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text/plain');
    try { document.execCommand('insertText', false, text); }
    catch (err) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(text));
    }
  }

  function onTextInput() {
    markDirty();
    saveDraft();
    syncSelectionBox();
  }

  function placeCaretAtEnd(el) {
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function onToolbarClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    event.preventDefault();
    if (button.disabled) return;

    const color = button.getAttribute('data-editor-color');
    if (color) {
      applyColor(color, true);
      return;
    }

    const action = button.getAttribute('data-editor-action');
    if (action === 'save') save();
    if (action === 'undo') undo();
    if (action === 'redo') redo();
    if (action === 'color-menu') toggleColorMenu();

    const command = button.getAttribute('data-editor-command');
    if (command === 'bold') toggleBold();

    const align = button.getAttribute('data-editor-align');
    if (align) applyStyle('textAlign', align);
  }

  function onFontSizeChange() {
    const value = Math.max(10, Math.min(180, parseInt(ui.sizeInput.value, 10) || 14));
    ui.sizeInput.value = String(value);
    applyStyle('fontSize', value + 'px');
  }

  function onColorChange() {
    applyColor(ui.colorInput.value, false);
  }

  function applyColor(color, closeAfterApply) {
    setCurrentColor(color);
    applyStyle('color', color);
    if (closeAfterApply) closeColorMenu();
  }

  function toggleColorMenu() {
    if (!state.selected) {
      showToast('先选中一个元素');
      return;
    }
    ui.colorMenu.classList.toggle('is-open');
    ui.colorButton.setAttribute('aria-expanded', ui.colorMenu.classList.contains('is-open') ? 'true' : 'false');
  }

  function closeColorMenu() {
    ui.colorMenu.classList.remove('is-open');
    ui.colorButton.setAttribute('aria-expanded', 'false');
  }

  function isColorMenuOpen() {
    return ui.colorMenu && ui.colorMenu.classList.contains('is-open');
  }

  function toggleBold() {
    const el = state.selected;
    if (!el) return;
    const weight = parseInt(getComputedStyle(el).fontWeight, 10) || 400;
    applyStyle('fontWeight', weight >= 700 ? '400' : '800');
  }

  function applyStyle(property, value) {
    const el = state.selected;
    if (!el) {
      showToast('先选中一个元素');
      return;
    }
    finishTextEdit();
    el.style[property] = value;
    markDirty();
    recordState();
    syncToolbarFromSelection();
    syncSelectionBox();
  }

  function syncToolbarFromSelection() {
    const el = state.selected;
    const has = !!el;
    ui.toolbar.querySelectorAll('[data-editor-command], [data-editor-align], .knight-editor-font-size, .knight-editor-color-button, .knight-editor-color')
      .forEach(control => { control.disabled = !has; });
    if (!has) {
      closeColorMenu();
      ui.sizeInput.value = '32';
      setCurrentColor('#111216');
      return;
    }
    const computed = getComputedStyle(el);
    ui.sizeInput.value = String(Math.round(parseFloat(computed.fontSize) || 32));
    setCurrentColor(colorToHex(computed.color) || '#111216');
    const weight = parseInt(computed.fontWeight, 10) || 400;
    ui.toolbar.querySelector('[data-editor-command="bold"]').classList.toggle('is-active', weight >= 700);
    ui.toolbar.querySelectorAll('[data-editor-align]').forEach(button => {
      button.classList.toggle('is-active', button.getAttribute('data-editor-align') === computed.textAlign);
    });
  }

  function colorToHex(color) {
    const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '';
    return '#' + [match[1], match[2], match[3]].map(part => {
      const hex = Math.max(0, Math.min(255, parseInt(part, 10))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function setCurrentColor(color) {
    const value = normalizeHex(color) || '#111216';
    ui.colorInput.value = value;
    ui.colorButton.style.setProperty('--current-color', value);
    ui.toolbar.querySelectorAll('[data-editor-color]').forEach(button => {
      button.classList.toggle('is-active', normalizeHex(button.getAttribute('data-editor-color')) === value);
    });
  }

  function normalizeHex(color) {
    const value = String(color || '').trim().toLowerCase();
    const short = value.match(/^#([0-9a-f]{3})$/i);
    if (short) {
      return '#' + short[1].split('').map(ch => ch + ch).join('').toLowerCase();
    }
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
  }

  function captureSlides() {
    return Array.from(deck.querySelectorAll('.slide')).map(slide => sanitizeSlideHTML(slide));
  }

  function sanitizeSlideHTML(slide) {
    const clone = slide.cloneNode(true);
    scrubTransient(clone);
    return clone.innerHTML;
  }

  function applySlides(snapshot) {
    const slides = Array.from(deck.querySelectorAll('.slide'));
    snapshot.forEach((html, index) => {
      if (slides[index]) slides[index].innerHTML = html;
    });
    clearSelection();
  }

  function recordState() {
    const snapshot = captureSlides();
    const current = state.history[state.historyIndex];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex = state.history.length - 1;
    markDirty();
    saveDraft();
    updateToolbarState();
  }

  function undo() {
    finishTextEdit();
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    applySlides(state.history[state.historyIndex]);
    markDirty();
    saveDraft();
    updateToolbarState();
    showToast('已撤销');
  }

  function redo() {
    finishTextEdit();
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    applySlides(state.history[state.historyIndex]);
    markDirty();
    saveDraft();
    updateToolbarState();
    showToast('已重做');
  }

  function markDirty() {
    state.dirty = true;
    setStatus('已修改，记得保存', 'dirty');
  }

  function updateToolbarState() {
    ui.undoButton.disabled = state.historyIndex <= 0;
    ui.redoButton.disabled = state.historyIndex >= state.history.length - 1;
  }

  function setStatus(text, tone) {
    ui.status.textContent = text;
    ui.status.classList.toggle('is-dirty', tone === 'dirty');
    ui.status.classList.toggle('is-saved', tone === 'saved');
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        updatedAt: Date.now(),
        slides: captureSlides()
      }));
    } catch (err) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch (err) {}
  }

  function maybeOfferDraftRestore() {
    let draft;
    try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); }
    catch (err) { draft = null; }
    if (!draft || !Array.isArray(draft.slides)) return;
    const current = captureSlides();
    if (JSON.stringify(current) === JSON.stringify(draft.slides)) return;
    const restore = window.confirm('检测到上次未保存的编辑草稿，是否恢复？');
    if (restore) {
      applySlides(draft.slides);
      state.history = [draft.slides];
      state.historyIndex = 0;
      state.dirty = true;
      setStatus('已恢复草稿，记得保存', 'dirty');
    } else {
      clearDraft();
    }
  }

  async function save() {
    finishTextEdit();
    const html = serializeDocument();
    const suggestedName = suggestedFileName();
    if (state.fileHandleReady) {
      try { await state.fileHandleReady; } catch (err) {}
    }
    try {
      let handle = state.fileHandle;
      if (handle && !(await ensureWritePermission(handle, true))) {
        handle = null;
        state.fileHandle = null;
      }
      if (handle || typeof window.showSaveFilePicker === 'function') {
        handle = handle || await window.showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'HTML presentation',
            accept: { 'text/html': ['.html'] }
          }]
        });
        state.fileHandle = handle;
        await rememberFileHandle(handle);
        const writable = await handle.createWritable();
        await writable.write(new Blob([html], { type: 'text/html;charset=utf-8' }));
        await writable.close();
        afterSave('已保存 HTML 文件');
        return { method: 'file' };
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        showToast('已取消保存');
        return { cancelled: true };
      }
      showToast('无法直接写入文件，已改为下载 HTML');
    }
    downloadHtml(html, suggestedName);
    afterSave('已下载修改后的 HTML');
    return { method: 'download' };
  }

  async function restoreFileHandle() {
    const handle = await readRememberedFileHandle();
    if (!handle) return;
    if (await ensureWritePermission(handle, false)) {
      state.fileHandle = handle;
      setStatus('已授权，Ctrl+S 覆盖', 'saved');
    }
  }

  function openHandleDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise(resolve => {
      const req = indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  async function readRememberedFileHandle() {
    const db = await openHandleDb();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const req = tx.objectStore(HANDLE_STORE).get(fileHandleKey);
      req.onsuccess = () => resolve(req.result && req.result.handle ? req.result.handle : null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => {
        db.close();
        resolve(null);
      };
    });
  }

  async function rememberFileHandle(handle) {
    const db = await openHandleDb();
    if (!db || !handle) return;
    return new Promise(resolve => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite');
      try {
        tx.objectStore(HANDLE_STORE).put({ handle, updatedAt: Date.now() }, fileHandleKey);
      } catch (err) {
        try { tx.abort(); } catch (abortErr) {}
        db.close();
        resolve();
        return;
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve();
      };
    });
  }

  async function ensureWritePermission(handle, requestIfNeeded) {
    if (!handle || typeof handle.createWritable !== 'function') return false;
    const options = { mode: 'readwrite' };
    try {
      if (typeof handle.queryPermission === 'function') {
        const current = await handle.queryPermission(options);
        if (current === 'granted') return true;
        if (!requestIfNeeded) return false;
      }
      if (requestIfNeeded && typeof handle.requestPermission === 'function') {
        return await handle.requestPermission(options) === 'granted';
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function afterSave(message) {
    state.dirty = false;
    clearDraft();
    setStatus(message, 'saved');
    showToast(message);
  }

  function suggestedFileName() {
    const title = (document.title || 'deck').trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'deck';
    return /\.html?$/i.test(title) ? title : title + '.html';
  }

  function downloadHtml(html, name) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function serializeDocument() {
    const clone = document.documentElement.cloneNode(true);
    clone.classList.remove('knight-editor-active', 'knight-editor-has-selection');
    const body = clone.querySelector('body');
    if (body) body.classList.remove('knight-editor-active', 'knight-editor-has-selection');

    clone.querySelectorAll([
      '.knight-editor-ui',
      '[data-knight-editor-asset]',
      '.progress-bar',
      '.notes-overlay',
      '.overview',
      '.page-navigator',
      '.page-nav-hotspot',
      'script[src*="/assets/animations/fx/"]',
      'script[src*="\\\\assets\\\\animations\\\\fx\\\\"]',
      'style[data-overview-style]',
      'style[data-page-nav-style]',
      'style[data-page-navigator-style]'
    ].join(',')).forEach(node => node.remove());

    scrubTransient(clone);
    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  function scrubTransient(root) {
    root.querySelectorAll('[data-knight-edit-id], [data-knight-edit-selected], [data-knight-editing-text], [contenteditable]')
      .forEach(node => {
        node.removeAttribute('data-knight-edit-id');
        node.removeAttribute('data-knight-edit-selected');
        node.removeAttribute('data-knight-editing-text');
        node.removeAttribute('contenteditable');
        node.removeAttribute('spellcheck');
      });
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('is-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), 2200);
  }
})();
