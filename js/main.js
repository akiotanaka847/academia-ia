/* =====================================================================
   ACADEMIA IA — Interactividad compartida
   Todo se activa solo cuando el elemento existe en la página,
   por eso el mismo archivo sirve para el índice y para los módulos.
   ===================================================================== */

/* ---------- 1. Revelar elementos al hacer scroll ----------
   Usamos IntersectionObserver: el navegador nos avisa cuándo un
   elemento entra en pantalla, en lugar de escuchar el scroll a cada
   píxel (mucho más eficiente y suave). */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target); // se anima una sola vez
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- 2. Barra de progreso de lectura ----------
   Calcula qué porcentaje de la página ya se recorrió. */
const progressBar = document.querySelector(".progress-bar");
if (progressBar) {
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + "%";
  });
}

/* ---------- 3. Menú móvil (hamburguesa) ---------- */
const burger = document.querySelector(".nav__burger");
const navLinks = document.querySelector(".nav__links");
if (burger && navLinks) {
  burger.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => navLinks.classList.remove("open"))
  );
}

/* ---------- 4. Índice del módulo (TOC) que resalta la sección activa ----------
   Sólo corre si la página tiene un índice lateral. */
const tocLinks = document.querySelectorAll(".toc a");
if (tocLinks.length) {
  const sections = [...tocLinks].map((a) =>
    document.querySelector(a.getAttribute("href"))
  );
  const tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = "#" + entry.target.id;
          tocLinks.forEach((a) =>
            a.classList.toggle("active", a.getAttribute("href") === id)
          );
        }
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  sections.forEach((s) => s && tocObserver.observe(s));
}

/* ---------- 6. Quiz interactivo ----------
   Cada opción trae data-correct="true|false". Al hacer clic marcamos
   verde/rojo y mostramos la explicación. Es la lógica que hace el
   aprendizaje activo (el alumno se autoevalúa). */
document.querySelectorAll(".quiz").forEach((quiz) => {
  const opts = quiz.querySelectorAll(".quiz__opt");
  const feedback = quiz.querySelector(".quiz__feedback");
  opts.forEach((opt) => {
    opt.addEventListener("click", () => {
      if (quiz.dataset.answered) return; // no permitir re-responder
      quiz.dataset.answered = "true";
      const isCorrect = opt.dataset.correct === "true";
      opt.classList.add(isCorrect ? "correct" : "wrong");
      if (!isCorrect) {
        // resaltar también cuál era la correcta
        quiz.querySelector('[data-correct="true"]').classList.add("correct");
      }
      if (feedback) feedback.classList.add("show");
    });
  });
});

/* ---------- 7. Carga elegante de imágenes (fade-in + respaldo) ----------
   Cada imagen aparece con un fundido cuando termina de cargar. Si falla,
   marcamos su contenedor con .img-failed para mostrar un degradado de marca
   en su lugar (el diseño nunca se "rompe" con un icono roto). */
document.querySelectorAll(".card__cover img, .mod-cover img, .content-img img, .hero__fig img").forEach((img) => {
  const done = () => img.classList.add("loaded");
  const fail = () => img.parentElement.classList.add("img-failed");
  if (img.complete) {
    img.naturalWidth > 0 ? done() : fail();
  } else {
    img.addEventListener("load", done);
    img.addEventListener("error", fail);
  }
});

/* ---------- 8. Página de Tareas: progreso guardado ----------
   Guardamos qué tareas están marcadas en localStorage (una "memoria" del
   navegador que persiste al cerrar la pestaña). Sin backend ni base de datos:
   todo vive en el cliente. */
const taskChecks = document.querySelectorAll(".task__check");
if (taskChecks.length) {
  const STORAGE_KEY = "academiaia-tareas";
  const fill = document.querySelector(".progress-fill");
  const countEl = document.querySelector(".progress-count b");
  const banner = document.querySelector(".tasks-done-banner");

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  };
  const save = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const refresh = () => {
    const total = taskChecks.length;
    let done = 0;
    taskChecks.forEach((c) => { if (c.checked) done++; });
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (fill) fill.style.width = pct + "%";
    if (countEl) countEl.textContent = done;
    // contador por nivel
    document.querySelectorAll(".task-group").forEach((g) => {
      const checks = g.querySelectorAll(".task__check");
      const gdone = [...checks].filter((c) => c.checked).length;
      const label = g.querySelector(".task-group__done");
      if (label) label.textContent = gdone + "/" + checks.length;
    });
    if (banner) banner.classList.toggle("show", done === total && total > 0);
  };

  // Restaurar estado guardado
  const state = load();
  taskChecks.forEach((c) => { if (state[c.dataset.task]) c.checked = true; });
  refresh();

  // Guardar al cambiar
  taskChecks.forEach((c) =>
    c.addEventListener("change", () => {
      const s = load();
      if (c.checked) s[c.dataset.task] = true;
      else delete s[c.dataset.task];
      save(s);
      refresh();
    })
  );

  // Botón reiniciar
  const resetBtn = document.querySelector(".progress-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("¿Reiniciar tu progreso de todas las tareas?")) return;
      localStorage.removeItem(STORAGE_KEY);
      taskChecks.forEach((c) => (c.checked = false));
      refresh();
    });
  }
}

