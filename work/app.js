/*
  Behaviour for /work. All content lives in index.html: this script reads the cells
  from the page, so adding, removing or reordering a work never needs a change here.

  1. Viewer  a cell opens the film in a full-screen player; /work#<id> links straight to it.
  2. Sheet   cells are still; the one under the cursor plays its fragment, or, where there
             is no fragment yet, cuts between its three frames.
  3. Crafts  "Directed / Shot / Edited / Generated" in the header count the work and dim the
             rest; the left and right arrow keys step through them.
  4. Grain   one noise tile, drawn once, shifting slowly over the page.
*/
(function () {
  "use strict";

  var BEAT = 700;   // milliseconds each frame stays up when a cell cuts between frames

  var links = [].slice.call(document.querySelectorAll(".sheet .cell"));
  if (!links.length) return;

  function txt(root, sel) {
    var n = root.querySelector(sel);
    return n ? n.textContent.trim() : "";
  }

  function ratio(s) {   // "4:3" -> 1.3333
    var m = /^(\d+(?:\.\d+)?)\s*[:\/x]\s*(\d+(?:\.\d+)?)$/.exec(s || "");
    return m ? Number(m[1]) / Number(m[2]) : 16 / 9;
  }

  var works = links.map(function (a) {
    var d = a.dataset;
    return {
      el: a,
      slug: a.id,
      title: txt(a, ".t"),
      role: txt(a, ".r"),
      note: d.note || "",
      host: d.host,
      id: d.id,
      hash: d.hash || "",   // unlisted Vimeo films
      start: d.start || "",
      file: d.file || "",
      ratio: ratio(d.ratio),
      label: d.label || "",
      altFile: d.altFile || "",
      altRatio: ratio(d.altRatio),
      altLabel: d.altLabel || "",
      clip: d.clip || "",
      crafts: (d.crafts || "").split(/\s+/).filter(Boolean),
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
  var vTitle, vRole, vNote, vLink, vAlt, vPlayer;
  var current = -1;            // index of the film in the viewer, -1 when closed
  var onAlt = false;           // the second cut of the film is showing
  var pushed = false;          // opening the viewer added a history entry
  var closedByHistory = false; // the browser's Back button is closing the viewer

  if (canModal) {
    vTitle = dlg.querySelector(".v-title");
    vRole = dlg.querySelector(".v-role");
    vNote = dlg.querySelector(".v-note");
    vLink = dlg.querySelector(".v-link");
    vAlt = dlg.querySelector(".v-alt");
    vPlayer = dlg.querySelector(".v-player");
  }

  function embedUrl(w) {
    if (w.host === "vimeo") {
      return "https://player.vimeo.com/video/" + encodeURIComponent(w.id) +
        "?" + (w.hash ? "h=" + encodeURIComponent(w.hash) + "&" : "") +
        "autoplay=1&dnt=1&title=0&byline=0&portrait=0&color=86c2ad";
    }
    return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(w.id) +
      "?autoplay=1&rel=0&playsinline=1" + (w.start ? "&start=" + encodeURIComponent(w.start) : "");
  }

  function fill(i, alt) {
    var w = works[i];
    current = i;
    onAlt = !!alt && !!w.altFile;
    vTitle.textContent = w.title;
    vRole.textContent = w.role;
    vNote.textContent = w.note;
    vNote.hidden = !w.note;

    if (w.host === "file") {
      vLink.hidden = true;
      vAlt.hidden = !w.altFile;
      if (w.altFile) vAlt.textContent = "Watch the " + (onAlt ? w.label : w.altLabel);
      vPlayer.style.setProperty("--r", String(onAlt ? w.altRatio : w.ratio));

      var v = document.createElement("video");
      v.controls = true;
      v.autoplay = true;
      v.preload = "auto";
      v.setAttribute("playsinline", "");
      v.src = onAlt ? w.altFile : w.file;
      vPlayer.replaceChildren(v);
      var p = v.play();
      if (p && p.catch) p.catch(function () {});   // a browser may refuse sound before a click; the controls remain
      return;
    }

    vAlt.hidden = true;
    vLink.hidden = false;
    vLink.href = w.href;
    vLink.textContent = w.host === "vimeo" ? "Watch on Vimeo" : "Watch on YouTube";
    vPlayer.style.setProperty("--r", String(16 / 9));

    var f = document.createElement("iframe");
    f.title = w.title;
    f.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    f.allowFullscreen = true;
    f.referrerPolicy = "strict-origin-when-cross-origin";
    f.src = embedUrl(w);
    vPlayer.replaceChildren(f);
  }

  // an upright phone gets the upright cut first, where a film has one
  function preferAlt(w) {
    return !!w.altFile && w.altRatio < 1 && window.innerHeight > window.innerWidth;
  }

  // how: "push" a person opened it, "replace" a link straight to a film, "none" Back/Forward
  function openViewer(i, how) {
    if (!canModal) { window.location.href = works[i].href; return; }
    works.forEach(rest);
    fill(i, preferAlt(works[i]));
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
    fill(i, preferAlt(works[i]));
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
      else if (b.dataset.act === "alt" && current >= 0) fill(current, !onAlt);
    });

    dlg.addEventListener("keydown", function (e) {
      if (e.target && e.target.tagName === "VIDEO") return;   // there the arrows scrub the film
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
      if (!plainClick(e)) return;   // cmd-click and friends still open the film in a new tab
      e.preventDefault();
      openViewer(i, "push");
    });
  });

  /* ------------------------------------------------------------------- sheet */

  var canHover = window.matchMedia("(hover: hover)").matches;

  works.forEach(function (w) {
    w.pic = w.el.querySelector(".pic");
    w.first = w.pic.querySelector("img");
    w.count = Math.max(1, parseInt(w.el.dataset.frames || "3", 10));
    w.frames = [w.first];
    w.shown = w.first;
    w.k = 0;
    w.timer = 0;
    w.video = null;
    w.active = false;
    w.warm = false;
  });

  // fetch what a cell needs to come alive: its fragment, or its other frames
  function warm(w) {
    if (w.warm) return;
    w.warm = true;

    if (w.clip) {
      var v = document.createElement("video");
      v.muted = true;
      v.loop = true;
      v.preload = "auto";
      v.tabIndex = -1;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("aria-hidden", "true");
      v.addEventListener("playing", function () { if (w.active) w.pic.classList.add("is-live"); });
      v.src = w.clip;
      w.pic.appendChild(v);
      w.video = v;
      return;
    }

    var narrow = w.el.dataset.aspect === "4:3";
    var small = narrow ? 360 : 480;
    for (var k = 2; k <= w.count; k++) {
      (function (k) {
        var base = "/work/frames/" + w.slug + "-" + k;
        var im = new Image();
        im.alt = "";
        im.decoding = "async";
        im.width = w.first.width;
        im.height = w.first.height;
        im.sizes = w.first.sizes;
        im.srcset = base + "-s.webp " + small + "w, " + base + ".webp " + (small * 2) + "w";
        im.onload = function () { w.frames[k - 1] = im; };   // a frame joins the loop once it has arrived
        im.src = base + "-s.webp";
        w.pic.appendChild(im);
      })(k);
    }
  }

  function show(w, img) {
    if (w.shown === img) return;
    w.shown.classList.remove("on");
    img.classList.add("on");
    w.shown = img;
  }

  function nextFrame(w) {
    var ready = w.frames.filter(Boolean);
    if (ready.length < 2) return;
    w.k = (w.k + 1) % ready.length;
    show(w, ready[w.k]);
  }

  function wake(w) {
    if (w.active) return;
    w.active = true;
    warm(w);
    if (w.video) {
      var p = w.video.play();
      if (p && p.catch) p.catch(function () {});
      return;
    }
    nextFrame(w);   // the first cut comes at once, so the cell answers the cursor
    w.timer = window.setInterval(function () { nextFrame(w); }, BEAT);
  }

  function rest(w) {
    if (!w.active) return;
    w.active = false;
    if (w.video) {
      w.video.pause();
      w.pic.classList.remove("is-live");
      try { w.video.currentTime = 0; } catch (err) { /* not loaded yet */ }
      return;
    }
    window.clearInterval(w.timer);
    w.timer = 0;
    w.k = 0;
    show(w, w.first);
  }

  works.forEach(function (w) {
    w.el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") wake(w); });
    w.el.addEventListener("pointerleave", function () { rest(w); });
    w.el.addEventListener("focus", function () {
      var byKeyboard = false;
      try { byKeyboard = w.el.matches(":focus-visible"); } catch (err) { byKeyboard = false; }
      if (byKeyboard) wake(w);
    });
    w.el.addEventListener("blur", function () { rest(w); });
  });

  // with a mouse around, load fragments and frames ahead of the first hover
  if (canHover) {
    var warmAll = function () { works.forEach(warm); };
    if (document.readyState === "complete") window.setTimeout(warmAll, 300);
    else window.addEventListener("load", function () { window.setTimeout(warmAll, 300); });
  }

  /* ------------------------------------------------------------------ crafts */

  var sheet = document.querySelector(".sheet");
  var craftBtns = [].slice.call(document.querySelectorAll(".crafts [data-craft]"));
  var craftOrder = craftBtns.map(function (b) { return b.dataset.craft; });
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

  function lock(craft) {
    locked = craft;
    craftBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.craft === locked)); });
    sortBy(locked);
  }

  // all → directed → shot → edited → generated → all …
  function stepCraft(d) {
    var n = craftOrder.length + 1;
    var at = craftOrder.indexOf(locked) + 1;   // 0 = everything
    var to = ((at + d) % n + n) % n;
    lock(to === 0 ? "" : craftOrder[to - 1]);
  }

  craftBtns.forEach(function (b) {
    var craft = b.dataset.craft;
    var n = works.filter(function (w) { return w.crafts.indexOf(craft) >= 0; }).length;
    var badge = b.querySelector("i");
    if (badge) badge.textContent = String(n);

    b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") sortBy(craft); });
    b.addEventListener("pointerleave", function () { sortBy(locked); });
    b.addEventListener("click", function () { lock(locked === craft ? "" : craft); });
  });


  document.addEventListener("keydown", function (e) {
    if (canModal && dlg.open) return;   // in the viewer the arrows change the film
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      stepCraft(e.key === "ArrowRight" ? 1 : -1);
    }
    else if (e.key === "Escape" && locked) lock("");
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
      p[i + 3] = (light ? 10 : 22) * r * r;   // mostly faint, a few stronger specks
    }
    ctx.putImageData(d, 0, 0);
    layer.style.backgroundImage = "url(" + c.toDataURL("image/png") + ")";
    layer.style.backgroundSize = n + "px " + n + "px";
  })();

  /* --------------------------------------------- a link straight to one film */

  var asked = decodeURIComponent(window.location.hash.slice(1));
  if (canModal && asked in bySlug) openViewer(bySlug[asked], "replace");
})();
