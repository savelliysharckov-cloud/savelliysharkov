// Observatory: each film is one video holding two panes (footage | machine).
// The canvas shows them side by side, as a wipe, or with the machine laid over the footage.
(() => {
  const players = [];
  const fmt = s => { s = Math.max(0, s | 0); return `${(s / 60) | 0}:${String(s % 60).padStart(2, "0")}`; };

  class Film {
    constructor(root) {
      this.root = root;
      this.video = root.querySelector("video");
      this.canvas = root.querySelector("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.theme = root.dataset.theme;                  // "paper" or "night"
      this.mode = root.dataset.mode || "side";
      this.split = 0.5;
      this.visible = false;
      this.timeEl = root.querySelector(".time");
      this.playBtn = root.querySelector("[data-act=play]");
      this.soundBtn = root.querySelector("[data-act=sound]");
      this.hint = root.querySelector(".play-hint");
      this.poster = new Image();
      this.poster.onload = () => { this.size(); this.draw(); };
      this.poster.src = this.video.getAttribute("poster");
      this.panes = root.querySelector(".panes");
      root.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => this.setMode(b.dataset.mode)));
      this.playBtn.addEventListener("click", () => this.video.paused ? this.play(true) : this.pause());
      if (this.soundBtn) this.soundBtn.addEventListener("click", () => {
        this.video.muted = !this.video.muted;
        this.soundBtn.textContent = this.video.muted ? "Sound on" : "Sound off";
      });
      if (this.hint) this.hint.addEventListener("click", () => this.play(true));
      this.video.addEventListener("loadeddata", () => { this.size(); this.draw(); });
      this.video.addEventListener("seeked", () => this.draw());
      this.video.addEventListener("play", () => { this.playBtn.textContent = "Pause"; if (this.hint) this.hint.hidden = true; this.tick(); });
      this.video.addEventListener("pause", () => { this.playBtn.textContent = "Play"; });
      this.video.addEventListener("timeupdate", () => {
        if (this.timeEl) this.timeEl.textContent = `${fmt(this.video.currentTime)} / ${fmt(this.video.duration || 0)}`;
      });
      // dragging the wipe
      const move = e => {
        if (this.mode !== "wipe") return;
        const r = this.canvas.getBoundingClientRect();
        this.split = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        if (this.video.paused) this.draw();
      };
      this.canvas.addEventListener("pointerdown", e => { this.canvas.setPointerCapture(e.pointerId); move(e); });
      this.canvas.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "mouse") move(e); });
      this.canvas.tabIndex = 0;
      this.canvas.addEventListener("keydown", e => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          this.split = Math.min(1, Math.max(0, this.split + (e.key === "ArrowLeft" ? -0.05 : 0.05)));
          if (this.video.paused) this.draw(); e.preventDefault();
        }
        if (e.key === " ") { this.video.paused ? this.play(true) : this.pause(); e.preventDefault(); }
      });
      addEventListener("resize", () => { this.size(); this.draw(); });
      this.setMode(this.mode, true);
    }
    source() {
      const v = this.video;
      if (v.readyState >= 2 && v.videoWidth) return { el: v, w: v.videoWidth, h: v.videoHeight };
      if (this.poster.complete && this.poster.naturalWidth) return { el: this.poster, w: this.poster.naturalWidth, h: this.poster.naturalHeight };
      return null;
    }
    size() {
      const src = this.source(); if (!src) return;
      const full = this.mode === "side";
      const sw = full ? src.w : src.w / 2, sh = src.h;
      const cw = this.canvas.clientWidth || this.root.clientWidth;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.min(Math.round(cw * dpr), sw);
      this.canvas.height = Math.round(this.canvas.width * sh / sw);
      this.canvas.style.aspectRatio = `${sw} / ${sh}`;
    }
    setMode(m, quiet) {
      this.mode = m; this.root.dataset.mode = m;
      this.root.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
      if (this.panes) this.panes.dataset.mode = m;
      this.canvas.setAttribute("aria-label", m === "wipe" ? "Drag left or right to wipe between the footage and the machine view" : "Film");
      this.size(); this.draw();
    }
    draw() {
      const src = this.source(), c = this.ctx, W = this.canvas.width, H = this.canvas.height;
      if (!src || !W) return;
      const v = src.el, vw = src.w, vh = src.h, pw = vw / 2;
      c.globalCompositeOperation = "source-over";
      if (this.mode === "side") { c.drawImage(v, 0, 0, vw, vh, 0, 0, W, H); return; }
      const faded = this.mode === "overlay" && this.theme !== "night";
      if (faded) c.filter = "grayscale(1) brightness(1.3) contrast(0.8)";
      c.drawImage(v, 0, 0, pw, vh, 0, 0, W, H);
      if (faded) c.filter = "none";
      if (this.mode === "wipe") {
        const x = Math.round(this.split * W);
        c.save(); c.beginPath(); c.rect(x, 0, W - x, H); c.clip();
        c.drawImage(v, pw, 0, pw, vh, 0, 0, W, H); c.restore();
        c.fillStyle = this.theme === "night" ? "#E9E6DF" : "#2A2A28";
        c.fillRect(x - 1, 0, 2, H);
        c.beginPath(); c.arc(x, H / 2, 14, 0, 6.283); c.fill();
        c.fillStyle = this.theme === "night" ? "#000" : "#EEE8DC";
        c.beginPath(); c.moveTo(x - 7, H / 2); c.lineTo(x - 2, H / 2 - 5); c.lineTo(x - 2, H / 2 + 5); c.fill();
        c.beginPath(); c.moveTo(x + 7, H / 2); c.lineTo(x + 2, H / 2 - 5); c.lineTo(x + 2, H / 2 + 5); c.fill();
      } else {
        c.globalCompositeOperation = this.theme === "night" ? "screen" : "multiply";
        c.drawImage(v, pw, 0, pw, vh, 0, 0, W, H);
        c.globalCompositeOperation = "source-over";
      }
    }
    tick() {
      const v = this.video;
      if (v.paused || v.ended) return;
      this.draw();
      if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(() => this.tick());
      else requestAnimationFrame(() => this.tick());
    }
    play(user) {
      players.forEach(p => { if (p !== this) p.pause(); });
      if (this.video.preload !== "auto") this.video.preload = "auto";
      this.userPaused = false;
      this.video.play().catch(() => { if (this.hint) this.hint.hidden = false; });
    }
    pause(user = true) { this.userPaused = user; this.video.pause(); }
  }

  document.querySelectorAll("[data-film]").forEach(el => players.push(new Film(el)));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const p = players.find(p => p.root === e.target);
      if (!p) return;
      p.visible = e.isIntersecting;
      if (e.isIntersecting && !p.userPaused && players.every(q => q === p || q.video.paused)) p.play();
      if (!e.isIntersecting && !p.video.paused) p.pause(false);
    }), { threshold: 0.55 });
    players.forEach(p => io.observe(p.root));
  }
})();