/* ---------- 9. Año dinámico en el footer ---------- */
const yearEl = document.querySelector("[data-year]");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- 10. Progreso del curso: secciones plegables y desbloqueo ----------
   Todo se construye desde aquí, sin tocar el HTML de los 30 módulos:
   · cada .content-block se convierte en una sección plegable
   · el alumno marca cada sección como leída y responde el quiz
   · al llegar al 80% de las actividades se desbloquea el módulo siguiente
   El progreso vive en localStorage. Es un control de avance pedagógico,
   NO una barrera de seguridad: lo que corre en el navegador siempre se
   puede saltar (justo lo que enseña el LAB 13). */
(function progresoDelCurso() {
  const KEY = "academiaia-progreso";
  const UMBRAL = 80; // % de actividades para desbloquear el siguiente módulo

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function modId(href) { const m = (href || "").match(/modulo-(\d+)/); return m ? m[1] : null; }
  function prevId(id) { const n = parseInt(id, 10) - 1; return n < 1 ? null : String(n).padStart(2, "0"); }
  function pctOf(st, id) { const r = st[id]; return r && typeof r.pct === "number" ? r.pct : 0; }
  function unlocked(st, id) { const p = prevId(id); return !p || pctOf(st, p) >= UMBRAL; }
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function open(b) { b.classList.add("open"); const h = b.querySelector(".cb__head"); if (h) h.setAttribute("aria-expanded", "true"); }
  function close(b) { b.classList.remove("open"); const h = b.querySelector(".cb__head"); if (h) h.setAttribute("aria-expanded", "false"); }

  const here = modId(window.location.pathname);

  /* ===== A · Dentro de una página de módulo ===== */
  if (here) {
    const article = document.querySelector(".mod-layout article") || document.querySelector("article");
    const blocks = article ? Array.prototype.slice.call(article.querySelectorAll(".content-block")) : [];
    if (!article || !blocks.length) return;

    const state = load();
    const prevA = document.querySelector(".mod-nav a:not(.next)");
    const nextA = document.querySelector(".mod-nav a.next");

    // --- Bloqueo: el módulo anterior no llega al umbral ---
    if (!unlocked(state, here)) {
      const need = prevId(here);
      article.textContent = "";
      const box = el("div", "modlock");
      box.appendChild(el("div", "modlock__ic", "🔒"));
      box.appendChild(el("h3", null, "Módulo bloqueado"));
      box.appendChild(el("p", null,
        "Para abrir este módulo necesitas completar al menos el " + UMBRAL + "% del módulo " +
        need + " (ahora llevas " + pctOf(state, need) + "%). Así te aseguras de tener la base antes de seguir."));
      const a = el("a", "btn btn--primary");
      a.href = prevA ? prevA.getAttribute("href") : "../index.html#ruta";
      a.textContent = "Ir al módulo " + need + " →";
      box.appendChild(a);
      article.appendChild(box);
      return;
    }

    // --- Estado guardado ---
    const rec = (state[here] && typeof state[here] === "object") ? state[here] : {};
    let leidas = Array.isArray(rec.secciones) ? rec.secciones.slice() : [];
    let quizHecho = rec.quiz === true;

    const quizBlock = blocks.filter((b) => b.querySelector(".quiz"))[0] || null;
    const secciones = blocks.filter((b) => b !== quizBlock);
    const total = secciones.length + (quizBlock ? 1 : 0);

    // --- Barra de progreso del módulo ---
    const bar = el("div", "modprog");
    const top = el("div", "modprog__top");
    top.appendChild(el("span", "modprog__label", "Progreso del módulo " + here));
    const pctEl = el("span", "modprog__pct", "0%");
    top.appendChild(pctEl);
    const track = el("div", "modprog__track");
    const fill = el("i", "modprog__fill");
    track.appendChild(fill);
    const hint = el("div", "modprog__hint", "");
    bar.appendChild(top);
    bar.appendChild(track);
    bar.appendChild(hint);
    article.insertBefore(bar, article.firstChild);

    // --- Convertir cada bloque en sección plegable ---
    blocks.forEach((block, i) => {
      if (!block.id) block.id = "seccion-" + (i + 1);
      block.classList.add("cb");
      const h2 = block.querySelector("h2");
      const panel = el("div", "cb__panel");
      Array.prototype.slice.call(block.childNodes).forEach((n) => {
        if (n !== h2) panel.appendChild(n);
      });

      const head = el("button", "cb__head");
      head.type = "button";
      head.setAttribute("aria-expanded", "false");
      const title = el("span", "cb__title");
      if (h2) { while (h2.firstChild) title.appendChild(h2.firstChild); h2.remove(); }
      head.appendChild(el("span", "cb__dot", "✓"));
      head.appendChild(title);
      head.appendChild(el("span", "cb__chev", "⌄"));

      block.appendChild(head);
      block.appendChild(panel);
      head.addEventListener("click", () => {
        block.classList.contains("open") ? close(block) : open(block);
      });
      if (i === 0) open(block); // la primera abierta, el resto plegadas
    });

    function render() {
      const done = leidas.length + (quizHecho ? 1 : 0);
      const pct = total ? Math.round((done / total) * 100) : 0;
      fill.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      bar.classList.toggle("done", pct >= UMBRAL);
      const need = Math.ceil((UMBRAL / 100) * total);
      hint.textContent = pct >= UMBRAL
        ? "¡Módulo completado! Ya puedes pasar al siguiente."
        : done + " de " + total + " actividades · te faltan " + Math.max(0, need - done) +
          " para llegar al " + UMBRAL + "% y desbloquear el módulo siguiente.";
      if (nextA) nextA.classList.toggle("locked", pct < UMBRAL);
      return pct;
    }

    function persist() {
      const pct = render();
      const st = load();
      st[here] = { secciones: leidas, quiz: quizHecho, total: total, pct: pct };
      save(st);
    }

    // --- Botón "marcar como leída" en cada sección ---
    secciones.forEach((block) => {
      const panel = block.querySelector(".cb__panel");
      const btn = el("button", "cb__mark");
      btn.type = "button";
      function sync() {
        const done = leidas.indexOf(block.id) !== -1;
        block.classList.toggle("read", done);
        btn.textContent = done ? "✓ Leída" : "Marcar como leída";
      }
      btn.addEventListener("click", () => {
        const i = leidas.indexOf(block.id);
        if (i === -1) leidas.push(block.id); else leidas.splice(i, 1);
        sync();
        persist();
      });
      panel.appendChild(btn);
      sync();
    });

    // --- El quiz cuenta como una actividad: se completa al responder todo ---
    if (quizBlock) {
      const quizzes = Array.prototype.slice.call(quizBlock.querySelectorAll(".quiz"));
      if (quizHecho) quizBlock.classList.add("read");
      quizBlock.addEventListener("click", (ev) => {
        if (!ev.target || !ev.target.classList.contains("quiz__opt")) return;
        const answered = quizzes.filter((q) => q.dataset.answered).length;
        if (quizzes.length && answered === quizzes.length && !quizHecho) {
          quizHecho = true;
          quizBlock.classList.add("read");
          persist();
        }
      });
    }

    // --- No dejar pasar al siguiente módulo sin el umbral ---
    if (nextA) {
      nextA.addEventListener("click", (ev) => {
        if (!nextA.classList.contains("locked")) return;
        ev.preventDefault();
        bar.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    // --- El índice lateral debe abrir la sección a la que salta ---
    document.querySelectorAll(".toc a").forEach((a) => {
      a.addEventListener("click", () => {
        const href = a.getAttribute("href") || "";
        const t = href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
        if (t && t.classList.contains("cb")) open(t);
      });
    });
    if (window.location.hash) {
      const t = document.getElementById(window.location.hash.slice(1));
      if (t && t.classList.contains("cb")) open(t);
    }

    persist();
    return;
  }

  /* ===== B · Índice: candados y progreso en las tarjetas ===== */
  const cards = document.querySelectorAll("a.card[href*='modulo-']");
  if (!cards.length) return;
  const st = load();
  let suma = 0, completados = 0;

  cards.forEach((card) => {
    const id = modId(card.getAttribute("href"));
    if (!id) return;
    const p = pctOf(st, id);
    suma += p;
    if (p >= UMBRAL) completados++;
    const cover = card.querySelector(".card__cover") || card;
    if (!unlocked(st, id)) {
      card.classList.add("locked");
      card.setAttribute("aria-disabled", "true");
      cover.appendChild(el("span", "card__state", "🔒"));
    } else if (p >= UMBRAL) {
      cover.appendChild(el("span", "card__state ok", "✓ " + p + "%"));
    } else if (p > 0) {
      cover.appendChild(el("span", "card__state mid", p + "%"));
    }
  });

  // Barra global del curso, al principio del temario
  const ruta = document.getElementById("ruta");
  const head = ruta ? ruta.querySelector(".section__head") : null;
  if (ruta) {
    const pct = cards.length ? Math.round(suma / cards.length) : 0;
    const bar = el("div", "modprog");
    const top = el("div", "modprog__top");
    top.appendChild(el("span", "modprog__label", "Tu avance en el programa"));
    top.appendChild(el("span", "modprog__pct", pct + "%"));
    const track = el("div", "modprog__track");
    const fill = el("i", "modprog__fill");
    fill.style.width = pct + "%";
    track.appendChild(fill);
    bar.appendChild(top);
    bar.appendChild(track);
    bar.appendChild(el("div", "modprog__hint",
      completados + " de " + cards.length + " módulos completados · necesitas el " + UMBRAL +
      "% de cada uno para abrir el siguiente."));
    bar.classList.toggle("done", completados === cards.length && cards.length > 0);
    // el encabezado suele vivir dentro de un .container, así que insertamos
    // respecto a SU padre (no respecto a #ruta) para no romper el DOM
    if (head && head.parentNode) head.parentNode.insertBefore(bar, head.nextSibling);
    else ruta.appendChild(bar);
  }
})();
