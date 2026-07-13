/* =====================================================================
   ACADEMIA IA — Laboratorios interactivos
   Ejercicios prácticos que se ejecutan 100% en el navegador (sin backend).
   El de SQL injection es un SIMULADOR educativo: no hay base de datos real.
   Todo el contenido dinámico se construye con textContent / nodos DOM
   (nunca innerHTML), así el texto del usuario no puede inyectar HTML.
   ===================================================================== */

/* ---------------------------------------------------------------------
   LAB 1 · SQL INJECTION
   El usuario prueba una inyección en un login ficticio, ve cómo rompe la
   versión "vulnerable" y cómo la versión "segura" (parametrizada) la bloquea.
--------------------------------------------------------------------- */
(function sqlInjectionLab() {
  const lab = document.querySelector(".sqlab");
  if (!lab) return;

  const userEl = lab.querySelector('[data-sql="user"]');
  const passEl = lab.querySelector('[data-sql="pass"]');
  const queryEl = lab.querySelector(".sqlab__query");
  const resultEl = lab.querySelector(".sqlab__result");
  const modeBtns = lab.querySelectorAll(".sqlab__mode-btn");
  const chips = lab.querySelectorAll(".sqlab__chip");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");
  const lesson = lab.querySelector(".sqlab__lesson");

  const VALID = { user: "admin", pass: "admin123" };
  let mode = "vulnerable";
  let sawInjection = false;
  let sawBlocked = false;

  // Detecta patrones clásicos de inyección: comilla + (OR / comentario)
  function isInjection(v) {
    const s = v.toLowerCase();
    const hasQuote = /['"]/.test(s);
    const orClause = /\bor\b/.test(s);
    const comment = /--|#|\/\*/.test(s);
    return hasQuote && (orClause || comment);
  }

  // Construye el bloque de consulta con nodos DOM seguros.
  // parts = array de strings (texto plano) o [clase, texto] (span coloreado).
  function setQuery(parts) {
    const frag = document.createDocumentFragment();
    parts.forEach((pt) => {
      if (typeof pt === "string") {
        frag.appendChild(document.createTextNode(pt));
      } else {
        const s = document.createElement("span");
        if (pt[0]) s.className = pt[0];
        s.textContent = pt[1]; // texto del usuario → siempre como texto, nunca HTML
        frag.appendChild(s);
      }
    });
    queryEl.textContent = "";
    queryEl.appendChild(frag);
  }

  function setResult(cls, text) {
    resultEl.className = "sqlab__result" + (cls ? " " + cls : "");
    resultEl.textContent = text;
  }

  function render() {
    const u = userEl.value;
    const p = passEl.value;
    const inj = isInjection(u) || isInjection(p);

    if (mode === "vulnerable") {
      // La consulta CONCATENA el texto del usuario tal cual (peligroso).
      setQuery([
        ["kw", "SELECT"], " * ", ["kw", "FROM"], " usuarios\n",
        ["kw", "WHERE"], " usuario = '", [isInjection(u) ? "inj" : "str", u],
        "' ", ["kw", "AND"], " clave = '", [isInjection(p) ? "inj" : "str", p], "';",
      ]);

      if (inj) {
        sawInjection = true;
        setResult("ok", "🔓 Acceso concedido — ¡inyección exitosa! La comilla cerró el texto y el OR hizo la condición SIEMPRE verdadera. El atacante entró sin credenciales.");
      } else if (u === VALID.user && p === VALID.pass) {
        setResult("", "✅ Acceso concedido (credenciales correctas).");
      } else {
        setResult("", "⛔ Acceso denegado.");
      }
    } else {
      // Versión SEGURA: consulta parametrizada. El texto viaja como DATO, no como código.
      setQuery([
        ["kw", "SELECT"], " * ", ["kw", "FROM"], " usuarios\n",
        ["kw", "WHERE"], " usuario = ", ["param", "?"], " ", ["kw", "AND"], " clave = ", ["param", "?"], ";\n",
        ["cmt", "-- parámetros (tratados como texto literal):"], "\n",
        ["cmt", '--   usuario = "'], ["param", u], ["cmt", '"'], "\n",
        ["cmt", '--   clave   = "'], ["param", p], ["cmt", '"'],
      ]);

      if (inj) {
        sawBlocked = true;
        setResult("safe", "🛡️ Acceso denegado — inyección bloqueada. El texto se trató como un DATO literal, no como código SQL. Ningún usuario se llama así, por eso no entra.");
      } else if (u === VALID.user && p === VALID.pass) {
        setResult("safe", "✅ Acceso concedido (credenciales correctas).");
      } else {
        setResult("", "⛔ Acceso denegado.");
      }
    }

    // Lección aprendida: rompió la vulnerable Y comprobó que la segura la bloquea.
    if (sawInjection && sawBlocked && passBadge && !passBadge.classList.contains("show")) {
      passBadge.classList.add("show");
      if (lesson) lesson.classList.add("show");
    }
  }

  modeBtns.forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      modeBtns.forEach((x) => x.classList.toggle("active", x === b));
      render();
    })
  );
  chips.forEach((c) =>
    c.addEventListener("click", () => {
      userEl.value = c.dataset.fill;
      render();
      userEl.focus();
    })
  );
  userEl.addEventListener("input", render);
  passEl.addEventListener("input", render);
  render();
})();

