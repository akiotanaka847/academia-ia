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

/* ---------------------------------------------------------------------
   LAB 7 y 8 · Card quiz genérico (Detectar phishing / Verificar la IA)
   Cada tarjeta tiene data-answer; el usuario elige y se revela el veredicto.
--------------------------------------------------------------------- */
document.querySelectorAll(".cardquiz").forEach((quiz) => {
  const cards = quiz.querySelectorAll(".cardquiz__card");
  const scoreEl = quiz.querySelector("[data-cq-score]");
  const passBadge = quiz.closest(".lab").querySelector(".lab__pass");
  let answered = 0, correct = 0;

  cards.forEach((card) => {
    card.querySelectorAll(".cardquiz__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (card.dataset.done) return;
        card.dataset.done = "1";
        const ok = btn.dataset.choice === card.dataset.answer;
        card.classList.add(ok ? "correct" : "wrong");
        const verdict = card.querySelector(".cardquiz__verdict");
        if (verdict) verdict.classList.add("show");
        card.querySelectorAll(".cardquiz__btn").forEach((b) => (b.disabled = true));
        answered++;
        if (ok) correct++;
        if (scoreEl) scoreEl.textContent = correct + "/" + cards.length;
        if (answered === cards.length && correct === cards.length && passBadge) {
          passBadge.classList.add("show");
        }
      });
    });
  });
});

/* ---------------------------------------------------------------------
   LAB 9 · Evaluador de prompts — detecta las 4 piezas en un prompt libre
--------------------------------------------------------------------- */
(function promptEvalLab() {
  const lab = document.querySelector(".promptevallab");
  if (!lab) return;
  const ta = lab.querySelector("textarea");
  const items = {
    rol: lab.querySelector('[data-eval="rol"]'),
    tarea: lab.querySelector('[data-eval="tarea"]'),
    contexto: lab.querySelector('[data-eval="contexto"]'),
    formato: lab.querySelector('[data-eval="formato"]'),
  };
  const scoreEl = lab.querySelector("[data-eval-score]");
  const feedbackEl = lab.querySelector(".promptevallab__feedback");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");

  function evaluate() {
    const t = ta.value.trim();
    const s = t.toLowerCase();
    const map = {
      rol: /(act[uú]a como|eres un|eres una|como experto|en el rol de|haz de|comp[oó]rtate como)/.test(s),
      tarea: /\b(redacta|resume|analiza|crea|escribe|traduce|genera|lista|explica|compara|corrige|clasifica|dise[nñ]a|propon|propón|calcula|ordena|extrae|convierte)\b/.test(s),
      contexto: t.length >= 60,
      formato: /(\d+\s*palabras|m[aá]x|tono|formato|lista|tabla|vi[nñ]etas|puntos|p[aá]rrafos|%|idioma|json|correo|breve|conciso)/.test(s),
    };
    let met = 0;
    Object.keys(items).forEach((k) => {
      if (items[k]) items[k].classList.toggle("met", map[k]);
      if (map[k]) met++;
    });
    if (scoreEl) scoreEl.textContent = Math.round((met / 4) * 100);
    if (feedbackEl) {
      feedbackEl.textContent = !t.length
        ? "Escribe un prompt para evaluarlo."
        : met === 4
        ? "¡Excelente! Tu prompt tiene las 4 piezas."
        : "Te faltan piezas — revisa la lista.";
    }
    if (met === 4 && passBadge) passBadge.classList.add("show");
  }
  ta.addEventListener("input", evaluate);
  evaluate();
})();

