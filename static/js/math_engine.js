(function (global) {
  'use strict';

  const FUNCS = new Set([
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan',
    'sqrt', 'cbrt', 'abs', 'ln', 'log', 'exp',
    'sinh', 'cosh', 'tanh', 'floor', 'ceil'
  ]);

  const TRIG_FUNCS = new Set([
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan'
  ]);

  const TURKISH_WORDS = /\b(üzeri|uzeri|üssü|ussu|kuvveti|karesi|küpü|kupu|karekök|karekok|kök|kok|artı|arti|topla|eksi|çıkar|cikar|çarpı|carpi|kere|defa|bölü|bolu|grafiği|grafigi|grafiğini|grafigini|grafik|çiz|ciz|göster|goster|hesapla|kaçtır|kactir|nedir)\b/i;
  // Yukaridaki sabitler izin verilen fonksiyonlari ve Turkce anahtar kelimeleri tanimlar.

  function splitMultiExpressions(raw) {
    const text = (raw || '').trim();
    if (!text) return [];

    // 1. Parantez/suslu parantez disindaki virgul ve noktali virgullerden bol (3,5 ondaligini bozma)
    const commaParts = [];
    let cur = '', depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);

      const isDecimalComma = ch === ',' && i > 0 && i + 1 < text.length && /\d/.test(text[i - 1]) && /\d/.test(text[i + 1]);
      if (depth === 0 && (ch === ';' || (ch === ',' && !isDecimalComma))) {
        if (cur.trim()) commaParts.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) commaParts.push(cur.trim());

    // 2. Boslukla ayrilmis bagimsiz grafik ifadelerini bol (orn: "sin(x) cos(x)", "x^2 x^3")
    const finalParts = [];
    commaParts.forEach(part => {
      const asciiPart = part.toLocaleLowerCase('tr-TR')
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
      if (TURKISH_WORDS.test(asciiPart) || /[<>={}\[\]]/.test(part) || /^(?:d\/dx|∫)/i.test(part)) {
        finalParts.push(part);
        return;
      }
      // Parantez disindaki bosluklara gore parcalara ayir ve operatorle bagli olmayanlari ayri grafik yap
      const words = [];
      let buf = '', d = 0;
      for (let i = 0; i < part.length; i++) {
        const c = part[i];
        if (c === '(') d++;
        else if (c === ')') d = Math.max(0, d - 1);
        if (d === 0 && /\s/.test(c)) {
          if (buf) { words.push(buf); buf = ''; }
        } else {
          buf += c;
        }
      }
      if (buf) words.push(buf);

      if (words.length <= 1) {
        finalParts.push(part);
        return;
      }

      const merged = [words[0]];
      for (let i = 1; i < words.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = words[i];
        const prevEndsOp = /[+\-*/^=]$/.test(prev) || FUNCS.has(prev.toLowerCase());
        const currStartsOp = /^[+\-*/^=]/.test(curr);
        if (prevEndsOp || currStartsOp) {
          merged[merged.length - 1] = prev + ' ' + curr;
        } else {
          merged.push(curr);
        }
      }
      merged.forEach(m => { if (m.trim()) finalParts.push(m.trim()); });
    });

    return finalParts;
  }
  // Yukaridaki splitMultiExpressions fonksiyonu; virgul veya bosluk ile yazilan birden fazla
  // grafigi (orn: "x^2, sin(x)" veya "sin(x) cos(x)") ayirarak ayni anda cizilmesini saglar.

  function parseAssignment(raw) {
    const s = (raw || '').trim();
    if (/[<>]/.test(s)) return null;

    // Dikey dogru: x = a veya x = 3
    const vertMatch = s.match(/^x\s*=\s*(.+)$/i);
    if (vertMatch) {
      return { kind: 'vertical', expr: vertMatch[1].trim() };
    }

    // Ozel degisken atama: a = 5, b = 2*a + 1 (x, y, e haric tek harf)
    const varMatch = s.match(/^([a-df-wzA-DF-WZ])\s*=\s*(.+)$/);
    if (varMatch) {
      return { kind: 'assign', name: varMatch[1].toLowerCase(), expr: varMatch[2].trim() };
    }
    return null;
  }
  // Yukaridaki parseAssignment fonksiyonu; "a = 5" gibi degisken atamalarini ve
  // "x = a" gibi dikey dogru ifadelerini algilar.

  function evalBoundToken(token, variables) {
    const t = token.trim().toLowerCase();
    if (t === 'pi' || t === 'π') return Math.PI;
    if (t === '-pi' || t === '-π') return -Math.PI;
    if (variables && t in variables) return Number(variables[t]);
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function extractDomain(raw, variables) {
    let s = (raw || '').trim();
    const numOrVar = '[+-]?(?:\\d+(?:[.,]\\d+)?|pi|π|[a-df-wz])';

    // Cift tarafli aralik: -2 < x < 5 veya { -3 <= x <= 3 }
    const dblRe = new RegExp('[\\{\\[\\s]?\\s*(' + numOrVar + ')\\s*(<=|<)\\s*x\\s*(<=|<)\\s*(' + numOrVar + ')\\s*[\\}\\]]?', 'i');
    const dm = s.match(dblRe);
    if (dm) {
      const minV = evalBoundToken(dm[1], variables);
      const maxV = evalBoundToken(dm[4], variables);
      if (Number.isFinite(minV) && Number.isFinite(maxV)) {
        const rest = (s.slice(0, dm.index) + ' ' + s.slice(dm.index + dm[0].length)).trim();
        return {
          exprWithoutDomain: rest,
          domain: { min: minV, minInc: dm[2] === '<=', max: maxV, maxInc: dm[3] === '<=', label: dm[0].trim() }
        };
      }
    }

    // Tek tarafli aralik: x > 0, x <= 4
    const sglRe = new RegExp('[\\{\\[\\s]?\\s*x\\s*(<=|>=|<|>)\\s*(' + numOrVar + ')\\s*[\\}\\]]?', 'i');
    const sm = s.match(sglRe);
    if (sm) {
      const val = evalBoundToken(sm[2], variables);
      if (Number.isFinite(val)) {
        const rest = (s.slice(0, sm.index) + ' ' + s.slice(sm.index + sm[0].length)).trim();
        const op = sm[1];
        const domain = (op === '>' || op === '>=')
          ? { min: val, minInc: op === '>=', max: null, maxInc: false, label: sm[0].trim() }
          : { min: null, minInc: false, max: val, maxInc: op === '<=', label: sm[0].trim() };
        return { exprWithoutDomain: rest, domain };
      }
    }

    // Ters yazim: 0 < x veya 5 >= x
    const revRe = new RegExp('[\\{\\[\\s]?\\s*(' + numOrVar + ')\\s*(<=|>=|<|>)\\s*x\\s*[\\}\\]]?', 'i');
    const rm = s.match(revRe);
    if (rm) {
      const val = evalBoundToken(rm[1], variables);
      if (Number.isFinite(val)) {
        const rest = (s.slice(0, rm.index) + ' ' + s.slice(rm.index + rm[0].length)).trim();
        const op = rm[2];
        const domain = (op === '<' || op === '<=')
          ? { min: val, minInc: op === '<=', max: null, maxInc: false, label: rm[0].trim() }
          : { min: null, minInc: false, max: val, maxInc: op === '>=', label: rm[0].trim() };
        return { exprWithoutDomain: rest, domain };
      }
    }

    return { exprWithoutDomain: s, domain: null };
  }
  // Yukaridaki extractDomain fonksiyonu; <, >, <=, >= ile belirtilen aralik kosullarini
  // ifadeden ayirir ve grafigin sadece o aralikta cizilmesini saglar.

  function normalizeTurkishMath(raw) {
    let s = (raw || '').trim();
    s = s
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/√/g, 'sqrt')
      .replace(/π/g, 'pi')
      .replace(/[×·]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/°/g, '');
    s = s.replace(/\|([^|]+)\|/g, 'abs($1)');

    let calculusMode = null;
    const derivMatch = s.match(/^(?:d\/dx|turev|türev)\s*\((.+)\)$/i);
    if (derivMatch) { calculusMode = 'derivative'; s = derivMatch[1]; }
    const intMatch = s.match(/^∫\s*\((.+)\)\s*(?:dx)?$/i) || s.match(/^∫\s*(.+?)\s*dx$/i);
    if (intMatch) { calculusMode = 'integral'; s = intMatch[1]; }

    s = s.toLocaleLowerCase('tr-TR')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');

    const explicitGraph = /\b(grafigi|grafigini|grafik|ciz)\b/i.test(s);
    s = s.replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
    s = s.replace(/\b(grafigini|grafigi|grafik|ciz|goster|hesapla|kactir|nedir|sonucu|lutfen|esittir)\b/gi, ' ');
    s = s.replace(/(\d),(\d)/g, '$1.$2');
    s = s.replace(/\b(uzeri|ussu|kuvveti)\b/gi, '^');
    s = s.replace(/\bkaresi\b/gi, '^2');
    s = s.replace(/\bkupu\b/gi, '^3');
    s = s.replace(/\b(karekok|kok)\b/gi, 'sqrt');
    s = s.replace(/\b(arti|topla)\b/gi, '+');
    s = s.replace(/\b(eksi|cikar)\b/gi, '-');
    s = s.replace(/\b(carpi|kere|defa)\b/gi, '*');
    s = s.replace(/\bbolu\b/gi, '/');
    s = s.replace(/\*\*/g, '^');
    s = s.replace(/\s+/g, ' ').trim();

    const fnList = Array.from(FUNCS).sort((a, b) => b.length - a.length).join('|');
    s = s.replace(new RegExp('\\b(' + fnList + ')\\s+([0-9.]+|[a-z])\\b', 'gi'), '$1($2)');

    return { normalized: s, explicitGraph, calculusMode };
  }

  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        let num = '', dots = 0;
        while (i < expr.length && /[0-9.]/.test(expr[i])) {
          if (expr[i] === '.') dots++;
          if (dots > 1) throw new Error('Geçersiz sayı biçimi.');
          num += expr[i++];
        }
        tokens.push({ type: 'num', value: parseFloat(num) });
        continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        let id = '';
        while (i < expr.length && /[a-zA-Z]/.test(expr[i])) id += expr[i++];
        const low = id.toLowerCase();
        // Eger bilinen fonksiyon veya pi degilse, "ax" gibi iki harfi ayri degiskenlere bol
        if (FUNCS.has(low) || low === 'pi' || low.length === 1) {
          tokens.push({ type: 'id', value: low });
        } else {
          for (let k = 0; k < low.length; k++) tokens.push({ type: 'id', value: low[k] });
        }
        continue;
      }
      if ('+-*/^()'.includes(ch)) {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }
      throw new Error('Tanınmayan karakter: "' + ch + '"');
    }

    const out = [];
    for (let j = 0; j < tokens.length; j++) {
      const curr = tokens[j];
      if (j > 0) {
        const prev = tokens[j - 1];
        const prevIsVal = prev.type === 'num' || (prev.type === 'id' && !FUNCS.has(prev.value)) || (prev.type === 'op' && prev.value === ')');
        const currStartsVal = curr.type === 'num' || curr.type === 'id' || (curr.type === 'op' && curr.value === '(');
        if (prevIsVal && currStartsVal) out.push({ type: 'op', value: '*' });
      }
      out.push(curr);
    }
    return out;
  }

  function parseExpression(expr) {
    const tokens = tokenize(expr);
    if (!tokens.length) throw new Error('Lütfen bir matematik ifadesi yazın.');
    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function parseAddSub() {
      let node = parseMulDiv();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        node = { type: 'bin', op, left: node, right: parseMulDiv() };
      }
      return node;
    }
    function parseMulDiv() {
      let node = parseUnary();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        const op = consume().value;
        node = { type: 'bin', op, left: node, right: parseUnary() };
      }
      return node;
    }
    function parseUnary() {
      if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const arg = parseUnary();
        return op === '-' ? { type: 'neg', arg } : arg;
      }
      return parsePow();
    }
    function parsePow() {
      const base = parsePrimary();
      if (peek() && peek().type === 'op' && peek().value === '^') {
        consume();
        return { type: 'bin', op: '^', left: base, right: parseUnary() };
      }
      return base;
    }
    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error('İfade eksik görünüyor.');
      if (tok.type === 'num') { consume(); return { type: 'num', value: tok.value }; }
      if (tok.type === 'id') {
        consume();
        if (tok.value === 'x') return { type: 'var', name: 'x' };
        if (tok.value === 'pi') return { type: 'num', value: Math.PI };
        if (tok.value === 'e') return { type: 'num', value: Math.E };
        if (FUNCS.has(tok.value)) {
          if (!peek() || peek().value !== '(') throw new Error(tok.value + ' fonksiyonu için parantez kullanın.');
          consume();
          const arg = parseAddSub();
          if (!peek() || peek().value !== ')') throw new Error('Kapanmayan parantez var.');
          consume();
          return { type: 'fn', name: tok.value, arg };
        }
        if (/^[a-z]$/.test(tok.value)) {
          return { type: 'param', name: tok.value };
        }
        throw new Error('Bilinmeyen ifade: "' + tok.value + '"');
      }
      if (tok.type === 'op' && tok.value === '(') {
        consume();
        const inner = parseAddSub();
        if (!peek() || peek().value !== ')') throw new Error('Kapanmayan parantez var.');
        consume();
        return inner;
      }
      throw new Error('Beklenmeyen karakter: "' + tok.value + '"');
    }
    const ast = parseAddSub();
    if (pos < tokens.length) throw new Error('İfade çözümlenemedi: "' + tokens[pos].value + '"');
    return ast;
  }
  // Yukaridaki parseExpression fonksiyonu x haricindeki tek harfli degiskenleri (a, b, k vb.)
  // param dugumu olarak tanir ve a*x^2 gibi ifadelere olanak verir.

  function extractParams(node) {
    const params = new Set();
    (function walk(n) {
      if (!n) return;
      if (n.type === 'param') params.add(n.name);
      if (n.type === 'bin') { walk(n.left); walk(n.right); }
      if (n.type === 'neg' || n.type === 'fn') walk(n.arg);
    })(node);
    return Array.from(params);
  }

  function evaluateAST(node, xVal, angleUnit, variables) {
    const toRad = angleUnit === 'DEG' ? Math.PI / 180 : 1;
    const fromRad = angleUnit === 'DEG' ? 180 / Math.PI : 1;
    const vars = variables || {};
    function ev(n) {
      if (n.type === 'num') return n.value;
      if (n.type === 'var') return xVal;
      if (n.type === 'param') return (n.name in vars) ? Number(vars[n.name]) : 1;
      if (n.type === 'neg') return -ev(n.arg);
      if (n.type === 'bin') {
        const l = ev(n.left), r = ev(n.right);
        if (n.op === '+') return l + r;
        if (n.op === '-') return l - r;
        if (n.op === '*') return l * r;
        if (n.op === '/') return r === 0 ? NaN : l / r;
        if (n.op === '^') return Math.pow(l, r);
      }
      if (n.type === 'fn') {
        const a = ev(n.arg);
        switch (n.name) {
          case 'sin': return Math.sin(a * toRad);
          case 'cos': return Math.cos(a * toRad);
          case 'tan': { const rad = a * toRad, c = Math.cos(rad); return Math.abs(c) < 1e-10 ? NaN : Math.sin(rad) / c; }
          case 'cot': { const rad = a * toRad, s = Math.sin(rad); return Math.abs(s) < 1e-10 ? NaN : Math.cos(rad) / s; }
          case 'sec': { const c = Math.cos(a * toRad); return Math.abs(c) < 1e-10 ? NaN : 1 / c; }
          case 'csc': { const s = Math.sin(a * toRad); return Math.abs(s) < 1e-10 ? NaN : 1 / s; }
          case 'asin': case 'arcsin': return Math.asin(a) * fromRad;
          case 'acos': case 'arccos': return Math.acos(a) * fromRad;
          case 'atan': case 'arctan': return Math.atan(a) * fromRad;
          case 'sqrt': return a < 0 ? NaN : Math.sqrt(a);
          case 'cbrt': return Math.cbrt(a);
          case 'abs': return Math.abs(a);
          case 'ln': return a <= 0 ? NaN : Math.log(a);
          case 'log': return a <= 0 ? NaN : Math.log10(a);
          case 'exp': return Math.exp(a);
          case 'sinh': return Math.sinh(a);
          case 'cosh': return Math.cosh(a);
          case 'tanh': return Math.tanh(a);
          case 'floor': return Math.floor(a);
          case 'ceil': return Math.ceil(a);
        }
      }
      return NaN;
    }
    return ev(node);
  }

  function analyzeAST(node, variables) {
    let hasX = false, hasPower = false, hasTrig = false, hasFn = false;
    (function walk(n) {
      if (!n) return;
      if (n.type === 'var') hasX = true;
      if (n.type === 'bin') { if (n.op === '^') hasPower = true; walk(n.left); walk(n.right); }
      if (n.type === 'neg') walk(n.arg);
      if (n.type === 'fn') { hasFn = true; if (TRIG_FUNCS.has(n.name)) hasTrig = true; walk(n.arg); }
    })(node);

    let simplePower = null;
    if (!hasX && node.type === 'bin' && node.op === '^') {
      const baseVal = evaluateAST(node.left, 0, 'DEG', variables);
      const expVal = evaluateAST(node.right, 0, 'DEG', variables);
      if (Number.isFinite(baseVal) && Number.isFinite(expVal) && baseVal > 0 && baseVal !== 1) {
        simplePower = { base: baseVal, exp: expVal };
      }
    }
    return { hasX, hasPower, hasTrig, hasFn, simplePower };
  }

  function numNode(v) { return { type: 'num', value: v }; }
  function binNode(op, l, r) { return { type: 'bin', op, left: l, right: r }; }

  function diffAST(n) {
    if (n.type === 'num' || n.type === 'param') return numNode(0);
    if (n.type === 'var') return numNode(1);
    if (n.type === 'neg') return { type: 'neg', arg: diffAST(n.arg) };
    if (n.type === 'bin') {
      const u = n.left, v = n.right;
      const du = diffAST(u), dv = diffAST(v);
      if (n.op === '+' || n.op === '-') return binNode(n.op, du, dv);
      if (n.op === '*') return binNode('+', binNode('*', du, v), binNode('*', u, dv));
      if (n.op === '/') return binNode('/', binNode('-', binNode('*', du, v), binNode('*', u, dv)), binNode('^', v, numNode(2)));
      if (n.op === '^') {
        if (v.type === 'num') return binNode('*', binNode('*', v, binNode('^', u, numNode(v.value - 1))), du);
        if (u.type === 'num') return binNode('*', binNode('*', binNode('^', u, v), { type: 'fn', name: 'ln', arg: u }), dv);
        return binNode('*', binNode('^', u, v), binNode('+', binNode('*', dv, { type: 'fn', name: 'ln', arg: u }), binNode('*', v, binNode('/', du, u))));
      }
    }
    if (n.type === 'fn') {
      const u = n.arg, du = diffAST(u);
      switch (n.name) {
        case 'sin': return binNode('*', { type: 'fn', name: 'cos', arg: u }, du);
        case 'cos': return binNode('*', { type: 'neg', arg: { type: 'fn', name: 'sin', arg: u } }, du);
        case 'tan': return binNode('/', du, binNode('^', { type: 'fn', name: 'cos', arg: u }, numNode(2)));
        case 'cot': return { type: 'neg', arg: binNode('/', du, binNode('^', { type: 'fn', name: 'sin', arg: u }, numNode(2))) };
        case 'ln': return binNode('/', du, u);
        case 'log': return binNode('/', du, binNode('*', u, { type: 'fn', name: 'ln', arg: numNode(10) }));
        case 'exp': return binNode('*', { type: 'fn', name: 'exp', arg: u }, du);
        case 'sqrt': return binNode('/', du, binNode('*', numNode(2), { type: 'fn', name: 'sqrt', arg: u }));
        case 'sinh': return binNode('*', { type: 'fn', name: 'cosh', arg: u }, du);
        case 'cosh': return binNode('*', { type: 'fn', name: 'sinh', arg: u }, du);
      }
    }
    return numNode(0);
  }

  function simplifyAST(n) {
    if (!n || n.type === 'num' || n.type === 'var' || n.type === 'param') return n;
    if (n.type === 'neg') {
      const a = simplifyAST(n.arg);
      if (a.type === 'num') return numNode(-a.value);
      if (a.type === 'neg') return a.arg;
      return { type: 'neg', arg: a };
    }
    if (n.type === 'fn') return { type: 'fn', name: n.name, arg: simplifyAST(n.arg) };
    if (n.type === 'bin') {
      const l = simplifyAST(n.left), r = simplifyAST(n.right);
      if (l.type === 'num' && r.type === 'num') {
        if (n.op === '+') return numNode(l.value + r.value);
        if (n.op === '-') return numNode(l.value - r.value);
        if (n.op === '*') return numNode(l.value * r.value);
        if (n.op === '^') return numNode(Math.pow(l.value, r.value));
      }
      if (n.op === '+') { if (l.type === 'num' && l.value === 0) return r; if (r.type === 'num' && r.value === 0) return l; }
      if (n.op === '-') { if (r.type === 'num' && r.value === 0) return l; if (l.type === 'num' && l.value === 0) return simplifyAST({ type: 'neg', arg: r }); }
      if (n.op === '*') { if ((l.type === 'num' && l.value === 0) || (r.type === 'num' && r.value === 0)) return numNode(0); if (l.type === 'num' && l.value === 1) return r; if (r.type === 'num' && r.value === 1) return l; }
      if (n.op === '/') { if (l.type === 'num' && l.value === 0) return numNode(0); if (r.type === 'num' && r.value === 1) return l; }
      if (n.op === '^') { if (r.type === 'num' && r.value === 0) return numNode(1); if (r.type === 'num' && r.value === 1) return l; }
      return binNode(n.op, l, r);
    }
    return n;
  }

  function astToString(n) {
    if (!n) return '';
    if (n.type === 'num') {
      if (Math.abs(n.value - Math.PI) < 1e-9) return 'pi';
      if (Math.abs(n.value - Math.E) < 1e-9) return 'e';
      return String(Math.round(n.value * 1e6) / 1e6);
    }
    if (n.type === 'var') return 'x';
    if (n.type === 'param') return n.name;
    if (n.type === 'neg') return '-' + (n.arg.type === 'bin' ? '(' + astToString(n.arg) + ')' : astToString(n.arg));
    if (n.type === 'fn') return n.name + '(' + astToString(n.arg) + ')';
    if (n.type === 'bin') {
      const ls = astToString(n.left), rs = astToString(n.right);
      if (n.op === '+' || n.op === '-') return ls + ' ' + n.op + ' ' + rs;
      const lp = (n.left.type === 'bin' && (n.left.op === '+' || n.left.op === '-')) ? '(' + ls + ')' : ls;
      const rp = (n.right.type === 'bin' && (n.right.op === '+' || n.right.op === '-')) ? '(' + rs + ')' : rs;
      if (n.op === '*') return lp + '*' + rp;
      if (n.op === '/') return lp + '/' + rp;
      if (n.op === '^') return lp + '^' + rp;
    }
    return '';
  }

  function solveDerivative(ast, xPoint, variables) {
    const dAst = simplifyAST(diffAST(ast));
    const dStr = astToString(dAst);
    let atPoint = null;
    if (xPoint !== null && xPoint !== '' && Number.isFinite(Number(xPoint))) {
      atPoint = evaluateAST(dAst, Number(xPoint), 'RAD', variables);
    }
    return { ast: dAst, text: dStr, atPoint };
  }

  function integrateSimpleAST(n) {
    if (n.type === 'num' || n.type === 'param') return binNode('*', n, { type: 'var', name: 'x' });
    if (n.type === 'var') return binNode('/', binNode('^', { type: 'var', name: 'x' }, numNode(2)), numNode(2));
    if (n.type === 'neg') { const inner = integrateSimpleAST(n.arg); return inner ? { type: 'neg', arg: inner } : null; }
    if (n.type === 'bin') {
      if (n.op === '+' || n.op === '-') { const l = integrateSimpleAST(n.left), r = integrateSimpleAST(n.right); return (l && r) ? binNode(n.op, l, r) : null; }
      if (n.op === '*') {
        if (n.left.type === 'num' || n.left.type === 'param') { const r = integrateSimpleAST(n.right); return r ? binNode('*', n.left, r) : null; }
        if (n.right.type === 'num' || n.right.type === 'param') { const l = integrateSimpleAST(n.left); return l ? binNode('*', n.right, l) : null; }
      }
      if (n.op === '/' && n.left.type === 'num' && n.right.type === 'var') {
        return binNode('*', n.left, { type: 'fn', name: 'ln', arg: { type: 'fn', name: 'abs', arg: { type: 'var', name: 'x' } } });
      }
      if (n.op === '^' && n.left.type === 'var' && n.right.type === 'num') {
        const p = n.right.value;
        if (Math.abs(p + 1) < 1e-9) return { type: 'fn', name: 'ln', arg: { type: 'fn', name: 'abs', arg: { type: 'var', name: 'x' } } };
        return binNode('/', binNode('^', { type: 'var', name: 'x' }, numNode(p + 1)), numNode(p + 1));
      }
    }
    if (n.type === 'fn' && n.arg.type === 'var') {
      if (n.name === 'sin') return { type: 'neg', arg: { type: 'fn', name: 'cos', arg: n.arg } };
      if (n.name === 'cos') return { type: 'fn', name: 'sin', arg: n.arg };
      if (n.name === 'exp') return { type: 'fn', name: 'exp', arg: n.arg };
    }
    return null;
  }

  function numericDefiniteIntegral(ast, a, b, angleUnit, variables) {
    const n = 400, h = (b - a) / n;
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      const xi = a + i * h;
      let yi = evaluateAST(ast, xi, angleUnit, variables);
      if (!Number.isFinite(yi)) yi = 0;
      sum += ((i === 0 || i === n) ? 1 : (i % 2 === 1 ? 4 : 2)) * yi;
    }
    return (h / 3) * sum;
  }

  function solveIntegral(ast, lower, upper, angleUnit, variables) {
    const anti = integrateSimpleAST(ast);
    const simp = anti ? simplifyAST(anti) : null;
    const indefinite = simp ? (astToString(simp) + ' + C') : null;
    let definite = null;
    if (lower !== null && upper !== null && lower !== '' && upper !== '' && Number.isFinite(Number(lower)) && Number.isFinite(Number(upper))) {
      definite = numericDefiniteIntegral(ast, Number(lower), Number(upper), angleUnit, variables);
    }
    return { antiAst: simp, indefinite, definite };
  }

  function formatNumber(val) {
    if (!Number.isFinite(val)) return 'Tanımsız';
    if (Math.abs(val) < 1e-12) return '0';
    if (Math.abs(val) >= 1e12 || (Math.abs(val) > 0 && Math.abs(val) < 1e-6)) return val.toExponential(4).replace('+', '');
    const rounded = Math.round(val * 1e6) / 1e6;
    return Number.isInteger(rounded) ? rounded.toLocaleString('tr-TR') : String(rounded);
  }

  async function callPythonApi(endpoint, payload) {
    if (!global.MATGRAF_USE_API) return null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  global.MatGrafEngine = {
    splitMultiExpressions,
    parseAssignment,
    extractDomain,
    normalizeTurkishMath,
    parseExpression,
    extractParams,
    evaluateAST,
    analyzeAST,
    solveDerivative,
    solveIntegral,
    formatNumber,
    callPythonApi
  };
})(window);