/* ---------------------------------------------------------------------
   LAB 2 · MONTE CARLO — Estimar π con azar
   Lanzamos puntos aleatorios en un cuadrado. La proporción que cae dentro
   del círculo inscrito es π/4, así que π ≈ 4 × (dentro / total).
--------------------------------------------------------------------- */
(function monteCarloLab() {
  const lab = document.querySelector(".mclab");
  if (!lab) return;

  const canvas = lab.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const S = canvas.width; // cuadrado SxS
  const R = S / 2; // radio del círculo inscrito
  const cx = S / 2, cy = S / 2;

  const elPi = lab.querySelector('[data-mc="pi"]');
  const elIn = lab.querySelector('[data-mc="in"]');
  const elTotal = lab.querySelector('[data-mc="total"]');
  const elErr = lab.querySelector('[data-mc="err"]');
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");

  let inside = 0, total = 0;

  function drawBase() {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#d8d8de";
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }

  function update() {
    const pi = total ? (4 * inside) / total : 0;
    elPi.textContent = total ? pi.toFixed(4) : "—";
    elIn.textContent = inside.toLocaleString("es");
    elTotal.textContent = total.toLocaleString("es");
    elErr.textContent = total ? "±" + Math.abs(pi - Math.PI).toFixed(4) : "—";
    if (total >= 3000 && Math.abs(pi - Math.PI) < 0.12 && passBadge) {
      passBadge.classList.add("show");
    }
  }

  function addPoints(n) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const dx = x - cx, dy = y - cy;
      const isIn = dx * dx + dy * dy <= R * R;
      ctx.fillStyle = isIn ? "rgba(37,99,235,.7)" : "rgba(180,68,31,.55)";
      ctx.fillRect(x, y, 2, 2);
      total++;
      if (isIn) inside++;
    }
    update();
  }

  function reset() {
    inside = 0; total = 0;
    drawBase();
    update();
  }

  lab.querySelectorAll("[data-mc-add]").forEach((b) =>
    b.addEventListener("click", () => addPoints(parseInt(b.dataset.mcAdd, 10)))
  );
  const resetBtn = lab.querySelector("[data-mc-reset]");
  if (resetBtn) resetBtn.addEventListener("click", reset);

  reset();
})();

/* ---------------------------------------------------------------------
   LAB 3 · JSON — identifica el tipo de cada dato
--------------------------------------------------------------------- */
(function jsonTypesLab() {
  const lab = document.querySelector(".jsonlab");
  if (!lab) return;
  const rows = lab.querySelectorAll(".jsonlab__row");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");

  function check() {
    let allCorrect = rows.length > 0;
    rows.forEach((r) => {
      const sel = r.querySelector("select");
      if (!sel.value) { r.classList.remove("correct", "wrong"); allCorrect = false; return; }
      const ok = sel.value === r.dataset.answer;
      r.classList.toggle("correct", ok);
      r.classList.toggle("wrong", !ok);
      if (!ok) allCorrect = false;
    });
    if (allCorrect && passBadge) passBadge.classList.add("show");
  }
  rows.forEach((r) => r.querySelector("select").addEventListener("change", check));
})();

/* ---------------------------------------------------------------------
   LAB 4 · Construye un prompt efectivo (rol + tarea + contexto + formato)
--------------------------------------------------------------------- */
(function promptBuilderLab() {
  const lab = document.querySelector(".promptlab");
  if (!lab) return;
  const fields = lab.querySelectorAll("textarea[data-piece]");
  const preview = lab.querySelector(".promptlab__preview");
  const meterFill = lab.querySelector(".promptlab__meter i");
  const meterLabel = lab.querySelector(".promptlab__meter-label");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");
  const NAMES = { rol: "Rol", tarea: "Tarea", contexto: "Contexto", formato: "Formato" };

  function render() {
    preview.textContent = "";
    let filled = 0;
    fields.forEach((f) => {
      const val = f.value.trim();
      const line = document.createElement("div");
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = "[" + NAMES[f.dataset.piece] + "] ";
      line.appendChild(lbl);
      if (val.length >= 8) {
        filled++;
        line.appendChild(document.createTextNode(val));
      } else {
        const e = document.createElement("span");
        e.className = "empty";
        e.textContent = "(añade " + NAMES[f.dataset.piece].toLowerCase() + "…)";
        line.appendChild(e);
      }
      preview.appendChild(line);
    });
    const pct = Math.round((filled / fields.length) * 100);
    meterFill.style.width = pct + "%";
    meterLabel.textContent =
      filled + " de " + fields.length + " piezas · " +
      (filled === fields.length ? "¡Prompt completo!" : "sigue construyendo");
    if (filled === fields.length && passBadge) passBadge.classList.add("show");
  }
  fields.forEach((f) => f.addEventListener("input", render));
  render();
})();