/* ---------------------------------------------------------------------
   LAB 10 · Constructor de flujos (tool-agnostic)
   El usuario arma un workflow: disparador → agente de IA → acción.
   Los mismos conceptos valen en Fusion, n8n, Make, Zapier.
--------------------------------------------------------------------- */
(function flowLab() {
  const lab = document.querySelector(".flowlab");
  if (!lab) return;
  const canvas = lab.querySelector(".flowlab__canvas");
  const hint = lab.querySelector(".flowlab__hint");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");

  const BLOCKS = {
    disparador: { name: "Disparador", icon: "⚡", desc: "Cuando pasa algo (correo, tarea, horario…)" },
    agente: { name: "Agente de IA", icon: "🤖", desc: "La IA razona, decide o genera" },
    accion: { name: "Herramienta / Acción", icon: "🔧", desc: "Hace algo: crear, enviar, guardar" },
    router: { name: "Router / Condición", icon: "🔀", desc: "Si… entonces… (bifurca)" },
    humano: { name: "Revisión humana", icon: "👤", desc: "Una persona aprueba antes de seguir" },
  };
  let flow = [];

  function setCheck(key, ok) {
    const el = lab.querySelector('[data-flow="' + key + '"]');
    if (el) el.classList.toggle("met", ok);
  }

  function validate() {
    const okTrigger = flow[0] === "disparador";
    const okAgent = flow.indexOf("agente") !== -1;
    const okAction = flow[flow.length - 1] === "accion";
    setCheck("trigger", okTrigger);
    setCheck("agent", okAgent);
    setCheck("action", okAction);
    if (okTrigger && okAgent && okAction && flow.length >= 3 && passBadge) {
      passBadge.classList.add("show");
    }
  }

  function render() {
    canvas.querySelectorAll(".flowlab__step, .flowlab__arrow").forEach((e) => e.remove());
    hint.style.display = flow.length ? "none" : "block";

    flow.forEach((key, i) => {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = "flowlab__arrow";
        arrow.textContent = "↓";
        canvas.appendChild(arrow);
      }
      const b = BLOCKS[key];
      const step = document.createElement("div");
      step.className = "flowlab__step step--" + key;

      const ic = document.createElement("span");
      ic.className = "flowlab__step-ic";
      ic.textContent = b.icon;

      const txt = document.createElement("div");
      const nm = document.createElement("b");
      nm.textContent = b.name;
      const ds = document.createElement("span");
      ds.className = "flowlab__step-desc";
      ds.textContent = b.desc;
      txt.appendChild(nm);
      txt.appendChild(ds);

      const rm = document.createElement("button");
      rm.className = "flowlab__remove";
      rm.textContent = "×";
      rm.setAttribute("aria-label", "Quitar paso");
      rm.addEventListener("click", () => { flow.splice(i, 1); render(); });

      step.appendChild(ic);
      step.appendChild(txt);
      step.appendChild(rm);
      canvas.appendChild(step);
    });
    validate();
  }

  lab.querySelectorAll("[data-block]").forEach((p) =>
    p.addEventListener("click", () => { flow.push(p.dataset.block); render(); })
  );
  const clearBtn = lab.querySelector("[data-flow-clear]");
  if (clearBtn) clearBtn.addEventListener("click", () => { flow = []; render(); });
  render();
})();

