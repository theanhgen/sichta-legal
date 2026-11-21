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
     The app's halftone (Dither.metal): a 3 pt grid of squares, ink at 38 %,
     blurred 0.8, sized by data-shader="N" (1-3) large drifting blobs.
     15 fps; still under Reduce Motion, in a hidden tab and off screen. */
  var sec = document.querySelector('[data-shader]');
  if (!sec) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'shader';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return;
  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  // The app's halftone squares (3 pt grid, ink at 38 %, blurred 0.8), sized here
  // by a few large blobs drifting slowly across the stage instead of the app's
  // dense wave field, so the stage carries 1-3 big soft shapes.
  var fs = [
    'precision mediump float;',
    'uniform vec2 uSize;uniform float uT;uniform float uScale;uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform float uN;uniform float uA;',
    'float blob(vec2 pos,vec2 c,float r){return 1.-smoothstep(0.18*r,r,length(pos-c));}',
    'void main(){',
    '  vec2 pos=vec2(gl_FragCoord.x,uSize.y*uScale-gl_FragCoord.y)/uScale;',
    '  vec2 cell=floor(pos/3.)*3.+1.5;',
    '  float m=max(uSize.x,uSize.y);',
    '  float r=m*(uN<1.5?0.5:(uN<2.5?0.4:0.32));',
    '  vec2 c0=uSize*(vec2(0.32,0.78)+vec2(0.22*sin(uT*0.32),0.14*cos(uT*0.24)));',
    '  vec2 c1=uSize*(vec2(0.82,0.18)+vec2(0.12*cos(uT*0.22+1.3),0.14*sin(uT*0.28+0.4)));',
    '  vec2 c2=uSize*(vec2(0.55,0.10)+vec2(0.14*sin(uT*0.26+2.1),0.08*cos(uT*0.20+0.9)));',
    '  float b0=blob(cell,c0,r);',
    '  float b1=uN>1.5?0.85*blob(cell,c1,r*0.8):0.;',
    '  float b2=uN>2.5?0.75*blob(cell,c2,r*0.7):0.;',
    '  float tone=max(b0,max(b1,b2));',
    '  vec3 col=(uC0*b0+uC1*b1+uC2*b2+uC0*0.001)/(b0+b1+b2+0.001);',
    '  float h=0.15+tone;',
    '  vec2 d=abs(pos-cell);',
    '  float cov=clamp((h-max(d.x,d.y))*uScale+0.5,0.,1.);',
    '  float al=uA*cov;',
    '  gl_FragColor=vec4(col*al,al);',
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
  var uSize = gl.getUniformLocation(prog, 'uSize'), uT = gl.getUniformLocation(prog, 'uT'), uN = gl.getUniformLocation(prog, 'uN'), uA = gl.getUniformLocation(prog, 'uA'),
      uScale = gl.getUniformLocation(prog, 'uScale');
  // data-colors="#hex,#hex,#hex": one per blob; data-alpha: square opacity.
  var cols = (sec.getAttribute('data-colors') || '#1E1B16').split(',');
  ['uC0', 'uC1', 'uC2'].forEach(function (u, i) {
    var h = (cols[i] || cols[0]).trim().replace('#', '');
    gl.uniform3f(gl.getUniformLocation(prog, u), parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  });
  gl.uniform1f(uA, parseFloat(sec.getAttribute('data-alpha')) || 0.38);
  gl.uniform1f(uN, parseFloat(sec.getAttribute('data-shader')) || 2);

  sec.insertBefore(canvas, sec.firstChild);
  sec.classList.add('shader-on');

  var w = 0, hgt = 0, scale = 1, t = 0, t0 = 0;
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uSize, w, hgt); gl.uniform1f(uScale, scale); gl.uniform1f(uT, t);
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
    if (start === null) start = now - t0 * 1000;
    if (now - last >= 1000 / 15) {
      last = now;
      t = t0 = (now - start) / 1000;
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
