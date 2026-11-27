(function () {
  'use strict';

  const Engine = window.MatGrafEngine;
  const Renderer = window.MatGrafRenderer;

  // Ilk 4 grafik icin temel palet (mavi, kirmizi, acik mavi, beyaz/siyah);
  // 4'ten fazla grafik eklendiginde karismamasi icin ek ayirt edici renkler devreye girer.
  const BASE_COLORS = ['#2563eb', '#dc2626', '#60a5fa', '#ffffff'];
  const EXTRA_COLORS = ['#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

  function pickCurveColor(index) {
    if (index < BASE_COLORS.length) return BASE_COLORS[index];
    return EXTRA_COLORS[(index - BASE_COLORS.length) % EXTRA_COLORS.length];
  }
  // Yukaridaki fonksiyon ilk 4 grafikte temel renkleri, 5. grafikten itibaren ise
  // farkli renkleri secerek coklu grafiklerin kolayca ayirt edilmesini saglar.

  const state = {
    appMode: 'home', // 'home' | 'calc' | 'graph' | 'both'
    theme: 'dark',
    angleUnit: 'DEG',
    showRefCurve: true,
    padMode: 'basic',
    keypadOpenMobile: true,
    variables: {},
    graphs: [],
    history: [],
    shadedIntegral: null,
    lastResultText: '9',
    view: { xMin: -6, xMax: 6, yMin: -2, yMax: 12 },
    pointer: { active: false, px: 0, py: 0, wx: 0, wy: 0 },
    dragging: false,
    dragStart: { px: 0, py: 0, xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
    nextId: 1
  };
  // Yukaridaki state nesnesi; 3 kutu modunu, ozel degisken atamalarini (a, b vb.),
  // aktif grafikleri, gecmis listesini ve gorunum penceresini saklar.

  const homeMenu = document.getElementById('homeMenu');
  const workspaceView = document.getElementById('workspaceView');
  const topModeSwitcher = document.getElementById('topModeSwitcher');
  const mobileModeSwitcher = document.getElementById('mobileModeSwitcher');
  const leftColumn = document.getElementById('leftColumn');
  const rightGraphSection = document.getElementById('rightGraphSection');
  const resultCard = document.getElementById('resultCard');
  const quickExamplesWrap = document.getElementById('quickExamplesWrap');
  const keypadContainer = document.getElementById('keypadContainer');
  const btnToggleKeypad = document.getElementById('btnToggleKeypad');
  const variablesBar = document.getElementById('variablesBar');
  const variablesList = document.getElementById('variablesList');

  const exprForm = document.getElementById('exprForm');
  const exprInput = document.getElementById('exprInput');
  const btnClearInput = document.getElementById('btnClearInput');
  const btnSubmitLabel = document.getElementById('btnSubmitLabel');
  const errorBanner = document.getElementById('errorBanner');
  const errorText = document.getElementById('errorText');

  const resultModeBadge = document.getElementById('resultModeBadge');
  const resultExpr = document.getElementById('resultExpr');
  const resultValue = document.getElementById('resultValue');
  const resultNote = document.getElementById('resultNote');
  const btnCopyResult = document.getElementById('btnCopyResult');
  const copyLabel = document.getElementById('copyLabel');

  const btnDeg = document.getElementById('btnDeg');
  const btnRad = document.getElementById('btnRad');
  const btnTheme = document.getElementById('btnTheme');
  const themeIcon = document.getElementById('themeIcon');
  const angleUnitPill = document.getElementById('angleUnitPill');
  const btnToggleRef = document.getElementById('btnToggleRef');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnResetView = document.getElementById('btnResetView');
  const btnClearGraphs = document.getElementById('btnClearGraphs');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const btnClearAll = document.getElementById('btnClearAll');

  const tabGraphs = document.getElementById('tabGraphs');
  const tabHistory = document.getElementById('tabHistory');
  const panelGraphs = document.getElementById('panelGraphs');
  const panelHistory = document.getElementById('panelHistory');
  const historyListWrap = document.getElementById('historyListWrap');
  const graphCount = document.getElementById('graphCount');
  const historyCount = document.getElementById('historyCount');

  const derivPointInput = document.getElementById('derivPointInput');
  const btnSolveDeriv = document.getElementById('btnSolveDeriv');
  const intLowerInput = document.getElementById('intLowerInput');
  const intUpperInput = document.getElementById('intUpperInput');
  const btnSolveInt = document.getElementById('btnSolveInt');

  const canvasContainer = document.getElementById('canvasContainer');
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  const coordBadge = document.getElementById('coordBadge');
  const helpModal = document.getElementById('helpModal');
  const btnHelp = document.getElementById('btnHelp');
  const btnCloseHelp = document.getElementById('btnCloseHelp');

  // Coklu dokunma (pinch-to-zoom) takibi
  const activePointers = new Map();
  let pinchStart = null;

  function showError(msg) { errorText.textContent = msg; errorBanner.classList.remove('hidden'); }
  function hideError() { errorBanner.classList.add('hidden'); }
  function redraw() {
    if (state.appMode === 'graph' || state.appMode === 'both') {
      Renderer.drawGraph(canvas, ctx, canvasContainer, state, coordBadge);
    }
  }

  function resizeCanvas() {
    if (state.appMode !== 'graph' && state.appMode !== 'both') return;
    const rect = canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function renderVariables() {
    const keys = Object.keys(state.variables);
    if (keys.length === 0) {
      variablesBar.classList.add('hidden');
      return;
    }
    variablesBar.classList.remove('hidden');
    variablesList.innerHTML = keys.map(k =>
      '<div class="inline-flex items-center gap-1 px-2 py-1 rounded-lg soft-surface text-xs font-mono-math">' +
      '<span class="font-bold text-blue-500">' + k + ' =</span>' +
      '<input type="number" step="any" data-var-input="' + k + '" value="' + state.variables[k] + '" ' +
      'style="background: var(--input-bg); color: var(--text-main);" ' +
      'class="w-14 px-1.5 py-0.5 rounded border border-white/15 text-xs font-mono-math outline-none focus:border-blue-500" />' +
      '<button type="button" data-remove-var="' + k + '" class="opacity-60 hover:opacity-100 hover:text-red-500 pl-0.5" title="Sil">×</button>' +
      '</div>'
    ).join('');
  }
  // Yukaridaki fonksiyon, tanimlanan ozel degiskenleri (a = 5 gibi) canli olarak
  // duzenlenebilir kutucuklar halinde gosterir; deger degistiginde grafik aninda yenilenir.

  function setAppMode(mode) {
    state.appMode = mode;
    hideError();

    if (mode === 'home') {
      homeMenu.classList.remove('hidden');
      workspaceView.classList.add('hidden');
      topModeSwitcher.classList.add('hidden');
      mobileModeSwitcher.classList.add('hidden');
      return;
    }

    homeMenu.classList.add('hidden');
    workspaceView.classList.remove('hidden');
    topModeSwitcher.classList.remove('hidden');
    mobileModeSwitcher.classList.remove('hidden');

    document.querySelectorAll('[data-nav-mode]').forEach(btn => {
      const active = btn.getAttribute('data-nav-mode') === mode;
      btn.className = active
        ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white transition-all'
        : 'px-3 py-1.5 rounded-lg text-xs font-semibold opacity-75 hover:opacity-100 transition-all';
    });

    // Mod degisince tus takimi sekmesini ve ek alanlari sifirla
    switchPadMode('basic');
    derivPointInput.value = '';
    intLowerInput.value = '';
    intUpperInput.value = '';
    state.shadedIntegral = null;

    if (mode === 'calc') {
      leftColumn.className = 'lg:col-span-12 max-w-2xl w-full mx-auto flex flex-col gap-3 sm:gap-4 order-1';
      rightGraphSection.classList.add('hidden');
      resultCard.classList.remove('hidden');
      quickExamplesWrap.classList.remove('hidden');
      tabGraphs.classList.add('hidden');
      btnSubmitLabel.textContent = 'Hesapla';
      exprInput.placeholder = 'Örn: a = 5, 2a + 10, 125 + 48 * 3...';
      switchBottomTab('history');
      exprInput.value = '125 + 48 * 3';
      processExpression(exprInput.value, { recordHistory: false, isInitial: true });
    } else if (mode === 'graph') {
      leftColumn.className = 'lg:col-span-5 xl:col-span-4 flex flex-col gap-3 sm:gap-4 order-2 lg:order-1';
      rightGraphSection.classList.remove('hidden');
      resultCard.classList.add('hidden');
      quickExamplesWrap.classList.remove('hidden');
      tabGraphs.classList.remove('hidden');
      btnSubmitLabel.textContent = 'Çiz';
      exprInput.placeholder = 'Örn: x^2 x>0, sin(x) cos(x), x=a...';
      switchBottomTab('graphs');
      exprInput.value = 'tan(x+20)';
      setTimeout(() => { resizeCanvas(); processExpression(exprInput.value, { recordHistory: false, isInitial: true }); }, 20);
    } else if (mode === 'both') {
      leftColumn.className = 'lg:col-span-5 xl:col-span-4 flex flex-col gap-3 sm:gap-4 order-2 lg:order-1';
      rightGraphSection.classList.remove('hidden');
      resultCard.classList.remove('hidden');
      quickExamplesWrap.classList.add('hidden');
      tabGraphs.classList.remove('hidden');
      btnSubmitLabel.textContent = 'Hesapla';
      exprInput.placeholder = 'Örn: 3 üzeri 2, x^2 x>0, sin(x), cos(x)...';
      switchBottomTab('graphs');
      exprInput.value = '3 üzeri 2';
      setTimeout(() => { resizeCanvas(); processExpression(exprInput.value, { recordHistory: false, isInitial: true }); }, 20);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function addGraphItem(item, replaceInitial) {
    if (replaceInitial && state.graphs.length === 1 && state.graphs[0].isInitial) state.graphs = [];
    const domKey = item.domain ? (item.domain.label || '') : '';
    const existing = state.graphs.find(g => g.normalized === item.normalized && g.kind === (item.kind || 'curve') && (g.domain ? (g.domain.label || '') : '') === domKey && Boolean(g.dashed) === Boolean(item.dashed));
    if (existing) { existing.visible = true; return existing; }
    const color = item.color || pickCurveColor(state.graphs.length);
    const created = Object.assign({ id: state.nextId++, color, visible: true, isInitial: false, dashed: false, kind: 'curve', domain: null }, item);
    state.graphs.push(created);
    return created;
  }

  function autoFitViewForItem(item) {
    if (item.hasTrig && state.angleUnit === 'DEG') { state.view = { xMin: -180, xMax: 180, yMin: -6, yMax: 6 }; return; }
    if (item.hasTrig && state.angleUnit === 'RAD') { state.view = { xMin: -10, xMax: 10, yMin: -5, yMax: 5 }; return; }
    if (item.simplePower) {
      const yVal = item.constVal, xFocus = item.simplePower.exp;
      const xSpan = Math.max(6, Math.abs(xFocus) * 2.5);
      const yPad = Math.max(4, Math.abs(yVal) * 0.35);
      state.view = { xMin: Math.min(-4, xFocus - xSpan), xMax: Math.max(6, xFocus + xSpan), yMin: Math.min(-2, yVal - yPad), yMax: Math.max(yVal + yPad, 4) };
      return;
    }
    if (item.constVal !== null && Number.isFinite(item.constVal)) {
      const span = Math.max(5, Math.abs(item.constVal) * 0.5);
      state.view = { xMin: -10, xMax: 10, yMin: item.constVal - span, yMax: item.constVal + span };
      return;
    }
    state.view = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 };
  }

  function insertAtCursor(text) {
    const s = exprInput.selectionStart ?? exprInput.value.length;
    const e = exprInput.selectionEnd ?? exprInput.value.length;
    exprInput.value = exprInput.value.slice(0, s) + text + exprInput.value.slice(e);
    const pos = s + text.length;
    exprInput.focus();
    exprInput.setSelectionRange(pos, pos);
  }

  function ensureParamsExist(ast) {
    const params = Engine.extractParams(ast);
    let added = false;
    params.forEach(p => {
      if (!(p in state.variables)) {
        state.variables[p] = 1;
        added = true;
      }
    });
    if (added) renderVariables();
  }

  function runDerivative(rawExpr, xPoint) {
    hideError();
    const cleaned = (rawExpr || '').trim();
    if (!cleaned) { showError('Türev almak için bir fonksiyon yazın (örn: x^3 + 2x).'); return; }
    let norm, ast;
    try {
      norm = Engine.normalizeTurkishMath(cleaned);
      ast = Engine.parseExpression(norm.normalized);
    } catch (err) { showError(err.message || 'İfade anlaşılamadı.'); return; }

    ensureParamsExist(ast);
    Engine.callPythonApi('/api/turev', { expression: norm.normalized, xPoint: xPoint || null });

    const res = Engine.solveDerivative(ast, xPoint, state.variables);
    state.shadedIntegral = null;

    if (state.appMode === 'graph' || state.appMode === 'both') {
      state.graphs = [];
      addGraphItem({ raw: norm.normalized, normalized: norm.normalized, ast, hasX: true, hasTrig: false, simplePower: null, constVal: null, color: '#2563eb' }, false);
      addGraphItem({ raw: "f'(x)", normalized: res.text, ast: res.ast, hasX: true, hasTrig: false, simplePower: null, constVal: null, color: '#dc2626', dashed: true }, false);
      state.view = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 };
    }

    if (state.appMode !== 'graph') {
      resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-red-600/15 text-red-500 border border-red-600/30';
      resultModeBadge.innerHTML = '<i data-lucide="sigma" class="w-3.5 h-3.5"></i><span>Türev Çözümü (d/dx)</span>';
      resultExpr.textContent = 'd/dx (' + norm.normalized + ')';
      const pointStr = (res.atPoint !== null && Number.isFinite(res.atPoint)) ? '  |  f\'(' + xPoint + ') = ' + Engine.formatNumber(res.atPoint) : '';
      resultValue.textContent = '= ' + res.text + pointStr;
      state.lastResultText = res.text;
      resultNote.textContent = state.appMode === 'both'
        ? 'Mavi çizgi f(x) fonksiyonunu, kırmızı kesikli çizgi f\'(x) türevini gösterir.'
        : 'Fonksiyonun sembolik türevi hesaplandı.';
    }

    const derivHistRaw = (res.atPoint !== null && Number.isFinite(res.atPoint))
      ? 'd/dx(' + norm.normalized + ') [x₀=' + xPoint + ']'
      : 'd/dx(' + norm.normalized + ')';
    const derivHistRes = (res.atPoint !== null && Number.isFinite(res.atPoint))
      ? '= ' + res.text + " | f'(" + xPoint + ') = ' + Engine.formatNumber(res.atPoint)
      : '= ' + res.text;
    state.history.unshift({ id: state.nextId++, raw: derivHistRaw, result: derivHistRes, kind: state.appMode === 'calc' ? 'calc' : 'graph' });
    if (state.history.length > 30) state.history.pop();
    renderLists(); redraw();
    if (window.lucide) window.lucide.createIcons();
  }

  function runIntegral(rawExpr, lowerVal, upperVal) {
    hideError();
    const cleaned = (rawExpr || '').trim();
    if (!cleaned) { showError('İntegral almak için bir fonksiyon yazın (örn: x^2).'); return; }
    let norm, ast;
    try {
      norm = Engine.normalizeTurkishMath(cleaned);
      ast = Engine.parseExpression(norm.normalized);
    } catch (err) { showError(err.message || 'İfade anlaşılamadı.'); return; }

    ensureParamsExist(ast);
    const hasBounds = lowerVal !== '' && upperVal !== '' && Number.isFinite(Number(lowerVal)) && Number.isFinite(Number(upperVal));
    Engine.callPythonApi('/api/integral', {
      expression: norm.normalized,
      lowerBound: hasBounds ? Number(lowerVal) : null,
      upperBound: hasBounds ? Number(upperVal) : null
    });

    const res = Engine.solveIntegral(ast, hasBounds ? Number(lowerVal) : null, hasBounds ? Number(upperVal) : null, state.angleUnit, state.variables);

    if (state.appMode === 'graph' || state.appMode === 'both') {
      state.graphs = [];
      addGraphItem({ raw: norm.normalized, normalized: norm.normalized, ast, hasX: true, hasTrig: false, simplePower: null, constVal: null, color: '#2563eb' }, false);
      if (hasBounds) {
        const a = Number(lowerVal), b = Number(upperVal);
        state.shadedIntegral = { ast, a, b };
        const pad = Math.max(3, Math.abs(b - a) * 0.8);
        state.view = { xMin: Math.min(a, b) - pad, xMax: Math.max(a, b) + pad, yMin: -4, yMax: 12 };
      } else {
        state.shadedIntegral = null;
        if (res.antiAst) {
          addGraphItem({ raw: 'F(x)', normalized: res.indefinite, ast: res.antiAst, hasX: true, hasTrig: false, simplePower: null, constVal: null, color: '#dc2626', dashed: true }, false);
        }
        state.view = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 };
      }
    }

    if (state.appMode !== 'graph') {
      resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
      resultModeBadge.innerHTML = '<i data-lucide="area-chart" class="w-3.5 h-3.5"></i><span>' + (hasBounds ? 'Belirli İntegral Alanı' : 'Belirsiz İntegral (∫)') + '</span>';
      if (hasBounds) {
        const areaStr = Engine.formatNumber(res.definite);
        resultExpr.textContent = '∫[' + lowerVal + ', ' + upperVal + '] (' + norm.normalized + ') dx';
        resultValue.textContent = '= ' + areaStr;
        state.lastResultText = areaStr;
        resultNote.textContent = (res.indefinite ? 'Belirsiz integral: ' + res.indefinite + '. ' : '') + '[' + lowerVal + ', ' + upperVal + '] aralığındaki net alan hesaplandı.';
      } else {
        const out = res.indefinite || ('∫(' + norm.normalized + ') dx');
        resultExpr.textContent = '∫ (' + norm.normalized + ') dx';
        resultValue.textContent = '= ' + out;
        state.lastResultText = out;
        resultNote.textContent = 'Belirli alan için alt (a) ve üst (b) sınır girebilirsin.';
      }
    }

    const intHistRaw = hasBounds
      ? '∫[' + lowerVal + ', ' + upperVal + '](' + norm.normalized + ')dx'
      : '∫(' + norm.normalized + ')dx';
    const intHistRes = res.definite !== null
      ? '= ' + Engine.formatNumber(res.definite)
      : '= ' + (res.indefinite || norm.normalized);
    state.history.unshift({ id: state.nextId++, raw: intHistRaw, result: intHistRes, kind: state.appMode === 'calc' ? 'calc' : 'graph' });
    if (state.history.length > 30) state.history.pop();
    renderLists(); redraw();
    if (window.lucide) window.lucide.createIcons();
  }

  function processSinglePart(part, options) {
    const { recordHistory = true, isInitial = false, isMulti = false } = options;

    // 1. Degisken atamasi (a = 5) veya dikey dogru (x = a) kontrolu
    const assign = Engine.parseAssignment(part);
    if (assign && assign.kind === 'assign') {
      const norm = Engine.normalizeTurkishMath(assign.expr);
      const ast = Engine.parseExpression(norm.normalized);
      ensureParamsExist(ast);
      const val = Engine.evaluateAST(ast, 0, state.angleUnit, state.variables);
      if (!Number.isFinite(val)) throw new Error('Geçersiz değişken değeri.');
      state.variables[assign.name] = Math.round(val * 1e6) / 1e6;
      renderVariables();
      if (state.appMode !== 'graph') {
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="sliders" class="w-3.5 h-3.5"></i><span>Değişken Atandı</span>';
        resultExpr.textContent = assign.name + ' = ' + norm.normalized;
        resultValue.textContent = assign.name + ' = ' + Engine.formatNumber(val);
        resultNote.textContent = '"' + assign.name + '" değişkeni kaydedildi. Artık x = ' + assign.name + ' veya ' + assign.name + '*x^2 yazabilirsin.';
        state.lastResultText = String(state.variables[assign.name]);
      }
      if (recordHistory) state.history.unshift({ id: state.nextId++, raw: part, result: assign.name + ' = ' + Engine.formatNumber(val), kind: 'calc' });
      return null;
    }

    if (assign && assign.kind === 'vertical') {
      const norm = Engine.normalizeTurkishMath(assign.expr);
      const ast = Engine.parseExpression(norm.normalized);
      ensureParamsExist(ast);
      const val = Engine.evaluateAST(ast, 0, state.angleUnit, state.variables);
      if (state.appMode !== 'calc') {
        const gItem = addGraphItem({
          raw: part, normalized: 'x = ' + norm.normalized, ast, kind: 'vertical',
          hasX: true, hasTrig: false, simplePower: null, constVal: null, isInitial
        }, !isInitial && !isMulti);
        if (isInitial) gItem.isInitial = true;
      }
      if (state.appMode !== 'graph') {
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-red-600/15 text-red-500 border border-red-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="minus" class="w-3.5 h-3.5"></i><span>Dikey Doğru (x = sabit)</span>';
        resultExpr.textContent = 'x = ' + norm.normalized;
        resultValue.textContent = 'x = ' + Engine.formatNumber(val);
        resultNote.textContent = 'X-Y düzleminde x = ' + Engine.formatNumber(val) + ' dikey doğrusu çizildi.';
        state.lastResultText = Engine.formatNumber(val);
      }
      if (recordHistory) state.history.unshift({ id: state.nextId++, raw: part, result: 'x = ' + Engine.formatNumber(val), kind: 'graph' });
      return null;
    }

    // 2. Aralik (<, >, <=, >=) ayiklama
    const { exprWithoutDomain, domain } = Engine.extractDomain(part, state.variables);

    // Sadece aralik bolgesi (orn: "x > 2" veya "-2 < x < 5")
    if (!exprWithoutDomain && domain) {
      if (state.appMode !== 'calc') {
        const gItem = addGraphItem({
          raw: part, normalized: domain.label, ast: null, kind: 'region', domain,
          hasX: true, hasTrig: false, simplePower: null, constVal: null, isInitial
        }, !isInitial && !isMulti);
        if (isInitial) gItem.isInitial = true;
      }
      if (state.appMode !== 'graph') {
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="columns" class="w-3.5 h-3.5"></i><span>Aralık Bölgesi</span>';
        resultExpr.textContent = domain.label;
        resultValue.textContent = domain.label;
        resultNote.textContent = 'Belirtilen x aralığı grafik üzerinde tarandı.';
      }
      if (recordHistory) state.history.unshift({ id: state.nextId++, raw: part, result: domain.label, kind: 'graph' });
      return null;
    }

    const norm = Engine.normalizeTurkishMath(exprWithoutDomain);
    if (norm.calculusMode === 'derivative') { runDerivative(norm.normalized, derivPointInput.value); return 'handled'; }
    if (norm.calculusMode === 'integral') { runIntegral(norm.normalized, intLowerInput.value, intUpperInput.value); return 'handled'; }

    const parsed = Engine.parseExpression(norm.normalized);
    ensureParamsExist(parsed);

    const forceGraph = state.appMode === 'graph' || state.appMode === 'both';
    Engine.callPythonApi('/api/hesapla', { expression: part, angleUnit: state.angleUnit, forceGraph, variables: state.variables });

    const meta = Engine.analyzeAST(parsed, state.variables);
    let constVal = null;
    if (!meta.hasX) {
      constVal = Engine.evaluateAST(parsed, 0, state.angleUnit, state.variables);
      if (!Number.isFinite(constVal)) throw new Error('İşlem sonucu tanımsız (örneğin sıfıra bölme).');
    }

    if (state.appMode === 'calc') {
      if (meta.hasX) {
        const atOne = Engine.evaluateAST(parsed, 1, state.angleUnit, state.variables);
        state.lastResultText = 'f(1) = ' + Engine.formatNumber(atOne);
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="calculator" class="w-3.5 h-3.5"></i><span>Fonksiyon Hesabı</span>';
        resultExpr.textContent = 'f(x) = ' + norm.normalized;
        resultValue.textContent = 'f(1) = ' + Engine.formatNumber(atOne);
        resultNote.textContent = 'x değişkenli ifade için x = 1 değeri hesaplandı.';
      } else {
        const formatted = Engine.formatNumber(constVal);
        state.lastResultText = formatted;
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="calculator" class="w-3.5 h-3.5"></i><span>Sadece Hesaplama</span>';
        resultExpr.textContent = norm.normalized;
        resultValue.textContent = '= ' + formatted;
        resultNote.textContent = 'İşlem sonucu grafik çizilmeden hesaplandı.';
      }
      if (recordHistory) state.history.unshift({ id: state.nextId++, raw: part, result: resultValue.textContent, kind: 'calc' });
      return null;
    }

    const graphItem = addGraphItem({
      raw: part, normalized: norm.normalized, ast: parsed, domain, kind: 'curve',
      hasX: meta.hasX, hasTrig: meta.hasTrig, simplePower: meta.simplePower, constVal, isInitial
    }, !isInitial && !isMulti);
    if (isInitial) graphItem.isInitial = true;

    if (state.appMode === 'both') {
      const domSuffix = domain ? '  [' + domain.label + ']' : '';
      if (meta.simplePower) {
        const formatted = Engine.formatNumber(constVal);
        state.lastResultText = formatted;
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i><span>Hesap + X-Y Grafik</span>';
        resultExpr.textContent = norm.normalized + domSuffix;
        resultValue.textContent = '= ' + formatted;
        resultNote.textContent = 'y = ' + formatted + ' doğrusu ve (' + meta.simplePower.exp + ', ' + formatted + ') noktası çizildi.';
      } else if (!meta.hasX) {
        const formatted = Engine.formatNumber(constVal);
        state.lastResultText = formatted;
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-600/15 text-blue-500 border border-blue-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i><span>Hesap + X-Y Grafik</span>';
        resultExpr.textContent = norm.normalized + domSuffix;
        resultValue.textContent = '= ' + formatted;
        resultNote.textContent = 'Sonuç hesaplandı ve y = ' + formatted + ' doğrusu çizildi.';
      } else {
        state.lastResultText = 'y = ' + norm.normalized;
        resultModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-red-600/15 text-red-500 border border-red-600/30';
        resultModeBadge.innerHTML = '<i data-lucide="activity" class="w-3.5 h-3.5"></i><span>Fonksiyon Grafiği</span>';
        resultExpr.textContent = part;
        resultValue.textContent = 'y = ' + norm.normalized;
        resultNote.textContent = domain ? 'Grafik sadece ' + domain.label + ' aralığında çizildi.' : 'Fonksiyon X-Y düzleminde çizildi.';
      }
    }

    if (recordHistory) {
      state.history.unshift({ id: state.nextId++, raw: part, result: constVal !== null ? '= ' + Engine.formatNumber(constVal) : 'y = ' + norm.normalized, kind: 'graph' });
    }
    return graphItem;
  }

  function processExpression(rawInput, options = {}) {
    const { recordHistory = true, isInitial = false } = options;
    hideError();
    const trimmed = (rawInput || '').trim();
    if (!trimmed) { showError('Lütfen bir işlem veya fonksiyon yazın.'); return; }

    state.shadedIntegral = null;
    const parts = Engine.splitMultiExpressions(trimmed);
    const isMulti = parts.length > 1;
    let lastGraph = null;

    try {
      for (let i = 0; i < parts.length; i++) {
        const res = processSinglePart(parts[i], { recordHistory, isInitial, isMulti });
        if (res === 'handled') return;
        if (res) lastGraph = res;
      }
    } catch (err) {
      showError(err.message || 'İfade anlaşılamadı.');
      return;
    }

    if (state.history.length > 30) state.history.length = 30;
    if (lastGraph && !isMulti) autoFitViewForItem(lastGraph);
    else if (isMulti && state.appMode !== 'calc') state.view = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 };

    renderLists(); redraw();
    if (window.lucide) window.lucide.createIcons();
  }
  // Yukaridaki processExpression fonksiyonu; virgul veya boslukla yazilan coklu ifadeleri,
  // aralikli (<, >) grafikleri ve degisken atamalarini (a = 5, x = a) tek seferde isler.

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderLists() {
    graphCount.textContent = state.graphs.length;
    historyCount.textContent = state.history.length;
    panelGraphs.innerHTML = state.graphs.length === 0
      ? '<p class="text-xs opacity-60 text-center py-3">Henüz aktif grafik yok.</p>'
      : state.graphs.map(g => {
          const baseLbl = g.kind === 'vertical' || g.kind === 'region'
            ? g.normalized
            : (g.constVal !== null ? 'y = ' + g.normalized + ' (' + Engine.formatNumber(g.constVal) + ')' : 'y = ' + g.normalized);
          const domLbl = (g.domain && g.kind !== 'region') ? ' [' + g.domain.label + ']' : '';
          return '<div class="flex items-center justify-between gap-2 p-2 rounded-xl soft-surface">' +
            '<button type="button" data-toggle-graph="' + g.id + '" class="flex items-center gap-2 min-w-0 flex-1 text-left">' +
            '<span class="w-3 h-3 rounded-full shrink-0 border-2" style="background:' + (g.visible ? g.color : 'transparent') + '; border-color:' + g.color + ';"></span>' +
            '<span class="text-xs font-mono-math font-medium truncate ' + (g.visible ? '' : 'opacity-40 line-through') + '">' + escapeHtml(baseLbl + domLbl) + '</span>' +
            '</button>' +
            '<button type="button" data-remove-graph="' + g.id + '" class="p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-red-500 transition-colors" title="Kaldır">' +
            '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div>';
        }).join('');

    historyListWrap.innerHTML = state.history.length === 0
      ? '<p class="text-xs opacity-60 text-center py-3">Yaptığınız işlemler burada listelenir.</p>'
      : state.history.map(h =>
          '<button type="button" data-load-history="' + escapeHtml(h.raw) + '" class="w-full flex items-center justify-between gap-2 p-2 rounded-xl soft-surface hover:border-blue-500 transition-colors text-left">' +
          '<div class="min-w-0"><div class="text-xs font-mono-math truncate">' + escapeHtml(h.raw) + '</div>' +
          '<div class="text-[11px] font-mono-math font-semibold ' + (h.kind === 'calc' ? 'text-blue-500' : 'text-red-500') + ' truncate">' + escapeHtml(h.result) + '</div></div>' +
          '<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ' + (h.kind === 'calc' ? 'bg-blue-600/15 text-blue-500' : 'bg-red-600/15 text-red-500') + '">' + (h.kind === 'calc' ? 'İşlem' : 'Grafik') + '</span></button>'
        ).join('');
  }

  function switchBottomTab(tab) {
    if (tab === 'graphs') {
      tabGraphs.className = 'flex-1 py-2 text-xs font-bold text-blue-500 border-b-2 border-blue-600 transition-colors';
      tabHistory.className = 'flex-1 py-2 text-xs font-semibold opacity-65 hover:opacity-100 border-b-2 border-transparent transition-colors';
      panelGraphs.classList.remove('hidden'); panelHistory.classList.add('hidden');
    } else {
      tabHistory.className = 'flex-1 py-2 text-xs font-bold text-blue-500 border-b-2 border-blue-600 transition-colors';
      tabGraphs.className = 'flex-1 py-2 text-xs font-semibold opacity-65 hover:opacity-100 border-b-2 border-transparent transition-colors';
      panelHistory.classList.remove('hidden'); panelGraphs.classList.add('hidden');
    }
  }

  function zoomAt(factor, cx, cy) {
    const v = state.view;
    v.xMin = cx - (cx - v.xMin) * factor;
    v.xMax = cx + (v.xMax - cx) * factor;
    v.yMin = cy - (cy - v.yMin) * factor;
    v.yMax = cy + (v.yMax - cy) * factor;
    redraw();
  }

  function switchPadMode(mode) {
    state.padMode = mode;
    document.querySelectorAll('[data-pad-tab]').forEach(btn => {
      const active = btn.getAttribute('data-pad-tab') === mode;
      btn.className = active
        ? 'flex-1 py-1.5 sm:py-2 px-1.5 rounded-lg sm:rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm transition-all'
        : 'flex-1 py-1.5 sm:py-2 px-1.5 rounded-lg sm:rounded-xl text-xs font-semibold opacity-70 hover:opacity-100 transition-all';
    });
    document.querySelectorAll('[data-pad-panel]').forEach(panel => {
      panel.classList.toggle('hidden', panel.getAttribute('data-pad-panel') !== mode);
    });
  }

  // Degisken kutularinda canli duzenleme ve silme
  variablesList.addEventListener('input', e => {
    const inp = e.target.closest('[data-var-input]');
    if (inp) {
      const name = inp.getAttribute('data-var-input');
      const val = Number(inp.value);
      if (Number.isFinite(val)) {
        state.variables[name] = val;
        redraw();
      }
    }
  });
  variablesList.addEventListener('click', e => {
    const rm = e.target.closest('[data-remove-var]');
    if (rm) {
      delete state.variables[rm.getAttribute('data-remove-var')];
      renderVariables();
      redraw();
    }
  });

  // Islem gecmisini sil
  btnClearHistory.addEventListener('click', () => {
    state.history = [];
    renderLists();
  });

  // Tumunu sil (grafikler, gecmis, degiskenler, giris kutusu ve sonuc)
  btnClearAll.addEventListener('click', () => {
    exprInput.value = '';
    derivPointInput.value = '';
    intLowerInput.value = '';
    intUpperInput.value = '';
    state.graphs = [];
    state.history = [];
    state.variables = {};
    state.shadedIntegral = null;
    state.view = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 };
    resultExpr.textContent = '—';
    resultValue.textContent = '= 0';
    resultNote.textContent = 'Tüm grafikler, değişkenler ve işlem geçmişi temizlendi.';
    hideError();
    renderVariables();
    renderLists();
    redraw();
    if (window.lucide) window.lucide.createIcons();
  });
  // Yukaridaki btnClearHistory ve btnClearAll butonlari; sadece gecmisi veya tum
  // calisma alanini (grafikler + degiskenler + gecmis) tek tikla temizler.

  btnToggleKeypad.addEventListener('click', () => {
    state.keypadOpenMobile = !state.keypadOpenMobile;
    keypadContainer.classList.toggle('hidden', !state.keypadOpenMobile);
    btnToggleKeypad.textContent = state.keypadOpenMobile ? 'Tuşları Gizle' : 'Tuşları Göster';
  });

  document.querySelectorAll('[data-select-mode]').forEach(el => el.addEventListener('click', () => setAppMode(el.getAttribute('data-select-mode'))));
  document.querySelectorAll('[data-nav-mode]').forEach(el => el.addEventListener('click', () => setAppMode(el.getAttribute('data-nav-mode'))));
  document.getElementById('btnGoHome').addEventListener('click', () => setAppMode('home'));
  document.querySelectorAll('[data-pad-tab]').forEach(btn => btn.addEventListener('click', () => switchPadMode(btn.getAttribute('data-pad-tab'))));

  btnSolveDeriv.addEventListener('click', () => runDerivative(exprInput.value, derivPointInput.value));
  btnSolveInt.addEventListener('click', () => runIntegral(exprInput.value, intLowerInput.value, intUpperInput.value));
  exprForm.addEventListener('submit', e => { e.preventDefault(); processExpression(exprInput.value, { recordHistory: true }); });
  btnClearInput.addEventListener('click', () => { exprInput.value = ''; hideError(); exprInput.focus(); });

  document.querySelectorAll('.example-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      exprInput.value = btn.getAttribute('data-example');
      processExpression(exprInput.value, { recordHistory: true });
    });
  });

  document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ins = btn.getAttribute('data-insert');
      const act = btn.getAttribute('data-action');
      if (ins !== null) { insertAtCursor(ins); }
      else if (act === 'clear') { exprInput.value = ''; hideError(); exprInput.focus(); }
      else if (act === 'backspace') {
        const s = exprInput.selectionStart ?? exprInput.value.length;
        const e = exprInput.selectionEnd ?? exprInput.value.length;
        if (s !== e) { exprInput.value = exprInput.value.slice(0, s) + exprInput.value.slice(e); exprInput.setSelectionRange(s, s); }
        else if (s > 0) { exprInput.value = exprInput.value.slice(0, s - 1) + exprInput.value.slice(s); exprInput.setSelectionRange(s - 1, s - 1); }
        exprInput.focus();
      } else if (act === 'equals') { processExpression(exprInput.value, { recordHistory: true }); }
    });
  });

  btnCopyResult.addEventListener('click', () => {
    const text = state.lastResultText || '';
    const done = () => { copyLabel.textContent = 'Kopyalandı'; setTimeout(() => { copyLabel.textContent = 'Kopyala'; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  });
  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta); cb();
  }

  function setAngleUnit(unit) {
    state.angleUnit = unit;
    btnDeg.className = unit === 'DEG' ? 'px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg bg-blue-600 text-white' : 'px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg opacity-70 hover:opacity-100';
    btnRad.className = unit === 'RAD' ? 'px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg bg-blue-600 text-white' : 'px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg opacity-70 hover:opacity-100';
    angleUnitPill.textContent = unit === 'DEG' ? 'DEG' : 'RAD';
    const trig = state.graphs.find(g => g.visible && g.hasTrig);
    if (trig) autoFitViewForItem(trig);
    redraw();
  }
  btnDeg.addEventListener('click', () => setAngleUnit('DEG'));
  btnRad.addEventListener('click', () => setAngleUnit('RAD'));

  btnTheme.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('theme-light', state.theme === 'light');
    themeIcon.setAttribute('data-lucide', state.theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
    redraw();
  });

  btnToggleRef.addEventListener('click', () => {
    state.showRefCurve = !state.showRefCurve;
    btnToggleRef.textContent = state.showRefCurve ? 'Referans Eğri: Açık' : 'Referans Eğri: Kapalı';
    redraw();
  });

  btnZoomIn.addEventListener('click', () => zoomAt(0.75, (state.view.xMin + state.view.xMax) / 2, (state.view.yMin + state.view.yMax) / 2));
  btnZoomOut.addEventListener('click', () => zoomAt(1.35, (state.view.xMin + state.view.xMax) / 2, (state.view.yMin + state.view.yMax) / 2));
  btnResetView.addEventListener('click', () => {
    const last = [...state.graphs].reverse().find(g => g.visible);
    if (last) autoFitViewForItem(last);
    else state.view = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 };
    redraw();
  });
  btnClearGraphs.addEventListener('click', () => { state.graphs = []; state.shadedIntegral = null; renderLists(); redraw(); if (window.lucide) window.lucide.createIcons(); });

  tabGraphs.addEventListener('click', () => switchBottomTab('graphs'));
  tabHistory.addEventListener('click', () => switchBottomTab('history'));

  panelGraphs.addEventListener('click', e => {
    const tg = e.target.closest('[data-toggle-graph]');
    if (tg) {
      const g = state.graphs.find(i => i.id === Number(tg.getAttribute('data-toggle-graph')));
      if (g) { g.visible = !g.visible; renderLists(); redraw(); if (window.lucide) window.lucide.createIcons(); }
      return;
    }
    const rm = e.target.closest('[data-remove-graph]');
    if (rm) {
      state.graphs = state.graphs.filter(i => i.id !== Number(rm.getAttribute('data-remove-graph')));
      renderLists(); redraw(); if (window.lucide) window.lucide.createIcons();
    }
  });

  historyListWrap.addEventListener('click', e => {
    const btn = e.target.closest('[data-load-history]');
    if (btn) { exprInput.value = btn.getAttribute('data-load-history'); processExpression(exprInput.value, { recordHistory: false }); }
  });

  // Coklu dokunma (Pinch-to-Zoom) + Surukleme
  function getPinchMetrics(rect) {
    const pts = Array.from(activePointers.values());
    const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
    return { dist, midPx: (pts[0].x + pts[1].x) / 2 - rect.left, midPy: (pts[0].y + pts[1].y) / 2 - rect.top };
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = canvas.getBoundingClientRect();
    if (activePointers.size === 2) {
      state.dragging = false;
      const m = getPinchMetrics(r);
      const midWorld = Renderer.screenToWorld(state.view, m.midPx, m.midPy, r.width, r.height);
      pinchStart = { dist: m.dist, midPx: m.midPx, midPy: m.midPy, midWx: midWorld.wx, midWy: midWorld.wy, view: { ...state.view } };
    } else if (activePointers.size === 1) {
      pinchStart = null; state.dragging = true; canvas.classList.add('grabbing');
      state.dragStart = { px: e.clientX - r.left, py: e.clientY - r.top, ...state.view };
    }
  });

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2 && pinchStart) {
      const m = getPinchMetrics(r);
      const scale = pinchStart.dist / m.dist;
      const baseV = pinchStart.view;
      const newXRange = (baseV.xMax - baseV.xMin) * scale;
      const newYRange = (baseV.yMax - baseV.yMin) * scale;
      state.view.xMin = pinchStart.midWx - (m.midPx / r.width) * newXRange;
      state.view.xMax = state.view.xMin + newXRange;
      state.view.yMin = pinchStart.midWy - ((r.height - m.midPy) / r.height) * newYRange;
      state.view.yMax = state.view.yMin + newYRange;
      redraw();
      return;
    }
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (state.dragging && activePointers.size === 1) {
      const dxW = ((px - state.dragStart.px) / r.width) * (state.dragStart.xMax - state.dragStart.xMin);
      const dyW = ((py - state.dragStart.py) / r.height) * (state.dragStart.yMax - state.dragStart.yMin);
      state.view.xMin = state.dragStart.xMin - dxW; state.view.xMax = state.dragStart.xMax - dxW;
      state.view.yMin = state.dragStart.yMin + dyW; state.view.yMax = state.dragStart.yMax + dyW;
      redraw();
    } else if (!state.dragging) {
      const wld = Renderer.screenToWorld(state.view, px, py, r.width, r.height);
      state.pointer = { active: true, px, py, wx: wld.wx, wy: wld.wy };
      redraw();
    }
  });

  function handlePointerEnd(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchStart = null;
    if (activePointers.size === 1) {
      const rem = Array.from(activePointers.values())[0];
      const r = canvas.getBoundingClientRect();
      state.dragging = true;
      state.dragStart = { px: rem.x - r.left, py: rem.y - r.top, ...state.view };
    } else {
      state.dragging = false; canvas.classList.remove('grabbing');
    }
  }
  canvas.addEventListener('pointerup', handlePointerEnd);
  canvas.addEventListener('pointercancel', handlePointerEnd);
  canvas.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse') { activePointers.delete(e.pointerId); state.dragging = false; canvas.classList.remove('grabbing'); state.pointer.active = false; redraw(); }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const { wx, wy } = Renderer.screenToWorld(state.view, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    zoomAt(e.deltaY < 0 ? 0.85 : 1.18, wx, wy);
  }, { passive: false });

  btnHelp.addEventListener('click', () => helpModal.classList.remove('hidden'));
  btnCloseHelp.addEventListener('click', () => helpModal.classList.add('hidden'));
  helpModal.addEventListener('click', e => { if (e.target === helpModal) helpModal.classList.add('hidden'); });
  window.addEventListener('resize', resizeCanvas);

  window.addEventListener('load', () => {
    if (window.lucide) window.lucide.createIcons();
    setAppMode('home');
  });
})();