/* ---------------------------------------------------------------------
   LAB 11 · Estimador de costo de tokens
   Trocea el prompt en tokens (aprox.), deja elegir cuánto responderá la IA
   y calcula el costo por ejecución y por 1 000 ejecuciones en 3 tramos.
   Los precios son de EJEMPLO (ilustrativos) para enseñar el modelo mental:
   la salida se cobra más que la entrada, y el tramo premium cuesta mucho más.
--------------------------------------------------------------------- */
(function tokenCostLab() {
  const lab = document.querySelector(".tokenlab");
  if (!lab) return;
  const ta = lab.querySelector('[data-tok="input"]');
  const inCountEl = lab.querySelector('[data-tok="inCount"]');
  const outCountEl = lab.querySelector('[data-tok="outCount"]');
  const viz = lab.querySelector('[data-tok="viz"]');
  const rowsEl = lab.querySelector('[data-tok="rows"]');
  const insightEl = lab.querySelector('[data-tok="insight"]');
  const presets = lab.querySelectorAll("[data-out]");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");

  // Tramos de ejemplo — precios ilustrativos por 1M de tokens [entrada, salida].
  const TIERS = [
    { key: "eco",  cls: "tier-eco",  name: "Económico",   in: 0.25, out: 1.25 },
    { key: "bal",  cls: "tier-bal",  name: "Equilibrado", in: 3,    out: 15 },
    { key: "prem", cls: "tier-prem", name: "Premium",     in: 15,   out: 75 },
  ];
  const TINTS = ["#dbeafe", "#ede9fe", "#dcfce7", "#fef3c7", "#fee2e2", "#e0f2fe"];

  let outTok = 0;    // tokens de salida elegidos (0 = aún no elige)

  // Trocea el texto en piezas tipo token (aprox.): palabras cortas = 1 token,
  // palabras largas se parten cada ~4 letras y cada signo va por su cuenta.
  // Usamos matchAll (iterador) para recorrer todas las coincidencias sin estado mutable.
  function tokenize(text) {
    const out = [];
    const re = /(\s+)|([A-Za-zÀ-ÿ0-9]+)|([^\sA-Za-zÀ-ÿ0-9])/g;
    for (const m of text.matchAll(re)) {
      if (m[1]) { out.push({ t: m[1], space: true }); }
      else if (m[2]) {
        const w = m[2];
        if (w.length <= 5) out.push({ t: w });
        else for (let i = 0; i < w.length; i += 4) out.push({ t: w.slice(i, i + 4) });
      } else { out.push({ t: m[3] }); }
    }
    return out;
  }

  // Formato USD con punto decimal (consistente en toda la tabla); más decimales
  // cuando el importe es diminuto para que no aparezca como "$0".
  function money(n) {
    if (n === 0) return "$0";
    if (n < 0.01) return "$" + n.toFixed(4);
    if (n < 1) return "$" + n.toFixed(3);
    return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function render() {
    const text = ta.value;
    const pieces = tokenize(text);
    const inTok = pieces.filter((p) => !p.space).length;
    const typed = inTok >= 3;

    inCountEl.textContent = inTok.toLocaleString("es");
    outCountEl.textContent = outTok ? outTok.toLocaleString("es") : "—";

    // Visualización: cada token como una pastilla de color
    viz.textContent = "";
    if (!text.trim()) {
      const e = document.createElement("span");
      e.className = "tokenlab__viz-empty";
      e.textContent = "Escribe arriba para ver los tokens…";
      viz.appendChild(e);
    } else {
      let ti = 0;
      const MAX = 240;
      pieces.forEach((p) => {
        if (p.space) { viz.appendChild(document.createTextNode(p.t)); return; }
        if (ti >= MAX) return;
        const s = document.createElement("span");
        s.className = "tokenlab__tok";
        s.style.background = TINTS[ti % TINTS.length];
        s.textContent = p.t; // texto del usuario → siempre como texto, nunca HTML
        viz.appendChild(s);
        ti++;
      });
      if (inTok > MAX) viz.appendChild(document.createTextNode(" …"));
    }

    // Tabla de costos por tramo
    rowsEl.textContent = "";
    TIERS.forEach((tier) => {
      const c1 = (inTok / 1e6) * tier.in + (outTok / 1e6) * tier.out;
      const tr = document.createElement("tr");
      tr.className = tier.cls;
      tr.setAttribute("data-tier", tier.key);
      const cells = [
        [tier.name, ""],
        ["$" + tier.in + " /1M", "muted"],
        ["$" + tier.out + " /1M", "muted"],
        [outTok ? money(c1) : "—", "cell-run"],
        [outTok ? money(c1 * 1000) : "—", "cell-bulk"],
      ];
      cells.forEach(([txt, cls]) => {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        td.textContent = txt;
        tr.appendChild(td);
      });
      rowsEl.appendChild(tr);
    });

    // Insight dinámico: por qué la salida y el tramo importan tanto
    if (typed && outTok) {
      const bal = TIERS[1];
      const ratio = (outTok * bal.out) / (inTok * bal.in);
      const eco = TIERS[0], prem = TIERS[2];
      const spread =
        (prem.in * inTok + prem.out * outTok) /
        (eco.in * inTok + eco.out * outTok);
      insightEl.textContent =
        "💡 Tu respuesta (" + outTok + " tokens) pesa más que tu pregunta (" + inTok +
        " tokens) y la salida se cobra más cara: en el tramo equilibrado, responder cuesta " +
        "≈ " + ratio.toFixed(1) + "× lo que tu prompt. Además, elegir el tramo premium en vez " +
        "del económico multiplica el costo ≈ " + spread.toFixed(0) + "× para el mismo trabajo.";
      insightEl.classList.add("show");
    } else {
      insightEl.classList.remove("show");
    }

    // Lección aprendida: escribió un prompt real Y eligió el largo de la respuesta
    if (typed && outTok && passBadge) passBadge.classList.add("show");
  }

  ta.addEventListener("input", render);
  presets.forEach((b) =>
    b.addEventListener("click", () => {
      outTok = parseInt(b.dataset.out, 10);
      presets.forEach((x) => x.classList.toggle("active", x === b));
      render();
    })
  );
  render();
})();

/* ---------------------------------------------------------------------
   LAB 12 · Mini-scraper — extraer datos con selectores CSS
   El usuario escribe un selector; corremos querySelectorAll DE VERDAD sobre
   una página ficticia (la .scrlab__page), resaltamos lo que coincide y
   mostramos los datos extraídos como JSON. Valida contra un objetivo.
   El selector es texto del usuario pero solo se usa en querySelectorAll
   (nunca en innerHTML); los selectores inválidos se capturan con try/catch.
--------------------------------------------------------------------- */
(function scraperLab() {
  const lab = document.querySelector(".scrlab");
  if (!lab) return;
  const page = lab.querySelector('[data-scr="page"]');
  const input = lab.querySelector('[data-scr="sel"]');
  const runBtn = lab.querySelector('[data-scr="run"]');
  const goalSel = lab.querySelector('[data-scr="goal"]');
  const statusEl = lab.querySelector('[data-scr="status"]');
  const jsonEl = lab.querySelector('[data-scr="json"]');
  const chips = lab.querySelectorAll("[data-scr-fill]");
  const passBadge = lab.closest(".lab").querySelector(".lab__pass");
  const solved = new Set();

  function clearHits() {
    page.querySelectorAll(".scr-hit").forEach((e) => e.classList.remove("scr-hit"));
  }
  function setStatus(cls, text) {
    statusEl.className = "scrlab__status" + (cls ? " " + cls : "");
    statusEl.textContent = text;
  }
  // Igualdad de conjuntos de elementos (mismo grupo, sin importar el orden)
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const sb = new Set(b);
    return a.every((x) => sb.has(x));
  }

  function run() {
    const sel = input.value.trim();
    clearHits();
    if (!sel) { setStatus("", "Escribe un selector CSS y pulsa Extraer."); jsonEl.textContent = "[]"; return; }

    let matches;
    try {
      matches = Array.prototype.slice.call(page.querySelectorAll(sel));
    } catch (err) {
      setStatus("err", "⚠️ Selector inválido: revisa la sintaxis (ej.: .clase, etiqueta, .padre .hijo).");
      jsonEl.textContent = "[]";
      return;
    }

    matches.forEach((el) => el.classList.add("scr-hit"));
    const data = matches.map((el) => el.textContent.trim().replace(/\s+/g, " "));
    jsonEl.textContent = JSON.stringify(data, null, 2);

    const goal = goalSel.value;
    const target = Array.prototype.slice.call(page.querySelectorAll(".product__" + goal));
    if (matches.length === 0) {
      setStatus("", "0 elementos: ese selector no encontró nada. Mira las etiquetas de ejemplo abajo.");
    } else if (sameSet(matches, target)) {
      solved.add(goal);
      setStatus("ok", "✅ ¡Correcto! Extrajiste los " + matches.length + " elementos del objetivo. Objetivos resueltos: " + solved.size + "/3.");
      if (solved.size >= 2 && passBadge) passBadge.classList.add("show");
    } else {
      setStatus("", "Extrajiste " + matches.length + " elemento(s), pero no son exactamente los del objetivo. Prueba con otra clase.");
    }
  }

  runBtn.addEventListener("click", run);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  chips.forEach((c) =>
    c.addEventListener("click", () => { input.value = c.dataset.scrFill; run(); input.focus(); })
  );
  goalSel.addEventListener("change", () => {
    clearHits();
    setStatus("", "Objetivo cambiado. Escribe el selector que extraiga justo eso.");
    jsonEl.textContent = "[]";
  });

  setStatus("", "Elige un objetivo, escribe un selector CSS y pulsa Extraer.");
  jsonEl.textContent = "[]";
})();
