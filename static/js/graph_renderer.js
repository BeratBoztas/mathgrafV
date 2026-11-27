(function (global) {
  'use strict';

  function worldToScreen(view, wx, wy, w, h) {
    return {
      sx: ((wx - view.xMin) / (view.xMax - view.xMin)) * w,
      sy: h - ((wy - view.yMin) / (view.yMax - view.yMin)) * h
    };
  }

  function screenToWorld(view, sx, sy, w, h) {
    return {
      wx: view.xMin + (sx / w) * (view.xMax - view.xMin),
      wy: view.yMin + ((h - sy) / h) * (view.yMax - view.yMin)
    };
  }

  function niceStep(range, maxTicks) {
    const rough = range / maxTicks;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    const frac = rough / pow10;
    const nice = frac <= 1.5 ? 1 : frac <= 3 ? 2 : frac <= 7 ? 5 : 10;
    return nice * pow10;
  }

  function inDomain(wx, domain) {
    if (!domain) return true;
    if (domain.min !== null) {
      if (domain.minInc ? wx < domain.min : wx <= domain.min) return false;
    }
    if (domain.max !== null) {
      if (domain.maxInc ? wx > domain.max : wx >= domain.max) return false;
    }
    return true;
  }
  // Yukaridaki inDomain fonksiyonu, verilen x noktasinin < veya > ile belirtilen aralikta
  // olup olmadigini kontrol eder.

  function drawGraph(canvas, ctx, container, state, coordBadge) {
    const Engine = global.MatGrafEngine;
    const rect = container.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w <= 0 || h <= 0) return;

    const isDark = state.theme === 'dark';
    const view = state.view;
    const xRange = view.xMax - view.xMin;
    const yRange = view.yMax - view.yMin;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#050507' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const xStep = niceStep(xRange, Math.max(5, Math.floor(w / 85)));
    const yStep = niceStep(yRange, Math.max(5, Math.floor(h / 72)));

    // Kucuk izgara
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(view.xMin / (xStep / 2)) * (xStep / 2); x <= view.xMax; x += xStep / 2) {
      const { sx } = worldToScreen(view, x, 0, w, h); ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = Math.floor(view.yMin / (yStep / 2)) * (yStep / 2); y <= view.yMax; y += yStep / 2) {
      const { sy } = worldToScreen(view, 0, y, w, h); ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // Ana izgara
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.13)' : 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    for (let x = Math.floor(view.xMin / xStep) * xStep; x <= view.xMax; x += xStep) {
      const { sx } = worldToScreen(view, x, 0, w, h); ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = Math.floor(view.yMin / yStep) * yStep; y <= view.yMax; y += yStep) {
      const { sy } = worldToScreen(view, 0, y, w, h); ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // X ve Y eksenleri
    const origin = worldToScreen(view, 0, 0, w, h);
    const axisY = Math.max(0, Math.min(h, origin.sy));
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (origin.sy >= 0 && origin.sy <= h) { ctx.moveTo(0, origin.sy); ctx.lineTo(w, origin.sy); }
    if (origin.sx >= 0 && origin.sx <= w) { ctx.moveTo(origin.sx, 0); ctx.lineTo(origin.sx, h); }
    ctx.stroke();

    // Eksen sayilari
    ctx.fillStyle = isDark ? '#d4d4d4' : '#404040';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xLabelY = origin.sy >= 10 && origin.sy <= h - 22 ? origin.sy + 6 : h - 16;
    for (let x = Math.floor(view.xMin / xStep) * xStep; x <= view.xMax; x += xStep) {
      if (Math.abs(x) < xStep * 1e-6) continue;
      const { sx } = worldToScreen(view, x, 0, w, h);
      if (sx > 22 && sx < w - 22) ctx.fillText(String(Math.round(x * 1e6) / 1e6), sx, xLabelY);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yLabelX = origin.sx >= 36 && origin.sx <= w - 10 ? origin.sx - 7 : 34;
    for (let y = Math.floor(view.yMin / yStep) * yStep; y <= view.yMax; y += yStep) {
      if (Math.abs(y) < yStep * 1e-6) continue;
      const { sy } = worldToScreen(view, 0, y, w, h);
      if (sy > 16 && sy < h - 16) ctx.fillText(String(Math.round(y * 1e6) / 1e6), yLabelX, sy);
    }

    // Belirli integral alan taramasi
    if (state.shadedIntegral && state.shadedIntegral.ast) {
      const si = state.shadedIntegral;
      const a = Math.min(si.a, si.b), b = Math.max(si.a, si.b);
      const steps = 220;
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.28)' : 'rgba(37, 99, 235, 0.2)';
      ctx.beginPath();
      const startPt = worldToScreen(view, a, 0, w, h);
      ctx.moveTo(startPt.sx, startPt.sy);
      for (let i = 0; i <= steps; i++) {
        const wx = a + (i / steps) * (b - a);
        const wy = Engine.evaluateAST(si.ast, wx, state.angleUnit, state.variables);
        if (Number.isFinite(wy)) {
          const pt = worldToScreen(view, wx, wy, w, h);
          ctx.lineTo(pt.sx, pt.sy);
        }
      }
      const endPt = worldToScreen(view, b, 0, w, h);
      ctx.lineTo(endPt.sx, endPt.sy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Tum aktif grafikleri ciz
    const samples = Math.min(1800, Math.max(600, Math.floor(w * 2)));
    state.graphs.forEach(g => {
      if (!g.visible) return;
      const drawColor = (g.color === '#ffffff' && !isDark) ? '#000000' : g.color;

      // 1. Sadece x araligi bolgesi (orn: "x > 2" veya "-2 < x < 5")
      if (g.kind === 'region' && g.domain) {
        const minX = g.domain.min !== null ? g.domain.min : view.xMin;
        const maxX = g.domain.max !== null ? g.domain.max : view.xMax;
        const leftPx = worldToScreen(view, Math.max(minX, view.xMin), 0, w, h).sx;
        const rightPx = worldToScreen(view, Math.min(maxX, view.xMax), 0, w, h).sx;
        if (rightPx > leftPx) {
          ctx.save();
          ctx.fillStyle = drawColor;
          ctx.globalAlpha = isDark ? 0.18 : 0.14;
          ctx.fillRect(leftPx, 0, rightPx - leftPx, h);
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = 2.2;
          if (g.domain.min !== null) {
            ctx.setLineDash(g.domain.minInc ? [] : [6, 5]);
            const lx = worldToScreen(view, g.domain.min, 0, w, h).sx;
            ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, h); ctx.stroke();
          }
          if (g.domain.max !== null) {
            ctx.setLineDash(g.domain.maxInc ? [] : [6, 5]);
            const rx = worldToScreen(view, g.domain.max, 0, w, h).sx;
            ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, h); ctx.stroke();
          }
          ctx.restore();
        }
        return;
      }

      // 2. Dikey dogru (orn: "x = a" veya "x = 3")
      if (g.kind === 'vertical' && g.ast) {
        const xVal = Engine.evaluateAST(g.ast, 0, state.angleUnit, state.variables);
        if (Number.isFinite(xVal)) {
          const { sx } = worldToScreen(view, xVal, 0, w, h);
          if (sx >= -10 && sx <= w + 10) {
            ctx.save();
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = 2.8;
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
            const tag = 'x = ' + Engine.formatNumber(xVal);
            ctx.font = '600 11px JetBrains Mono, monospace';
            const tw = ctx.measureText(tag).width + 12;
            const bx = Math.min(w - tw - 6, Math.max(6, sx + 6));
            ctx.fillStyle = drawColor;
            ctx.beginPath(); ctx.roundRect(bx, 12, tw, 22, 6); ctx.fill();
            ctx.fillStyle = drawColor === '#ffffff' ? '#000000' : '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(tag, bx + 6, 23);
            ctx.restore();
          }
        }
        return;
      }

      // 3. Uslu sabitlerde referans a^x egrisi
      if (g.simplePower && state.showRefCurve) {
        ctx.save();
        ctx.strokeStyle = drawColor; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= samples; i++) {
          const wx = view.xMin + (i / samples) * xRange;
          const wy = Math.pow(g.simplePower.base, wx);
          if (!Number.isFinite(wy) || wy > view.yMax + yRange * 2 || wy < view.yMin - yRange * 2) { started = false; continue; }
          const { sx, sy } = worldToScreen(view, wx, wy, w, h);
          if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
        }
        ctx.stroke(); ctx.restore();
      }

      // 4. Normal veya aralikli (<, >) fonksiyon egrisi
      ctx.save();
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = g.dashed ? 2.2 : 2.8;
      if (g.dashed) ctx.setLineDash([7, 5]);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let prevSy = null, prevWy = null, started = false;
      for (let i = 0; i <= samples; i++) {
        const wx = view.xMin + (i / samples) * xRange;
        if (!inDomain(wx, g.domain)) { started = false; prevSy = null; prevWy = null; continue; }
        const wy = Engine.evaluateAST(g.ast, wx, state.angleUnit, state.variables);
        if (!Number.isFinite(wy)) { started = false; prevSy = null; prevWy = null; continue; }
        const { sx, sy } = worldToScreen(view, wx, wy, w, h);
        if (prevSy !== null && prevWy !== null) {
          const signFlip = (prevWy > 0 && wy < 0) || (prevWy < 0 && wy > 0);
          if (Math.abs(sy - prevSy) > h * 0.55 || (signFlip && Math.abs(wy - prevWy) > yRange * 0.8)) started = false;
        }
        if (sy < -h * 3 || sy > h * 4) { started = false; prevSy = sy; prevWy = wy; continue; }
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
        prevSy = sy; prevWy = wy;
      }
      ctx.stroke(); ctx.restore();

      // Aralik uc noktalarini ciz (<= dahilse dolu daire, < haricse ici bos daire)
      if (g.domain) {
        [
          { bx: g.domain.min, inc: g.domain.minInc },
          { bx: g.domain.max, inc: g.domain.maxInc }
        ].forEach(end => {
          if (end.bx === null) return;
          const by = Engine.evaluateAST(g.ast, end.bx, state.angleUnit, state.variables);
          if (!Number.isFinite(by)) return;
          const pt = worldToScreen(view, end.bx, by, w, h);
          if (pt.sx >= -10 && pt.sx <= w + 10 && pt.sy >= -10 && pt.sy <= h + 10) {
            ctx.save();
            ctx.fillStyle = end.inc ? drawColor : (isDark ? '#050507' : '#ffffff');
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(pt.sx, pt.sy, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.restore();
          }
        });
      }

      if (g.simplePower) {
        const pt = worldToScreen(view, g.simplePower.exp, g.constVal, w, h);
        if (pt.sx >= -10 && pt.sx <= w + 10 && pt.sy >= -10 && pt.sy <= h + 10) {
          ctx.save();
          ctx.strokeStyle = drawColor; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.3; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(pt.sx, pt.sy); ctx.lineTo(pt.sx, axisY); ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.fillStyle = isDark ? '#000000' : '#ffffff';
          ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(pt.sx, pt.sy, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

          const tag = '(' + g.simplePower.exp + ', ' + Engine.formatNumber(g.constVal) + ')';
          ctx.font = '600 12px JetBrains Mono, monospace';
          const tw = ctx.measureText(tag).width + 16;
          const bx = Math.min(w - tw - 8, Math.max(8, pt.sx + 10));
          const by = Math.max(10, pt.sy - 32);
          ctx.fillStyle = '#dc2626';
          ctx.beginPath(); ctx.roundRect(bx, by, tw, 24, 8); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(tag, bx + 8, by + 12);
          ctx.restore();
        }
      }
    });

    // Imlec takibi
    if (state.pointer.active && !state.dragging) {
      const { px, py, wx } = state.pointer;
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
      ctx.restore();

      const first = state.graphs.find(g => g.visible && g.ast && g.kind !== 'vertical' && g.kind !== 'region');
      if (first && inDomain(wx, first.domain)) {
        const fy = Engine.evaluateAST(first.ast, wx, state.angleUnit, state.variables);
        if (Number.isFinite(fy)) {
          const pt = worldToScreen(view, wx, fy, w, h);
          if (pt.sy >= 0 && pt.sy <= h) {
            ctx.save();
            ctx.fillStyle = '#2563eb'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(pt.sx, pt.sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.restore();
            coordBadge.innerHTML = '<span>x: ' + wx.toFixed(2) + '</span><span class="opacity-50">|</span><span class="text-blue-400">f(x): ' + fy.toFixed(2) + '</span>';
            return;
          }
        }
      }
      coordBadge.innerHTML = '<span>x: ' + wx.toFixed(2) + '</span><span class="opacity-50">|</span><span>y: ' + state.pointer.wy.toFixed(2) + '</span>';
    }
  }
  // Yukaridaki drawGraph fonksiyonu; aralikli (<, >) egrileri, uc nokta dairelerini,
  // dikey x=a dogrularini, esitsizlik bolgelerini ve integral alanlarini tuvale cizer.

  global.MatGrafRenderer = { worldToScreen, screenToWorld, drawGraph };
})(window);
