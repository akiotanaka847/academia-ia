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
