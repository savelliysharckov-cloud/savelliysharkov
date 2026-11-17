// Replays a street from skeleton data: bones, the route under each body, a ring where a foot lands.
(() => {
  const EDGES = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];
  const HEAD = [0, 1, 2, 3, 4];
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  async function start(canvas) {
    const res = await fetch(canvas.dataset.src);
    const D = await res.json();
    const ctx = canvas.getContext("2d");
    const ink = css("--ink") || "#2A2A28", ink3 = css("--ink-3") || "#8A8478";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // index frames per track and find the bounds of everything that moves
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, F0 = 1e9, F1 = 0;
    for (const t of D.tracks) {
      t.at = new Map(t.frames.map((f, i) => [f, i]));
      F0 = Math.min(F0, t.frames[0]); F1 = Math.max(F1, t.frames[t.frames.length - 1]);
      for (const k of t.kp) for (let j = 0; j < 34; j += 2) {
        if (k[j] < 0) continue;
        minX = Math.min(minX, k[j]); maxX = Math.max(maxX, k[j]);
        minY = Math.min(minY, k[j + 1]); maxY = Math.max(maxY, k[j + 1]);
      }
    }
    let W, H, S, ox, oy, dpr;
    function fit() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const padTop = H * (parseFloat(canvas.dataset.padTop) || 0.12), padBot = H * 0.1, padX = W * 0.04;
      S = Math.min((W - 2 * padX) / (maxX - minX), (H - padTop - padBot) / (maxY - minY));
      const align = canvas.dataset.align || "right";
      ox = align === "right" ? W - padX - (maxX - minX) * S - minX * S : (W - (maxX - minX) * S) / 2 - minX * S;
      oy = H - padBot - maxY * S;
    }
    fit();
    addEventListener("resize", () => { fit(); if (!playing) draw(frame); });

    const X = x => (ox + x * S) * dpr, Y = y => (oy + y * S) * dpr;
    function nearest(t, f) {
      for (let d = 0; d <= 2; d++) {
        if (t.at.has(f - d)) return t.kp[t.at.get(f - d)];
      }
      return null;
    }
    function draw(f) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const t of D.tracks) {
        // route: dots that fade over four seconds
        ctx.fillStyle = ink;
        for (const [df, x, y] of t.dots) {
          const age = f - df;
          if (age < 0 || age > 96) continue;
          ctx.globalAlpha = 0.12 + 0.55 * (1 - age / 96);
          ctx.beginPath(); ctx.arc(X(x), Y(y), 1.8 * dpr, 0, 6.283); ctx.fill();
        }
        // steps: a ring that opens where the foot lands
        ctx.strokeStyle = ink; ctx.lineWidth = 1.3 * dpr;
        for (const [sf, x, y] of t.steps) {
          const age = f - sf;
          if (age < 0 || age > 16) continue;
          ctx.globalAlpha = 1 - age / 16;
          ctx.beginPath(); ctx.arc(X(x), Y(y), (5 + 0.9 * age) * dpr * Math.max(0.6, S), 0, 6.283); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const k = nearest(t, f);
        if (!k) continue;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        for (const [a, b] of EDGES) {
          if (k[2 * a] < 0 || k[2 * b] < 0) continue;
          ctx.moveTo(X(k[2 * a]), Y(k[2 * a + 1])); ctx.lineTo(X(k[2 * b]), Y(k[2 * b + 1]));
        }
        ctx.stroke();
        let hx = 0, hy = 0, n = 0;
        for (const j of HEAD) if (k[2 * j] >= 0) { hx += k[2 * j]; hy += k[2 * j + 1]; n++; }
        if (n) {
          hx /= n; hy /= n;
          ctx.beginPath(); ctx.arc(X(hx), Y(hy), 0.062 * t.h * S * dpr, 0, 6.283); ctx.stroke();
          ctx.fillStyle = ink3; ctx.font = `${10.5 * dpr}px "Overpass Mono", monospace`;
          ctx.fillText(String(t.id).padStart(3, "0"), X(hx) + 0.09 * t.h * S * dpr, Y(hy) - 0.07 * t.h * S * dpr);
        }
      }
    }

    let frame = F0 + Math.round((F1 - F0) * 0.45), playing = false, t0 = 0, raf = 0;
    const fps = D.fps || 24;
    function loop(now) {
      if (!playing) return;
      if (!t0) t0 = now - (frame - F0) * 1000 / fps;
      const f = F0 + Math.floor(((now - t0) * fps / 1000) % (F1 - F0 + 1));
      if (f !== frame) { frame = f; draw(frame); }
      raf = requestAnimationFrame(loop);
    }
    function play() { if (reduce || playing) return; playing = true; t0 = 0; raf = requestAnimationFrame(loop); }
    function stop() { playing = false; cancelAnimationFrame(raf); }
    draw(frame);
    if (!reduce) {
      let onScreen = false;
      new IntersectionObserver(es => es.forEach(e => { onScreen = e.isIntersecting; onScreen ? play() : stop(); }), { threshold: 0.05 }).observe(canvas);
      document.addEventListener("visibilitychange", () => (document.hidden || !onScreen) ? stop() : play());
    }
  }
  document.querySelectorAll("canvas[data-replay]").forEach(c => start(c).catch(err => console.warn("replay:", err)));
})();
