(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const projects = window.PROJECTS;

  /* ---------- Compile intro, once per visit ---------- */
  function boot() {
    let seen = false;
    try { seen = sessionStorage.getItem("booted"); sessionStorage.setItem("booted", "1"); } catch {}
    if (seen || reduced) return;
    const box = el("div", { className: "boot" });
    box.setAttribute("aria-hidden", "true");
    document.body.append(box);
    const lines = ["compile zm_klevi.map", "  bsp ........ ok", "  vis ........ ok", "  light ...... ok", "  linking fastfile", "<b>launching</b>"];
    let i = 0;
    const t = setInterval(() => {
      box.innerHTML += lines[i++] + "\n";
      if (i === lines.length) {
        clearInterval(t);
        setTimeout(() => { box.style.opacity = 0; setTimeout(() => box.remove(), 260); }, 170);
      }
    }, 95);
  }
  boot();

  /* ---------- Hero: Radiant XY view with a Zombies round ---------- */
  function hero() {
    const section = $("#hero"), canvas = $("#game"), ctx = canvas.getContext("2d");
    const tallyEl = $("#tally"), scoreEl = $("#score"), msgEl = $("#hudMsg");
    const CELL = 32, MAJOR = 128, RED = "#e5392b", ENT = "#4fd6a8";
    let w = 0, h = 0, player = { x: 0, y: 0 };
    let mode = "attract", round = 1, score = 0, toSpawn = 0, spawnT = 0, autoT = 0;
    let zombies = [], shots = [], pops = [], last = 0, running = false, flash = 0;

    const BRUSHES = [
      [.36, .1, .25, .3], [.61, .1, .3, .2], [.72, .3, .19, .4], [.54, .5, .18, .32],
      [.86, .7, .14, .26], [.42, .2, .06, .05], [.78, .42, .05, .08],
    ];

    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = section.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      player = w > 900 ? { x: w * .74, y: h * .52 } : { x: w * .4, y: h * .3 };
    }

    function tally() {
      tallyEl.textContent = "";
      if (round > 10) { tallyEl.textContent = round; return; }
      for (let left = round; left > 0; left -= 5) {
        const g = el("span", { className: "tally" });
        for (let i = 0; i < Math.min(left, 4); i++) g.append(el("i"));
        if (left >= 5) g.append(el("b"));
        tallyEl.append(g);
      }
    }

    function startRound(n) {
      round = n;
      toSpawn = mode === "play" ? 3 + n * 2 : 99999;
      tally();
    }

    function spawn() {
      const side = Math.random();
      let x, y;
      if (side < .4) { x = w + 14; y = Math.random() * h; }
      else if (side < .7) { x = w * (.35 + Math.random() * .65); y = -14; }
      else { x = w * (.4 + Math.random() * .6); y = h + 14; }
      const base = mode === "play" ? 26 + round * 7 : 26;
      zombies.push({ x, y, v: base * (.8 + Math.random() * .4), wob: Math.random() * 6.28, hp: 1 });
    }

    function kill(z) {
      zombies = zombies.filter((o) => o !== z);
      if (mode === "play") {
        score += 100;
        scoreEl.textContent = score;
        pops.push({ x: z.x, y: z.y - 12, t: 0 });
      }
    }

    function shoot(x, y) {
      shots.push({ x, y, t: 0 });
      let hit = null, best = 26;
      for (const z of zombies) {
        const d = Math.hypot(z.x - x, z.y - y);
        if (d < best) { best = d; hit = z; }
      }
      if (hit) kill(hit);
    }

    function step(dt) {
      if (toSpawn > 0 && zombies.length < (mode === "play" ? 6 + round : 5)) {
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); toSpawn--; spawnT = mode === "play" ? Math.max(.25, 1 - round * .07) : 1.3; }
      }
      for (const z of zombies) {
        z.wob += dt * 3;
        const dx = player.x - z.x, dy = player.y - z.y, d = Math.hypot(dx, dy) || 1;
        z.x += (dx / d) * z.v * dt - (dy / d) * Math.sin(z.wob) * 9 * dt;
        z.y += (dy / d) * z.v * dt + (dx / d) * Math.sin(z.wob) * 9 * dt;
        z.d = d;
      }
      if (mode === "attract") {
        autoT -= dt;
        if (autoT <= 0) {
          const near = zombies.filter((z) => z.d < 240).sort((a, b) => a.d - b.d)[0];
          if (near) shoot(near.x, near.y);
          autoT = 1.1;
        }
      } else {
        if (zombies.some((z) => z.d < 16)) {
          flash = 1;
          msgEl.textContent = `Downed on round ${round}. Click to restart`;
          mode = "attract"; zombies = []; startRound(round);
          return;
        }
        if (toSpawn === 0 && zombies.length === 0) {
          startRound(round + 1);
          msgEl.textContent = `Round ${round}`;
        }
      }
      shots.forEach((s) => (s.t += dt)); shots = shots.filter((s) => s.t < .13);
      pops.forEach((p) => (p.t += dt)); pops = pops.filter((p) => p.t < .8);
      flash = Math.max(0, flash - dt * 1.6);
    }

    function draw() {
      ctx.fillStyle = "#0f0f0e";
      ctx.fillRect(0, 0, w, h);
      const ox = player.x % CELL, oy = player.y % CELL;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#191918";
      ctx.beginPath();
      for (let x = ox; x < w; x += CELL) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      for (let y = oy; y < h; y += CELL) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
      ctx.stroke();
      const mx = player.x % MAJOR, my = player.y % MAJOR;
      ctx.strokeStyle = "#262624";
      ctx.beginPath();
      for (let x = mx; x < w; x += MAJOR) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      for (let y = my; y < h; y += MAJOR) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
      ctx.stroke();

      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "#3f6b58";
      ctx.textAlign = "left";
      for (let x = mx; x < w; x += MAJOR) ctx.fillText(Math.round((x - player.x) * 2), x + 4, 60);
      for (let y = my; y < h; y += MAJOR) if (y > 70) ctx.fillText(Math.round((player.y - y) * 2), 6, y - 4);

      ctx.strokeStyle = "rgba(92, 122, 240, .55)";
      ctx.lineWidth = 1.5;
      for (const [x, y, bw, bh] of BRUSHES) ctx.strokeRect(x * w, y * h, bw * w, bh * h);

      ctx.setLineDash([]);
      for (const z of zombies) {
        ctx.strokeStyle = "rgba(229, 57, 43, .45)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(player.x, player.y); ctx.stroke();
        ctx.strokeStyle = RED; ctx.lineWidth = 2;
        ctx.strokeRect(z.x - 7, z.y - 7, 14, 14);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(z.x - 4, z.y); ctx.lineTo(z.x + 4, z.y); ctx.moveTo(z.x, z.y - 4); ctx.lineTo(z.x, z.y + 4); ctx.stroke();
        ctx.fillStyle = ENT; ctx.fillText("actor_zombie", z.x + 12, z.y + 4);
      }

      for (const s of shots) {
        ctx.strokeStyle = `rgba(255, 215, 106, ${1 - s.t / .13})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      }

      const a = zombies.length ? Math.atan2(zombies[0].y - player.y, zombies[0].x - player.x) : -1.57;
      ctx.strokeStyle = RED; ctx.lineWidth = 2;
      ctx.strokeRect(player.x - 11, player.y - 11, 22, 22);
      ctx.strokeStyle = "#7f97ff"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(a - .5) * 42, player.y + Math.sin(a - .5) * 42);
      ctx.lineTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(a + .5) * 42, player.y + Math.sin(a + .5) * 42);
      ctx.stroke();
      ctx.fillStyle = ENT; ctx.fillText("info_player_start", player.x + 18, player.y + 24);

      ctx.textAlign = "center";
      ctx.font = "600 14px 'IBM Plex Mono', monospace";
      for (const p of pops) {
        ctx.fillStyle = `rgba(255, 215, 106, ${1 - p.t / .8})`;
        ctx.fillText("+100", p.x, p.y - p.t * 34);
      }
      ctx.textAlign = "left";

      if (flash > 0) { ctx.fillStyle = `rgba(150, 10, 5, ${flash * .55})`; ctx.fillRect(0, 0, w, h); }
    }

    function frame(t) {
      if (!running) return;
      step(Math.min((t - last) / 1000 || 0, .05));
      last = t;
      draw();
      requestAnimationFrame(frame);
    }

    section.addEventListener("click", (e) => {
      if (reduced || e.target.closest("a, button")) return;
      const r = canvas.getBoundingClientRect();
      if (mode === "attract") {
        mode = "play"; score = 0; scoreEl.textContent = 0;
        zombies = []; msgEl.textContent = "Round 1"; spawnT = 0;
        startRound(1);
        return;
      }
      shoot(e.clientX - r.left, e.clientY - r.top);
    });

    size();
    tally();
    addEventListener("resize", () => { size(); if (reduced) draw(); });
    if (reduced) {
      msgEl.textContent = "";
      zombies = [{ x: w * .6, y: h * .22 }, { x: w * .9, y: h * .4 }, { x: w * .82, y: h * .8 }];
      draw();
      return;
    }
    startRound(1);
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!en.isIntersecting) running = false;
    }).observe(section);
  }
  hero();

  /* ---------- Project grid and filters ---------- */
  const FILTERS = [["all", "All"], ["unreal", "Unreal"], ["unity", "Unity"], ["mods", "CoD mods"], ["web", "Web"]];
  const grid = $("#grid"), filters = $("#filters");

  function cardFor(p) {
    const img = el("img", { src: p.images[0], alt: "", loading: "lazy" });
    const b = el("button", { className: "card" + (p.size === "wide" ? " card--wide" : ""), type: "button" },
      el("span", { className: "card__sel", textContent: "selected" }),
      el("span", { className: "card__img" }, img),
      el("span", { className: "card__meta" },
        el("span", { className: "card__tag", textContent: p.tag }),
        el("span", { className: "card__title", textContent: p.title })));
    b.style.display = "block";
    b.dataset.open = p.id;
    return b;
  }

  function renderGrid(f) {
    grid.textContent = "";
    projects.filter((p) => f === "all" || p.cats.includes(f)).forEach((p) => grid.append(cardFor(p)));
  }

  FILTERS.forEach(([key, label]) => {
    const n = key === "all" ? projects.length : projects.filter((p) => p.cats.includes(key)).length;
    const b = el("button", { type: "button" }, label, el("sup", { textContent: n }));
    b.setAttribute("aria-pressed", key === "all");
    b.addEventListener("click", () => {
      $$("button", filters).forEach((o) => o.setAttribute("aria-pressed", o === b));
      renderGrid(key);
    });
    filters.append(b);
  });
  renderGrid("all");

  /* ---------- Project modal ---------- */
  const modal = $("#modal"), mImg = $("#mImg"), mThumbs = $("#mThumbs");
  let current = null, idx = 0;

  function showImage(i) {
    idx = (i + current.images.length) % current.images.length;
    mImg.src = current.images[idx];
    mImg.alt = `${current.title} screenshot ${idx + 1} of ${current.images.length}`;
    $$("button", mThumbs).forEach((b, n) => b.setAttribute("aria-current", n === idx));
  }

  function openProject(id) {
    current = projects.find((p) => p.id === id);
    if (!current) return;
    $("#mTag").textContent = current.tag;
    $("#mTitle").textContent = current.title;
    $("#mRole").textContent = current.role;
    $("#mBlurb").textContent = current.blurb;
    $("#mTools").replaceChildren(...current.tools.map((t) => el("li", { textContent: t })));
    $("#mLinks").replaceChildren(...current.links.map(([label, href], i) =>
      el("a", { className: "btn" + (i === 0 ? " btn--solid" : ""), href, target: "_blank", rel: "noopener", textContent: label })));
    mThumbs.replaceChildren(...current.images.map((src, i) => {
      const b = el("button", { type: "button", ariaLabel: `Show image ${i + 1}` }, el("img", { src, alt: "" }));
      b.addEventListener("click", () => showImage(i));
      return b;
    }));
    const multi = current.images.length > 1;
    $("#mPrev").hidden = $("#mNext").hidden = !multi;
    showImage(0);
    modal.showModal();
    $(".modal__info").scrollTop = 0;
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open]");
    if (t) openProject(t.dataset.open);
  });
  $("#mClose").addEventListener("click", () => modal.close());
  $("#mPrev").addEventListener("click", () => showImage(idx - 1));
  $("#mNext").addEventListener("click", () => showImage(idx + 1));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  modal.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") showImage(idx - 1);
    if (e.key === "ArrowRight") showImage(idx + 1);
  });

  /* ---------- Status bar ---------- */
  const coords = $("#coords"), entity = $("#entity");
  addEventListener("mousemove", (e) => {
    const x = e.clientX - innerWidth / 2, y = -(e.clientY + scrollY);
    coords.textContent = `x: ${x.toFixed(1)}  y: ${y.toFixed(1)}  z: 0.0`;
  }, { passive: true });
  const spy = new IntersectionObserver((ens) => {
    ens.forEach((en) => { if (en.isIntersecting) entity.textContent = "entity: " + en.target.dataset.entity; });
  }, { rootMargin: "-50% 0px -50% 0px" });
  $$("[data-entity]").forEach((s) => spy.observe(s));

  /* ---------- Easter egg ---------- */
  const toast = $("#toast");
  let toastT;
  function say(msg, ms = 2600) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove("show"), ms);
  }
  let found = 0;
  $$(".egg").forEach((egg) => egg.addEventListener("click", () => {
    if (egg.classList.contains("found")) return;
    egg.classList.add("found");
    found++;
    $("#eggs").textContent = `objects: ${found}/3`;
    if (found < 3) say(`Object ${found} of 3 found`);
    else {
      document.body.classList.add("punched");
      say("Easter egg complete. This portfolio has been Pack-a-Punched.", 5000);
    }
  }));

  /* ---------- Section reveal ---------- */
  if (!reduced && "IntersectionObserver" in window) {
    const targets = $$(".feature__grid, .head, .filters, .grid, .timeline > li, .about__grid, .contact .wrap");
    const io = new IntersectionObserver((ens) => {
      ens.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((t) => { t.classList.add("reveal"); io.observe(t); });
  }
})();
