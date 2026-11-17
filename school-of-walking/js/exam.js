// Entrance exam: tap once per footstep, get your tempo, meet the archive walker who shares it.
(() => {
  const NEED = 20;
  const btn = document.querySelector(".stepper");
  const count = btn.querySelector(".count");
  const of = btn.querySelector(".of");
  const live = document.querySelector(".exam .live");
  const out = document.querySelector(".result");
  const root = document.documentElement.dataset.root;
  let taps = [], walkers = [];
  fetch(root + "data/walkers.json").then(r => r.json()).then(w => { walkers = w.filter(x => x.cadence); });

  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function tap() {
    if (taps.length >= NEED) return;
    taps.push(performance.now());
    btn.classList.add("hit"); setTimeout(() => btn.classList.remove("hit"), 90);
    count.textContent = taps.length;
    of.textContent = taps.length < NEED ? `of ${NEED} steps` : "done";
    if (taps.length >= 6) {
      const iv = taps.slice(1).map((t, i) => t - taps[i]);
      live.textContent = `so far: ${Math.round(60000 / median(iv))} steps a minute`;
    }
    if (taps.length === NEED) finish();
  }

  function finish() {
    btn.classList.add("done");
    let iv = taps.slice(1).map((t, i) => t - taps[i]);
    const m0 = median(iv);
    iv = iv.filter(x => x > 0.5 * m0 && x < 1.6 * m0);
    const cad = 60000 / median(iv);
    live.textContent = "";
    if (!(cad > 50 && cad < 200)) {
      out.innerHTML = `<h2>That was not a walking tempo.</h2><p class="sub">${Math.round(cad)} taps a minute. Tap once each time a foot lands, at the pace you walk to the shop.</p><button class="again" type="button">Take the exam again</button>`;
    } else {
      const near = list => list.reduce((a, b) => Math.abs(b.cadence - cad) < Math.abs(a.cadence - cad) ? b : a);
      const tor = near(walkers.filter(w => w.film.startsWith("toronto")));
      const mun = near(walkers.filter(w => w.film === "munich"));
      const card = (w, label) => `<div class="match"><h3>${label}</h3><p>${w.place}, passer-by ${w.pid}: ${Math.round(w.cadence)} steps a minute, stride ${w.step.toFixed(2)} body heights.</p><img src="${root}${w.strip}" alt="Skeleton of passer-by ${w.pid}, drawn every sixth of a second" width="${w.w}" height="${w.h}"></div>`;
      out.innerHTML = `<h2>Your tempo: ${Math.round(cad)} steps a minute.</h2>
        <p class="sub">A foot lands every ${(60 / cad).toFixed(2)} seconds. The median in the archive is 114.</p>
        ${dist(cad)}
        ${card(tor, "Your walk in 1928")}
        ${card(mun, "Your walk today")}
        <button class="again" type="button">Take the exam again</button>`;
    }
    out.hidden = false;
    out.querySelector(".again").addEventListener("click", reset);
    out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function dist(cad) {
    const lo = 70, hi = 160, W = 760, x = v => 20 + (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (W - 40);
    let s = `<svg class="dist" viewBox="0 0 ${W} 120" role="img" aria-label="Your tempo among ${walkers.length} archive walkers">`;
    s += `<line x1="20" y1="70" x2="${W - 20}" y2="70" stroke="#8A8478"/>`;
    for (let v = 80; v <= 150; v += 10) s += `<line x1="${x(v)}" y1="70" x2="${x(v)}" y2="76" stroke="#8A8478"/><text x="${x(v)}" y="94" text-anchor="middle">${v}</text>`;
    s += `<text x="${W - 20}" y="114" text-anchor="end">steps a minute</text>`;
    const seen = {};
    for (const w of walkers) {
      const k = Math.round(x(w.cadence) / 8); seen[k] = (seen[k] || 0) + 1;
      const y = 62 - (seen[k] - 1) * 11;
      s += w.film === "munich"
        ? `<circle cx="${x(w.cadence)}" cy="${y}" r="4.2" fill="none" stroke="#2A2A28" stroke-width="1.4"/>`
        : `<circle cx="${x(w.cadence)}" cy="${y}" r="4.6" fill="#2A2A28"/>`;
    }
    s += `<circle cx="${x(cad)}" cy="70" r="10" fill="none" stroke="#BF4A2C" stroke-width="2.4"/><text x="${x(cad)}" y="18" text-anchor="middle" style="fill:#BF4A2C">you</text>`;
    s += `<text x="20" y="114">dot: Toronto 1928, ring: Munich</text></svg>`;
    return s;
  }

  function reset() {
    taps = []; count.textContent = "0"; of.textContent = `of ${NEED} steps`;
    btn.classList.remove("done"); out.hidden = true; live.textContent = ""; btn.focus();
  }

  btn.addEventListener("pointerdown", e => { e.preventDefault(); tap(); });
  btn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); tap(); } });
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && !e.repeat && !e.target.closest("button:not(.stepper), a, input")) { e.preventDefault(); tap(); }
  });
})();
