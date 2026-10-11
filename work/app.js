/*
  Behaviour for /work. All content lives in index.html: this script reads the tiles
  from the page, so adding, removing or reordering a work never needs a change here.

  1. Viewer   a tile opens the film in a full-screen player; /work#<id> links straight to it.
  2. Preview  the strip at the top hard-cuts through the stills; the bar under it can be
              skimmed with the mouse, dragged on a phone, or moved with the arrow keys.
*/
(function () {
  "use strict";

  var tiles = [].slice.call(document.querySelectorAll(".grid .tile"));
  if (!tiles.length) return;

  function txt(root, sel) {
    var n = root.querySelector(sel);
    return n ? n.textContent.trim() : "";
  }

  var works = tiles.map(function (a) {
    return {
      slug: a.id,
      title: txt(a, ".t"),
      role: txt(a, ".r"),
      note: txt(a, ".n"),
      host: a.dataset.host,
      id: a.dataset.id,
      start: a.dataset.start || "",
      focus: a.dataset.focus || "50% 42%",
      href: a.href
    };
  });
  var bySlug = Object.create(null);
  works.forEach(function (w, i) { bySlug[w.slug] = i; });

  function plainClick(e) {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }

  /* ------------------------------------------------------------------ viewer */

  var dlg = document.querySelector("dialog.viewer");
  var canModal = !!dlg && typeof dlg.showModal === "function";
  var vTitle, vRole, vNote, vLink, vPlayer;
  var current = -1;            // index of the film in the viewer, -1 when closed
  var pushed = false;          // opening the viewer added a history entry
  var closedByHistory = false; // the browser's Back button is closing the viewer

  if (canModal) {
    vTitle = dlg.querySelector(".v-title");
    vRole = dlg.querySelector(".v-role");
    vNote = dlg.querySelector(".v-note");
    vLink = dlg.querySelector(".v-link");
    vPlayer = dlg.querySelector(".v-player");
  }

  function embedUrl(w) {
    if (w.host === "vimeo") {
      return "https://player.vimeo.com/video/" + encodeURIComponent(w.id) +
        "?autoplay=1&dnt=1&title=0&byline=0&portrait=0&color=ffb36b";
    }
    return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(w.id) +
      "?autoplay=1&rel=0&playsinline=1" + (w.start ? "&start=" + encodeURIComponent(w.start) : "");
  }

  function fill(i) {
    var w = works[i];
    current = i;
    vTitle.textContent = w.title;
    vRole.textContent = w.role;
    vNote.textContent = w.note;
    vNote.hidden = !w.note;
    vLink.href = w.href;
    vLink.textContent = w.host === "vimeo" ? "Watch on Vimeo" : "Watch on YouTube";

    var f = document.createElement("iframe");
    f.title = w.title;
    f.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    f.allowFullscreen = true;
    f.referrerPolicy = "strict-origin-when-cross-origin";
    f.src = embedUrl(w);
    vPlayer.replaceChildren(f);
  }

  // how: "push" a person opened it, "replace" a link straight to a film, "none" Back/Forward
  function openViewer(i, how) {
    if (!canModal) { window.location.href = works[i].href; return; }
    fill(i);
    if (!dlg.open) dlg.showModal();
    var url = "#" + works[i].slug;
    if (how === "push") {
      pushed = true;
      history.pushState({ work: works[i].slug, pushed: true }, "", url);
    } else if (how === "replace") {
      history.replaceState({ work: works[i].slug, pushed: pushed }, "", url);
    }
    reelSync();
  }

  function step(d) {
    if (current < 0) return;
    var i = (current + d + works.length) % works.length;
    fill(i);
    history.replaceState({ work: works[i].slug, pushed: pushed }, "", "#" + works[i].slug);
  }

  if (canModal) {
    dlg.addEventListener("close", function () {
      vPlayer.replaceChildren();   // removing the player stops the sound
      current = -1;
      if (closedByHistory) {
        closedByHistory = false;
        pushed = false;
      } else if (pushed) {
        pushed = false;
        history.back();
      } else {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      reelSync();
    });

    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "close") dlg.close();
      else if (b.dataset.act === "prev") step(-1);
      else if (b.dataset.act === "next") step(1);
    });

    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });

    window.addEventListener("popstate", function (e) {
      var slug = (e.state && e.state.work) || decodeURIComponent(window.location.hash.slice(1));
      if (slug in bySlug) {
        pushed = !!(e.state && e.state.pushed);
        openViewer(bySlug[slug], "none");
      } else if (dlg.open) {
        closedByHistory = true;
        dlg.close();
      }
    });
  }

  tiles.forEach(function (a, i) {
    a.addEventListener("click", function (e) {
      if (!plainClick(e)) return;   // cmd-click and friends still open YouTube or Vimeo in a new tab
      e.preventDefault();
      openViewer(i, "push");
    });
  });

  /* ----------------------------------------------------------------- preview */

  var reel = document.querySelector(".reel");
  var frame = reel.querySelector(".reel-frame");
  var still = frame.querySelector("img");
  var bar = reel.querySelector(".reel-bar");
  var meta = reel.querySelector(".reel-meta");
  var nowTitle = reel.querySelector(".now-title");
  var nowRole = reel.querySelector(".now-role");
  var holdBtn = reel.querySelector('[data-act="hold"]');
  var playBtn = reel.querySelector('[data-act="play"]');

  var BEAT = 2400;   // keep in step with --beat in the stylesheet
  var idx = 0;
  var timer = 0;
  var releaseTimer = 0;
  var overBar = false;
  var overFrame = false;
  var touching = false;
  var lastPointer = "mouse";
  var paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var big = window.innerWidth * (window.devicePixelRatio || 1) > 800;
  var loads = [];

  function posterUrl(w) {
    return "/work/posters/" + w.slug + (big ? "" : "-640") + ".webp";
  }

  function preload(i) {
    if (!loads[i]) {
      loads[i] = new Promise(function (done) {
        var im = new Image();
        im.onload = im.onerror = function () { done(); };
        im.src = posterUrl(works[i]);
      });
    }
    return loads[i];
  }

  var segs = works.map(function () {
    var s = document.createElement("span");
    s.className = "seg";
    bar.appendChild(s);
    return s;
  });

  var range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = String(works.length - 1);
  range.step = "1";
  range.value = "0";
  range.setAttribute("aria-label", "Scrub through the work");
  bar.appendChild(range);

  function show(i) {
    idx = (i + works.length) % works.length;
    var w = works[idx];
    if (still.hasAttribute("srcset")) {
      still.removeAttribute("srcset");
      still.removeAttribute("sizes");
    }
    still.src = posterUrl(w);
    frame.style.setProperty("--focus", w.focus);
    frame.href = "#" + w.slug;
    frame.setAttribute("aria-label", "Play " + w.title);
    nowTitle.textContent = w.title;
    nowRole.textContent = w.role;
    segs.forEach(function (s, k) { s.classList.toggle("is-on", k === idx); });
    range.value = String(idx);
    range.setAttribute("aria-valuetext", w.title);
    preload((idx + 1) % works.length);
  }

  function keyboardOnBar() {
    try { return range.matches(":focus-visible"); } catch (err) { return false; }
  }

  function running() {
    return !paused && !overBar && !overFrame && !touching && !keyboardOnBar() &&
      !document.hidden && !(canModal && dlg.open);
  }

  function reelSync() {
    clearTimeout(timer);
    var go = running();
    reel.classList.toggle("is-held", !go);
    if (!go) return;
    timer = setTimeout(function () {
      var next = (idx + 1) % works.length;
      preload(next).then(function () {
        if (running()) show(next);
        reelSync();
      });
    }, BEAT);
  }

  function indexAt(x) {
    var a = segs[0].getBoundingClientRect();
    var b = segs[segs.length - 1].getBoundingClientRect();
    var t = (x - a.left) / (b.right - a.left);
    return Math.max(0, Math.min(works.length - 1, Math.floor(t * works.length)));
  }

  // mouse: skim across the bar, the still follows; click plays the one under the cursor
  bar.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var i = indexAt(e.clientX);
    if (!overBar || i !== idx) {
      overBar = true;
      if (i !== idx) show(i);
      reelSync();
    }
  });
  bar.addEventListener("pointerleave", function () {
    if (!overBar) return;
    overBar = false;
    reelSync();
  });

  // touch: drag along the bar; the cut resumes a moment after the finger lifts
  bar.addEventListener("pointerdown", function (e) {
    lastPointer = e.pointerType;
    if (e.pointerType === "mouse") return;
    touching = true;
    clearTimeout(releaseTimer);
    reelSync();
  });
  function release() {
    if (!touching) return;
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(function () { touching = false; reelSync(); }, 1600);
  }
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  range.addEventListener("input", function () {
    var i = Number(range.value);
    if (i !== idx) show(i);
    reelSync();
  });
  range.addEventListener("click", function () {
    if (lastPointer === "mouse") openViewer(idx, "push");
  });
  range.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); openViewer(idx, "push"); }
  });
  range.addEventListener("focus", reelSync);
  range.addEventListener("blur", reelSync);

  frame.addEventListener("pointerenter", function (e) {
    if (e.pointerType !== "mouse") return;
    overFrame = true;   // the still must not change under a cursor that is about to click
    reelSync();
  });
  frame.addEventListener("pointerleave", function () {
    if (!overFrame) return;
    overFrame = false;
    reelSync();
  });
  frame.addEventListener("click", function (e) {
    if (!plainClick(e)) return;
    e.preventDefault();
    openViewer(idx, "push");
  });

  playBtn.addEventListener("click", function () { openViewer(idx, "push"); });
  holdBtn.addEventListener("click", function () {
    paused = !paused;
    holdBtn.textContent = paused ? "Resume" : "Pause";
    reelSync();
  });
  document.addEventListener("visibilitychange", reelSync);

  bar.hidden = false;
  meta.hidden = false;
  if (paused) holdBtn.textContent = "Resume";
  show(0);
  reelSync();

  /* --------------------------------------------- a link straight to one film */

  var asked = decodeURIComponent(window.location.hash.slice(1));
  if (canModal && asked in bySlug) openViewer(bySlug[asked], "replace");
})();
