// Wallpaper preview: choose a motif and a colourway; one repeat is 53 × 53 cm at true scale.
(() => {
  const room = document.querySelector(".room");
  const wall = room.querySelector(".wall");
  const note = document.querySelector(".motif-note");
  const root = document.documentElement.dataset.root;
  const BG = { "graphite-cream": "#EEE8DC", "bone-black": "#121212", "ink-sage": "#B9C2B0" };
  function show() {
    const m = document.querySelector("input[name=motif]:checked");
    const c = document.querySelector("input[name=colourway]:checked").value;
    wall.style.backgroundImage = `url(${root}img/wall/${m.value}-${c}.webp)`;
    wall.style.backgroundColor = BG[c];
    room.classList.toggle("dark", c === "bone-black");
    note.textContent = m.dataset.note;
  }
  document.querySelectorAll(".pickers input").forEach(i => i.addEventListener("change", show));
  show();
})();
