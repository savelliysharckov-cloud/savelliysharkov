// School of Walking — shared behaviour: the route rail, the lightbox, quiet loops.
(() => {
  const PX_PER_M = 120;                 // one metre of page = 120 px of scroll
  const DOT = 0.22 * PX_PER_M;          // a dot every 22 cm, as in the machine's floor routes
  const pathX = y => 44 + 7 * Math.sin(y / 310) + 3 * Math.sin(y / 97 + 1.3);
  const NS = "http://www.w3.org/2000/svg";

  const rail = document.querySelector(".rail");
  const you = document.querySelector(".you");
  const walked = document.querySelector(".walked b");

  function drawRail() {
    if (!rail) return;
    const H = Math.max(document.documentElement.scrollHeight, innerHeight);
    rail.style.height = H + "px";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", 88); svg.setAttribute("height", H);
    svg.setAttribute("aria-hidden", "true");
    let s = "";
    for (let y = 140; y < H; y += DOT) s += `<circle class="d" cx="${pathX(y).toFixed(1)}" cy="${y.toFixed(1)}" r="1.7"/>`;
    for (let m = 2; m * PX_PER_M < H; m++) {
      const y = m * PX_PER_M, x = pathX(y);
      s += `<line class="t" x1="${(x - 9).toFixed(1)}" y1="${y}" x2="${(x + 9).toFixed(1)}" y2="${y}"/>`;
      if (m % 5 === 0) s += `<text x="${(x + 14).toFixed(1)}" y="${y + 4}">${m} m</text>`;
    }
    svg.innerHTML = s;
    rail.replaceChildren(svg);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY + innerHeight / 2;
      if (you) you.style.left = (pathX(y) - 13).toFixed(1) + "px";
      if (walked) walked.textContent = (scrollY / PX_PER_M).toFixed(1) + " m";
      ticking = false;
    });
  }
  drawRail(); onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { drawRail(); onScroll(); });
  addEventListener("load", () => { drawRail(); onScroll(); });
  if ("ResizeObserver" in window) {
    let last = 0;
    new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - last) > 40) { last = h; drawRail(); }
    }).observe(document.body);
  }

  // ---------- lightbox ----------
  const box = document.querySelector("dialog.lightbox");
  if (box) {
    const img = box.querySelector("img"), cap = box.querySelector(".cap");
    document.addEventListener("click", e => {
      const t = e.target.closest("[data-full]");
      if (!t) return;
      e.preventDefault();
      img.src = t.dataset.full;
      img.alt = t.querySelector("img")?.alt || "";
      cap.innerHTML = t.dataset.cap || "";
      box.showModal();
    });
    box.addEventListener("click", e => { if (e.target === box || e.target.closest(".close")) box.close(); });
    box.addEventListener("close", () => { img.removeAttribute("src"); });
  }

  // ---------- salon wall: shrink a row until it fits the wall ----------
  function fitHang() {
    document.querySelectorAll(".hang-row").forEach(row => {
      const items = [...row.children];
      const gap = parseFloat(getComputedStyle(row).columnGap) || 32;
      let sum = 0;
      items.forEach(b => {
        const img = b.querySelector("img");
        b._ar = (+img.getAttribute("width") || img.naturalWidth || 1) / (+img.getAttribute("height") || img.naturalHeight || 1);
        b._h = b._h || parseFloat(b.style.height);
        sum += b._h * b._ar;
      });
      const k = Math.min(1, (row.clientWidth - gap * (items.length - 1)) / sum);
      items.forEach(b => { b.style.height = (b._h * k).toFixed(1) + "px"; b.style.width = (b._h * k * b._ar).toFixed(1) + "px"; });
    });
  }
  fitHang(); addEventListener("resize", fitHang);

  // ---------- quiet loops: play only while on screen ----------
  const loops = document.querySelectorAll("video[data-loop]");
  if (loops.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      const v = en.target;
      if (en.isIntersecting) { if (v.preload === "none") v.preload = "auto"; v.play().catch(() => {}); }
      else v.pause();
    }), { threshold: 0.25 });
    loops.forEach(v => io.observe(v));
  }
})();
