/*
  Behaviour for /work. All content lives in index.html: this script reads the cells
  from the page, so adding, removing or reordering a work never needs a change here.

  1. Viewer  a cell opens the film in a full-screen player; /work#<id> links straight to it.
  2. Sheet   every cell hard-cuts between its three frames; the one under the cursor holds.
  3. Crafts  "Edited / Shot / Directed" in the header count the work and dim the rest.
  4. Grain   one noise tile, drawn once, drifting over the page.
*/
(function () {
  "use strict";

  var BEAT = 700;   // milliseconds each frame stays up; three frames make a 2.1 s loop

  var links = [].slice.call(document.querySelectorAll(".sheet .cell"));
  if (!links.length) return;

  function txt(root, sel) {
    var n = root.querySelector(sel);
    return n ? n.textContent.trim() : "";
  }

  var works = links.map(function (a) {
    return {
      el: a,
      slug: a.id,
      title: txt(a, ".t"),
      role: txt(a, ".r"),
      note: a.dataset.note || "",
      host: a.dataset.host,
      id: a.dataset.id,
      start: a.dataset.start || "",
      crafts: (a.dataset.crafts || "").split(/\s+/).filter(Boolean),
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
        "?autoplay=1&dnt=1&title=0&byline=0&portrait=0&color=86c2ad";
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

  works.forEach(function (w, i) {
    w.el.addEventListener("click", function (e) {
      if (!plainClick(e)) return;   // cmd-click and friends still open YouTube or Vimeo in a new tab
      e.preventDefault();
      openViewer(i, "push");
    });
  });

  /* ------------------------------------------------------------------- sheet */

  var motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var holdBtn = document.querySelector('[data-act="hold"]');
  var held = false;   // the Pause button

  function setUpCell(w, i) {
    var pic = w.el.querySelector(".pic");
    var first = pic.querySelector("img");
    var count = Math.max(1, parseInt(w.el.dataset.frames || "3", 10));
    var narrow = w.el.dataset.aspect === "4:3";
    var small = narrow ? 360 : 480;

    w.imgs = [first];
    w.cur = 0;
    w.frozen = false;
    w.seen = true;
    w.offset = ((i * 0.618034) % 1) * BEAT;   // every cell cuts at its own moment

    for (var k = 2; k <= count; k++) {
      (function (k) {
        var base = "/work/frames/" + w.slug + "-" + k;
        var im = new Image();
        im.alt = "";
        im.decoding = "async";
        im.width = first.width;
        im.height = first.height;
        im.sizes = first.sizes;
        im.srcset = base + "-s.webp " + small + "w, " + base + ".webp " + (small * 2) + "w";
        im.onload = function () { w.imgs[k - 1] = im; };   // a frame joins the loop once it has arrived
        im.src = base + "-s.webp";
        pic.appendChild(im);
      })(k);
    }

    w.el.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") w.frozen = true;
    });
    w.el.addEventListener("pointerleave", function () { w.frozen = false; });
    w.el.addEventListener("focus", function () {
      try { w.frozen = w.el.matches(":focus-visible"); } catch (err) { w.frozen = false; }
    });
    w.el.addEventListener("blur", function () { w.frozen = false; });
  }

  function cut(now) {
    if (!held && !(canModal && dlg.open)) {
      for (var i = 0; i < works.length; i++) {
        var w = works[i];
        if (w.frozen || !w.seen) continue;
        var beat = Math.floor((now + w.offset) / BEAT);
        if (beat === w.beat) continue;
        w.beat = beat;
        var ready = w.imgs.filter(Boolean);
        if (ready.length < 2) continue;
        var next = ready[beat % ready.length];
        if (next !== w.shown) {
          if (w.shown) w.shown.classList.remove("on"); else w.imgs[0].classList.remove("on");
          next.classList.add("on");
          w.shown = next;
        }
      }
    }
    window.requestAnimationFrame(cut);
  }

  if (motionOK) {
    works.forEach(setUpCell);

    if ("IntersectionObserver" in window) {
      var seen = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { works[bySlug[en.target.id]].seen = en.isIntersecting; });
      }, { rootMargin: "120px" });
      works.forEach(function (w) { seen.observe(w.el); });
    }

    if (holdBtn) {
      holdBtn.hidden = false;
      holdBtn.addEventListener("click", function () {
        held = !held;
        holdBtn.textContent = held ? "Play" : "Pause";
      });
    }
    window.requestAnimationFrame(cut);
  }

  /* ------------------------------------------------------------------ crafts */

  var sheet = document.querySelector(".sheet");
  var craftBtns = [].slice.call(document.querySelectorAll(".crafts button"));
  var locked = "";

  function sortBy(craft) {
    var total = 0;
    works.forEach(function (w) {
      var isIn = !craft || w.crafts.indexOf(craft) >= 0;
      w.el.classList.toggle("is-in", isIn);
      if (isIn) total++;
    });
    sheet.classList.toggle("is-sorted", !!craft && total < works.length);
  }

  craftBtns.forEach(function (b) {
    var craft = b.dataset.craft;
    var n = works.filter(function (w) { return w.crafts.indexOf(craft) >= 0; }).length;
    var badge = b.querySelector("i");
    if (badge) badge.textContent = String(n);

    b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") sortBy(craft); });
    b.addEventListener("pointerleave", function () { sortBy(locked); });
    b.addEventListener("click", function () {
      locked = locked === craft ? "" : craft;
      craftBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.craft === locked)); });
      sortBy(locked);
    });
  });

  /* ------------------------------------------------------------------- grain */

  (function () {
    var layer = document.querySelector(".grain");
    if (!layer) return;
    var n = 240;
    var c = document.createElement("canvas");
    c.width = c.height = n;
    var ctx = c.getContext("2d");
    if (!ctx) return;
    var d = ctx.createImageData(n, n);
    var p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      var r = Math.random();
      var light = Math.random() < 0.5;
      p[i] = p[i + 1] = p[i + 2] = light ? 255 : 0;
      p[i + 3] = (light ? 15 : 26) * r * r;   // mostly faint, a few stronger specks
    }
    ctx.putImageData(d, 0, 0);
    layer.style.backgroundImage = "url(" + c.toDataURL("image/png") + ")";
    layer.style.backgroundSize = n + "px " + n + "px";
  })();

  /* --------------------------------------------- a link straight to one film */

  var asked = decodeURIComponent(window.location.hash.slice(1));
  if (canModal && asked in bySlug) openViewer(bySlug[asked], "replace");
})();
