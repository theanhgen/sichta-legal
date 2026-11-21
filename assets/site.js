/* šichta landing: the running-shift screenshot ticks live, and the stage runs the
   app's live-hero halftone shader (Sichta/Theme/Dither.metal, shFieldDither).
   Both are progressive: without JS or WebGL the page stays as it is. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Live running shift ------------------------------------------------
     The screenshot is 2:42:27 into a 19:12 → 0:12 plan at 170 CZK/h. From page
     load the shift keeps running from there, on the visitor's own clock. */
  var box = document.querySelector('[data-live]');
  if (box) {
    var lang = box.getAttribute('data-live');
    var svg = box.querySelector('svg');
    var img = box.querySelector('img');
    var NS = 'http://www.w3.org/2000/svg';
    var E0 = 2 * 3600 + 42 * 60 + 27, PLAN = 5 * 3600, RATE = 170 / 3600;
    var q = function (k) { return svg.querySelector('[data-k="' + k + '"]'); };
    var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var hm = function (d) { return d.getHours() + ':' + pad2(d.getMinutes()); };
    var set = function (el, v) { if (el.textContent !== v) el.textContent = v; };

    // Cents roll like the app's odometer: a strip of digits behind a clip.
    var slots = [q('c0'), q('c1')], centres = [441 - 395, 496 - 395];
    slots.forEach(function (g, s) {
      for (var i = 0; i <= 10; i++) {
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('x', centres[s]); t.setAttribute('y', 902 - 805 + i * 120);
        t.textContent = String(i % 10);
        g.appendChild(t);
      }
      g._d = -1;
    });
    function roll(g, d) {
      if (g._d === d) return;
      var wrap = g._d === 9 && d === 0 && !reduce;
      g._d = d;
      if (wrap) {
        g.style.transform = 'translateY(-1200px)';
        setTimeout(function () {
          g.style.transition = 'none';
          g.style.transform = 'translateY(0px)';
          g.getBoundingClientRect();
          g.style.transition = '';
        }, 180);
      } else {
        g.style.transform = 'translateY(' + (-d * 120) + 'px)';
      }
    }

    var t0 = 0;
    function frame() {
      var el = E0 + (performance.now() - t0) / 1000;
      var now = new Date();
      var s = Math.floor(el);
      set(q('timer'), Math.floor(s / 3600) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60));
      var earned = el * RATE, whole = Math.floor(earned), cents = Math.floor((earned - whole) * 100);
      set(q('int'), String(whole));
      roll(slots[0], Math.floor(cents / 10));
      roll(slots[1], cents % 10);
      var start = new Date(now.getTime() - el * 1000), end = new Date(start.getTime() + PLAN * 1000);
      set(q('start'), lang === 'cs' ? 'Začátek ' + hm(start) + ' → plán ' + hm(end)
                                    : 'Started ' + hm(start) + ' → plan ' + hm(end));
      var frac = Math.min(1, el / PLAN), pct = Math.floor(frac * 100);
      q('fill').setAttribute('width', (frac * 1050).toFixed(1));
      var rem = Math.ceil((PLAN - el) / 60), left = Math.floor(rem / 60) + 'h ' + (rem % 60) + 'm';
      set(q('pct'), rem > 0
        ? (lang === 'cs' ? pct + ' % plánu · zbývá ' + left : pct + '% of plan · ' + left + ' left')
        : (lang === 'cs' ? '100 % plánu' : '100% of plan'));
    }

    var plate = new Image();
    plate.src = img.getAttribute('data-live-src');
    var ready = [plate.decode ? plate.decode() : Promise.resolve()];
    if (document.fonts && document.fonts.load) {
      ready.push(document.fonts.load('500 100px Handjet'), document.fonts.load('500 100px Geist'));
    }
    Promise.all(ready).then(function () {
      t0 = performance.now();
      frame();
      img.src = plate.src;
      box.classList.add('on');
      setInterval(frame, 100);
    }).catch(function () { /* keep the plain screenshot */ });
  }

  /* ---- Stage shader -------------------------------------------------------
     shFieldDither: a 3 pt grid whose squares are sized by two broad waves
     drifting across, one wavelength per 10 s cycle, ink at 38 %, blurred 0.8.
     15 fps; still under Reduce Motion, in a hidden tab and off screen. */
  var sec = document.querySelector('[data-shader]');
  if (!sec) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'shader';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return;
  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 uSize;uniform float uPhase;uniform float uScale;uniform vec3 uColor;',
    'void main(){',
    '  vec2 pos=vec2(gl_FragCoord.x,uSize.y*uScale-gl_FragCoord.y)/uScale;',
    '  vec2 cell=floor(pos/3.)*3.+1.5;',
    '  vec2 q=cell/160.;',
    '  float a=sin(6.2831853*(0.8*q.x+0.3*q.y-uPhase));',
    '  float b=sin(6.2831853*(-0.35*q.x+0.9*q.y+uPhase));',
    '  float tone=0.5+0.25*(a+b);',
    '  float h=0.15+tone;',
    '  vec2 d=abs(pos-cell);',
    '  float cov=clamp((h-max(d.x,d.y))*uScale+0.5,0.,1.);',
    '  float al=0.38*cov;',
    '  gl_FragColor=vec4(uColor*al,al);',
    '}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
  var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uSize = gl.getUniformLocation(prog, 'uSize'), uPhase = gl.getUniformLocation(prog, 'uPhase'),
      uScale = gl.getUniformLocation(prog, 'uScale'), uColor = gl.getUniformLocation(prog, 'uColor');
  gl.uniform3f(uColor, 0x1E / 255, 0x1B / 255, 0x16 / 255);

  sec.insertBefore(canvas, sec.firstChild);
  sec.classList.add('shader-on');

  var w = 0, hgt = 0, scale = 1, phase = 0;
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uSize, w, hgt); gl.uniform1f(uScale, scale); gl.uniform1f(uPhase, phase);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function resize() {
    var r = sec.getBoundingClientRect();
    scale = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; hgt = r.height;
    canvas.width = Math.round(w * scale); canvas.height = Math.round(hgt * scale);
    draw();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(sec); else window.addEventListener('resize', resize);
  resize();

  var onScreen = true, start = null, last = 0, raf = 0;
  function still() { return reduce || document.hidden || !onScreen; }
  function tick(now) {
    raf = 0;
    if (still()) { start = null; return; }
    if (start === null) start = now;
    if (now - last >= 1000 / 15) {
      last = now;
      phase = ((now - start) / 10000) % 1;
      draw();
    }
    raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && !still()) raf = requestAnimationFrame(tick); }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; wake(); }).observe(sec);
  }
  document.addEventListener('visibilitychange', wake);
  wake();
})();
