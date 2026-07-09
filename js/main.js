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