/* ---------------------------------------------------------------------
   LAB 5 · Simula una petición a una API (request → response JSON)
--------------------------------------------------------------------- */
(function apiSimLab() {
  const lab = document.querySelector(".apilab");
  if (!lab) return;
  const methodSel = lab.querySelector('[data-api="method"]');
  const endSel = lab.querySelector('[data-api="endpoint"]');
  const sendBtn = lab.querySelector('[data-api="send"]');
  const io = lab.querySelector(".apilab__io");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");
  let saw200 = false, saw404 = false;

  const DB = {
    "/clima/madrid": { ciudad: "Madrid", temperatura: 28, estado: "soleado" },
    "/usuarios/7": { id: 7, nombre: "Ana Torres", rol: "editor" },
    "/productos": [{ id: 1, nombre: "Café" }, { id: 2, nombre: "Té" }],
  };
  const span = (cls, t) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = t; return s; };

  function send() {
    const m = methodSel.value, ep = endSel.value;
    const found = Object.prototype.hasOwnProperty.call(DB, ep);
    io.textContent = "";

    const status = document.createElement("div");
    status.className = "apilab__status " + (found ? "ok" : "err");
    status.textContent = found ? "200 OK" : "404 Not Found";
    io.appendChild(status);

    const body = document.createElement("div");
    body.appendChild(span("cmt", "// Petición\n"));
    body.appendChild(span("kw", m + " "));
    body.appendChild(document.createTextNode("https://api.demo.com" + ep + "\n\n"));
    body.appendChild(span("cmt", "// Respuesta\n"));
    const data = found ? DB[ep] : { error: "Recurso no encontrado" };
    body.appendChild(document.createTextNode(JSON.stringify(data, null, 2)));
    io.appendChild(body);

    if (found) saw200 = true; else saw404 = true;
    if (saw200 && saw404 && passBadge) passBadge.classList.add("show");
  }
  sendBtn.addEventListener("click", send);
})();

/* ---------------------------------------------------------------------
   LAB 6 · Monte Carlo — ¿lloverá en tu viaje? (predicción por simulación)
--------------------------------------------------------------------- */
(function weatherMonteCarloLab() {
  const lab = document.querySelector(".wxlab");
  if (!lab) return;
  const q = (s) => lab.querySelector(s);
  const probS = q('[data-wx="prob"]'), daysS = q('[data-wx="days"]'), thrS = q('[data-wx="thresh"]');
  const probV = q('[data-wx="probVal"]'), daysV = q('[data-wx="daysVal"]'), thrV = q('[data-wx="threshVal"]');
  const runBtn = q('[data-wx="run"]'), bigEl = q('[data-wx="result"]'), descEl = q('[data-wx="desc"]');
  const canvas = q("canvas"), ctx = canvas.getContext("2d");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");

  function syncLabels() {
    probV.textContent = probS.value + "%";
    daysV.textContent = daysS.value;
    thrS.max = daysS.value;
    if (+thrS.value > +daysS.value) thrS.value = daysS.value;
    thrV.textContent = thrS.value;
  }

  function drawDist(dist, thr) {
    const W = canvas.width, H = canvas.height, pad = 8, n = dist.length;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const max = Math.max.apply(null, dist) || 1;
    const bw = (W - pad * 2) / n;
    dist.forEach((c, i) => {
      const h = (c / max) * (H - pad * 2);
      ctx.fillStyle = i >= thr ? "#2563eb" : "#cbd5e1";
      ctx.fillRect(pad + i * bw + 2, H - pad - h, bw - 4, h);
    });
  }

  function run() {
    const p = +probS.value / 100, days = +daysS.value, thr = +thrS.value, N = 10000;
    const dist = new Array(days + 1).fill(0);
    let success = 0;
    for (let i = 0; i < N; i++) {
      let rainy = 0;
      for (let d = 0; d < days; d++) if (Math.random() < p) rainy++;
      dist[rainy]++;
      if (rainy >= thr) success++;
    }
    bigEl.textContent = (success / N * 100).toFixed(1) + "%";
    descEl.textContent = "de que llueva al menos " + thr + " de " + days + " días";
    drawDist(dist, thr);
    if (passBadge) passBadge.classList.add("show");
  }

  [probS, daysS, thrS].forEach((s) => s.addEventListener("input", syncLabels));
  runBtn.addEventListener("click", run);
  syncLabels();
})();
