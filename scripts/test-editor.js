#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

function requirePlaywright() {
  try {
    return require('playwright');
  } catch (err) {
    const bundled = process.env.CODEX_BUNDLED_NODE_MODULES ||
      'C:\\Users\\windx\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
    const pnpmDir = path.join(bundled, '.pnpm');
    if (!fs.existsSync(pnpmDir)) throw err;
    const entry = fs.readdirSync(pnpmDir).find(name => /^playwright@\d/.test(name));
    if (!entry) throw err;
    return require(path.join(pnpmDir, entry, 'node_modules', 'playwright'));
  }
}

const { chromium } = requirePlaywright();

const root = path.resolve(__dirname, '..');
const runtimeUrl = pathToFileURL(path.join(root, 'assets', 'runtime.js')).href;
const baseUrl = pathToFileURL(path.join(root, 'assets', 'base.css')).href;
const themeUrl = pathToFileURL(path.join(root, 'assets', 'themes', 'corporate-clean.css')).href;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knight-editor-test-'));
  const htmlPath = path.join(tmp, 'index.html');
  fs.writeFileSync(htmlPath, `<!doctype html>
<html lang="zh-CN" data-theme="corporate-clean" data-themes="corporate-clean" data-theme-base="${pathToFileURL(path.join(root, 'assets', 'themes')).href}/">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="${baseUrl}">
  <link rel="stylesheet" id="theme-link" href="${themeUrl}">
  <style>
    .slide { padding: 80px 100px; }
    .card { width: 420px; }
    .nested-wrap { position: relative; width: 520px; padding: 20px; margin-top: 18px; border: 1px solid rgba(0,0,0,.08); }
    .nested-wrap .lede { margin: 0; }
  </style>
</head>
<body>
<div class="deck">
  <section class="slide" data-title="测试页">
    <h1 class="h1" id="title">原始标题</h1>
    <p class="lede" id="lede">原始说明文本</p>
    <div class="nested-wrap" id="nested-wrap"><p class="lede" id="nested-text">嵌套文本</p></div>
    <div class="card" id="card"><strong>42</strong><span>指标卡</span></div>
    <div class="slide-fx" data-edit-lock="true"></div>
    <div class="deck-footer"><span>Footer</span><span class="slide-number" data-current="1" data-total="1"></span></div>
    <aside class="notes"><p>notes</p></aside>
  </section>
  <section class="slide" data-title="第二页">
    <h2 class="h2" id="second-title">第二页</h2>
    <p class="lede">用于验证编辑模式下的翻页。</p>
    <div class="deck-footer"><span>Footer</span><span class="slide-number" data-current="2" data-total="2"></span></div>
    <aside class="notes"><p>notes 2</p></aside>
  </section>
</div>
<script src="${runtimeUrl}"></script>
</body>
</html>`, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => {
    window.__savedChunks = [];
    window.__savePickerCount = 0;
    window.__writeCount = 0;
    window.showSaveFilePicker = async () => ({
      name: 'index.html',
      createWritable: async () => ({
        write: async chunk => {
          window.__writeCount += 1;
          if (chunk instanceof Blob) window.__savedChunks.push(await chunk.text());
          else window.__savedChunks.push(String(chunk));
        },
        close: async () => {}
      })
    });
    const originalPicker = window.showSaveFilePicker;
    window.showSaveFilePicker = async (...args) => {
      window.__savePickerCount += 1;
      return originalPicker(...args);
    };
  });

  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => window.KnightDeckEditor && typeof window.KnightDeckEditor.enter === 'function', null, { timeout: 5000 });

  await page.keyboard.press('v');
  assert(await page.evaluate(() => document.body.classList.contains('knight-editor-active')), 'V should enter editor mode');
  assert(await page.locator('.knight-editor-toolbar').isVisible(), 'toolbar should be visible in editor mode');
  const toolbarTextFit = await page.evaluate(() => {
    const toolbar = document.querySelector('.knight-editor-toolbar');
    const before = getComputedStyle(toolbar, '::before');
    const status = document.querySelector('.knight-editor-status');
    return {
      beforeWhiteSpace: before.whiteSpace,
      beforeFlexShrink: before.flexShrink,
      statusText: status.textContent,
      statusWhiteSpace: getComputedStyle(status).whiteSpace,
      statusClientWidth: status.clientWidth,
      statusScrollWidth: status.scrollWidth
    };
  });
  assert(toolbarTextFit.beforeWhiteSpace === 'nowrap', 'editor badge should not wrap');
  assert(toolbarTextFit.beforeFlexShrink === '0', 'editor badge should not shrink into two lines');
  assert(toolbarTextFit.statusText.includes('双击改字'), 'toolbar status should show the complete double-click hint');
  assert(toolbarTextFit.statusWhiteSpace === 'nowrap', 'toolbar status should stay on one line');
  assert(toolbarTextFit.statusScrollWidth <= toolbarTextFit.statusClientWidth + 1, 'toolbar status should not be ellipsized');

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => location.hash === '#/2');
  assert(await page.evaluate(() => document.querySelectorAll('.slide')[1].classList.contains('is-active')), 'ArrowRight should navigate while editor is active but not editing text');
  await page.waitForTimeout(420);
  await page.mouse.wheel(0, -220);
  await page.waitForFunction(() => location.hash === '#/1');
  assert(await page.evaluate(() => document.querySelectorAll('.slide')[0].classList.contains('is-active')), 'mouse wheel should navigate while editor is active but not editing text');

  await page.click('#lede');
  assert(await page.evaluate(() => document.querySelector('#lede').hasAttribute('data-knight-edit-selected')), 'click should select lede text');

  await page.fill('.knight-editor-font-size', '44');
  await page.dispatchEvent('.knight-editor-font-size', 'change');
  await page.click('[data-editor-command="bold"]');
  await page.click('[data-editor-align="center"]');
  const styled = await page.evaluate(() => {
    const el = document.querySelector('#lede');
    return {
      fontSize: el.style.fontSize,
      fontWeight: el.style.fontWeight,
      textAlign: el.style.textAlign
    };
  });
  assert(styled.fontSize === '44px', 'font size control should update inline font-size');
  assert(styled.fontWeight === '800' || styled.fontWeight === 'bold' || Number(styled.fontWeight) >= 700, 'bold button should update font-weight');
  assert(styled.textAlign === 'center', 'align button should update text-align');

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  const afterUndo = await page.evaluate(() => document.querySelector('#lede').style.textAlign);
  assert(afterUndo !== 'center', 'Ctrl+Z should undo the last style command');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Y');
  const afterRedo = await page.evaluate(() => document.querySelector('#lede').style.textAlign);
  assert(afterRedo === 'center', 'Ctrl+Y should redo the last style command');

  await page.click('#lede');
  await page.click('.knight-editor-color-button');
  assert(await page.locator('.knight-editor-color-menu.is-open').isVisible(), 'color button should open the lightweight color palette');
  assert(await page.locator('.knight-editor-color-custom input[type="color"]').count() === 1, 'color palette should keep one custom color entry');
  await page.click('[data-editor-color="#2563eb"]');
  const selectedColor = await page.evaluate(() => ({
    color: getComputedStyle(document.querySelector('#lede')).color,
    menuOpen: document.querySelector('.knight-editor-color-menu').classList.contains('is-open')
  }));
  assert(selectedColor.color === 'rgb(37, 99, 235)', 'palette swatch should apply the selected common color');
  assert(!selectedColor.menuOpen, 'palette should close after picking a common color');

  const ledeBeforeDrag = await page.locator('#lede').boundingBox();
  const nestedWrapBeforeLedeDrag = await page.locator('#nested-wrap').boundingBox();
  await page.mouse.move(ledeBeforeDrag.x + 8, ledeBeforeDrag.y + 8);
  await page.mouse.down();
  await page.mouse.move(ledeBeforeDrag.x + 70, ledeBeforeDrag.y + 42, { steps: 4 });
  await page.mouse.up();
  const ledeAfterDrag = await page.locator('#lede').boundingBox();
  const nestedWrapAfterLedeDrag = await page.locator('#nested-wrap').boundingBox();
  assert(ledeAfterDrag.x > ledeBeforeDrag.x + 30 && ledeAfterDrag.x < ledeBeforeDrag.x + 110, 'dragging flow text should move the selected element');
  assert(ledeAfterDrag.y > ledeBeforeDrag.y + 15 && ledeAfterDrag.y < ledeBeforeDrag.y + 80, 'dragging flow text should follow the pointer vertically');
  assert(Math.abs(nestedWrapAfterLedeDrag.y - nestedWrapBeforeLedeDrag.y) < 2, 'dragging flow text should not move following elements');

  const cardBefore = await page.locator('#card').boundingBox();
  await page.mouse.click(cardBefore.x + 8, cardBefore.y + 8);
  await page.mouse.move(cardBefore.x + 8, cardBefore.y + 8);
  await page.mouse.down();
  await page.mouse.move(cardBefore.x + 68, cardBefore.y + 50, { steps: 4 });
  await page.mouse.up();
  const cardAfterDrag = await page.evaluate(() => {
    const el = document.querySelector('#card');
    return {
      position: el.style.position,
      left: parseFloat(el.style.left),
      top: parseFloat(el.style.top)
    };
  });
  assert(cardAfterDrag.position === 'absolute', 'dragging should freeze a common block as absolute');
  assert(cardAfterDrag.left > 0 && cardAfterDrag.top > 0, 'dragging should write left/top coordinates');

  const nestedBefore = await page.locator('#nested-text').boundingBox();
  await page.mouse.click(nestedBefore.x + 8, nestedBefore.y + 8);
  await page.mouse.move(nestedBefore.x + 8, nestedBefore.y + 8);
  await page.mouse.down();
  await page.mouse.move(nestedBefore.x + 68, nestedBefore.y + 48, { steps: 4 });
  await page.mouse.up();
  const nestedAfter = await page.locator('#nested-text').boundingBox();
  assert(Number.isFinite(nestedAfter.x) && Number.isFinite(nestedAfter.y), 'dragged nested element should still have a visible bounding box');
  assert(nestedAfter.x > nestedBefore.x + 30 && nestedAfter.x < nestedBefore.x + 120, 'dragging nested element should move horizontally instead of jumping away');
  assert(nestedAfter.y > nestedBefore.y + 15 && nestedAfter.y < nestedBefore.y + 95, 'dragging nested element should move vertically instead of jumping away');

  const cardForResize = await page.locator('#card').boundingBox();
  await page.mouse.click(cardForResize.x + 8, cardForResize.y + 8);
  const cardWidthBefore = await page.evaluate(() => document.querySelector('#card').getBoundingClientRect().width);
  const handle = await page.locator('.knight-editor-handle[data-handle="se"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 74, handle.y + 44, { steps: 4 });
  await page.mouse.up();
  const cardWidthAfter = await page.evaluate(() => document.querySelector('#card').getBoundingClientRect().width);
  assert(cardWidthAfter > cardWidthBefore + 20, 'resize handle should increase selected block width');

  await page.dblclick('#lede');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('ABC');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  const editedWithCursorKeys = await page.evaluate(() => document.querySelector('#lede').textContent);
  assert(editedWithCursorKeys === 'AC', 'Backspace and arrow keys should work while editing text');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('编辑后的说明');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => document.querySelector('#lede').textContent.includes('编辑后的说明')), 'double click should allow text editing');

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'http://127.0.0.1:5187/assets/animations/fx/constellation.js';
    document.head.appendChild(script);
    const style = document.createElement('style');
    style.setAttribute('data-page-navigator-style', 'true');
    style.textContent = '.page-navigator{display:block}';
    document.head.appendChild(style);
  });
  await page.evaluate(() => window.KnightDeckEditor.save());
  const saved = await page.evaluate(() => window.__savedChunks.join(''));
  assert(saved.includes('编辑后的说明'), 'saved HTML should include edited text');
  assert(saved.includes('data-knight-flow-placeholder-for'), 'saved HTML should keep invisible flow placeholders for moved flow elements');
  assert(!saved.includes('127.0.0.1'), 'saved HTML should not include local runtime asset URLs');
  assert(!saved.includes('data-page-navigator-style'), 'saved HTML should not include generated page navigator style');
  assert(!saved.includes('knight-editor-toolbar'), 'saved HTML should not include editor toolbar UI');
  assert(!saved.includes('data-knight-edit-selected'), 'saved HTML should not include transient selection markers');
  const firstSaveStats = await page.evaluate(() => ({ pickers: window.__savePickerCount, writes: window.__writeCount }));
  assert(firstSaveStats.pickers === 1, 'first save should ask for a file handle exactly once');
  assert(firstSaveStats.writes === 1, 'first save should write once');

  await page.click('#title');
  await page.fill('.knight-editor-font-size', '48');
  await page.dispatchEvent('.knight-editor-font-size', 'change');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');
  await page.waitForFunction(() => window.__writeCount === 2);
  const secondSaveStats = await page.evaluate(() => ({ pickers: window.__savePickerCount, writes: window.__writeCount }));
  assert(secondSaveStats.pickers === 1, 'Ctrl+S should reuse the existing file handle without opening another picker');
  assert(secondSaveStats.writes === 2, 'Ctrl+S should write the HTML through the existing file handle');

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('editor tests passed');
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
