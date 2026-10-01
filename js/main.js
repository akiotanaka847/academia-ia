/* =====================================================================
   ACADEMIA IA — Interactividad compartida
   Todo se activa solo cuando el elemento existe en la página,
   por eso el mismo archivo sirve para el índice y para los módulos.
   ===================================================================== */

/* ---------- 0. Guardián de acceso ----------
   Ninguna página del curso se puede ver sin sesión iniciada Y aprobada.
   Va aquí porque las 33 páginas ya cargan este archivo: un solo sitio que
   mantener. Si no hay sesión, mandamos a acceso.html recordando a dónde
   quería ir la persona para devolverla ahí después de entrar.

   AVISO HONESTO: esto bloquea la navegación normal, pero un sitio estático
   sirve sus HTML públicamente; alguien técnico podría descargarlos sin pasar
   por aquí. Lo que sí está protegido de verdad (por RLS, en el servidor) son
   los datos: perfiles y progreso. */
(function guardianDeAcceso() {
  const ruta = window.location.pathname;
  if (/(^|\/)acceso\.html$/.test(ruta)) return; // la página de acceso es pública

  const SUPABASE_URL = "https://riqhbhvtfzebosdobdkf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpcWhiaHZ0ZnplYm9zZG9iZGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjI4NzIsImV4cCI6MjEwMDIzODg3Mn0.LR_SblaObzJ5vIC3tRHDyfNxZ65Cq6bh0x6D-66tm8k";

  // Ocultamos el contenido mientras comprobamos, para no enseñarlo de refilón
  const raiz = document.documentElement;
  raiz.style.visibility = "hidden";
  let listo = false;
  function mostrar() { if (!listo) { listo = true; raiz.style.visibility = ""; } }

  const enModulos = ruta.indexOf("/modulos/") !== -1;
  const base = enModulos ? "../" : "./";

  function aLogin(motivo) {
    if (listo) return;
    listo = true;
    const volver = encodeURIComponent(ruta + window.location.search + window.location.hash);
    window.location.replace(base + "acceso.html?volver=" + volver + (motivo ? "&motivo=" + motivo : ""));
  }

  // Si la comprobación se atasca, no dejamos la página en blanco para siempre
  const salvavidas = setTimeout(function () { aLogin("lento"); }, 9000);

  // Las secciones que pintan progreso esperan a esta promesa: así se dibujan con
  // lo guardado en la cuenta y no con lo que (quizá atrasado) tenga este navegador
  let avisarListo;
  window.cuentaProgreso = { listo: new Promise(function (r) { avisarListo = r; }), cambio: function () {} };

  import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
    .then(function (mod) {
      const sb = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return sb.auth.getSession().then(function (res) {
        const sesion = res && res.data ? res.data.session : null;
        if (!sesion) { clearTimeout(salvavidas); aLogin(); return; }
        const pc = window.progresoCuenta;
        // perfil y progreso en paralelo: sincronizar no alarga la espera
        return Promise.all([
          sb.from("perfiles").select("aprobado, nombre, email").eq("id", sesion.user.id).maybeSingle(),
          pc ? pc.traer(sb) : null
        ]).then(function (res) {
            const r = res[0];
            clearTimeout(salvavidas);
            if (!r.data || !r.data.aprobado) {
              sb.auth.signOut();
              aLogin("pendiente");
              return;
            }
            montarSalir(sb, r.data, sesion.user); // barra: saludo + cerrar sesión
            if (pc) pc.conectar(sb, sesion.user.id, res[1]); // nunca lanza: un fallo aquí no bloquea el curso
            avisarListo();
            mostrar(); // sesión válida y aprobada: adelante
          });
      });
    })
    .catch(function () { clearTimeout(salvavidas); aLogin("error"); });

  // Inyecta en la barra un saludo y un botón "Cerrar sesión" (en las 33 páginas).
  function montarSalir(sb, perfil, user) {
    const links = document.querySelector(".nav__links");
    if (!links || document.querySelector(".nav__salir")) return;

    // si estamos dentro, el enlace "Acceso" ya no hace falta
    const accesoLink = links.querySelector('a[href*="acceso.html"]');
    if (accesoLink && accesoLink.parentElement) accesoLink.parentElement.style.display = "none";

    const nombre = perfil && perfil.nombre ? String(perfil.nombre).trim().split(/\s+/)[0] : "";
    const correo = (perfil && perfil.email) || (user && user.email) || "";

    if (nombre) {
      const liH = document.createElement("li");
      const hola = document.createElement("span");
      hola.className = "nav__user";
      hola.textContent = "Hola, " + nombre;
      liH.appendChild(hola);
      links.appendChild(liH);
    }

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav__salir";
    btn.textContent = "Cerrar sesión";
    if (correo) btn.title = "Sesión de " + correo;
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "Saliendo…";
      const fin = function () { window.location.replace(base + "acceso.html"); };
      const pc = window.progresoCuenta;
      // primero sube lo pendiente (tras cerrar sesión ya no se podría), sin esperar más de 3 s
      const tope = new Promise(function (r) { setTimeout(r, 3000); });
      Promise.race([pc ? pc.vaciar() : null, tope])
        .then(function () { return sb.auth.signOut(); })
        .then(fin).catch(fin);
    });
    li.appendChild(btn);
    links.appendChild(li);
  }
})();

/* ---------- 0b. Progreso guardado en la cuenta ----------
   El avance vive en dos sitios: este navegador (localStorage: rápido y sirve
   sin internet) y la tabla «progreso» de Supabase, que sigue a la persona en
   cualquier dispositivo. Al entrar se comparan y, por cada módulo, gana el
   cambio más reciente; después cada cambio se sube en segundo plano.
   El nivel del examen NO se sube desde aquí: se deduce de examen_resultados,
   que solo escribe el servidor al calificar (nadie se lo puede inventar).
   Tabla y reglas RLS: sql/supabase-setup.sql. */
window.progresoCuenta = (function () {
  const K = { progreso: "academiaia-progreso", tareas: "academiaia-tareas", nivel: "academiaia-nivel",
              meta: "academiaia-sync", cuenta: "academiaia-cuenta" };
  const ESPERA_MAX = 5000; // si Supabase tarda más, se sigue con lo local
  const RANGO = { intermedio: 2, avanzado: 3 };
  let sb = null, uid = null, temporizador = null, cola = Promise.resolve();
  const pendientes = new Set();

  function leer(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function crudo(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lista(x) { return Array.isArray(x) ? x : []; }
  // Postgres devuelve microsegundos; Date.parse solo necesita milisegundos
  function fecha(s) { const t = Date.parse(String(s || "").replace(/(\.\d{3})\d+/, "$1")); return isNaN(t) ? 0 : t; }

  function traer(cliente) {
    const consultas = Promise.all([
      cliente.from("progreso").select("modulo, secciones, quiz, total, pct, actualizado_en"),
      cliente.from("examen_resultados").select("tipo, objetivo, colocado, aprobado")
    ]).then(function (r) {
      if (r[0].error) return null; // sin datos fiables de la cuenta no se toca nada
      return { filas: r[0].data || [], examenes: r[1].error ? [] : (r[1].data || []) };
    }, function () { return null; });
    const limite = new Promise(function (ok) { setTimeout(function () { ok(null); }, ESPERA_MAX); });
    return Promise.race([consultas, limite]);
  }

  // Progreso de antes de sincronizar contra lo de la cuenta: se suma, no se elige
  function unir(a, s) {
    const secciones = Array.from(new Set(lista(a.secciones).concat(lista(s.secciones))));
    const total = Math.max(a.total || 0, s.total || 0);
    const quiz = !!(a.quiz || s.quiz);
    const calc = total ? Math.round(Math.min(secciones.length + (quiz ? 1 : 0), total) / total * 100) : 0;
    const r = { secciones: secciones, quiz: quiz, total: total, pct: Math.max(a.pct || 0, s.pct || 0, calc) };
    if (a.validado) r.validado = true;
    return r;
  }

  function fusionar(filas) {
    const local = leer(K.progreso, {}), tareas = leer(K.tareas, {}), meta = leer(K.meta, {});
    const t = meta.t || (meta.t = {});
    const servidor = {};
    filas.forEach(function (f) { servidor[f.modulo] = f; });
    if (servidor.tareas && servidor.tareas.total > (meta.totalTareas || 0)) meta.totalTareas = servidor.tareas.total;
    const claves = new Set(Object.keys(local).concat(Object.keys(servidor)));
    if (Object.keys(tareas).length || t.tareas) claves.add("tareas");
    const subir = [];

    claves.forEach(function (clave) {
      const s = servidor[clave], esTareas = clave === "tareas";
      const hayLocal = esTareas ? (Object.keys(tareas).length > 0 || !!t.tareas) : !!local[clave];
      const tl = t[clave] || 0, ts = s ? fecha(s.actualizado_en) : 0;
      if (!s) { if (hayLocal) subir.push(clave); return; }       // solo existe aquí: se sube
      if (!hayLocal || (tl && ts > tl)) {                        // la cuenta es más reciente: se baja
        if (esTareas) {
          Object.keys(tareas).forEach(function (k) { delete tareas[k]; });
          lista(s.secciones).forEach(function (id) { tareas[id] = true; });
        } else {
          local[clave] = { secciones: lista(s.secciones), quiz: !!s.quiz, total: s.total || 0, pct: s.pct || 0 };
        }
        t[clave] = ts;
        return;
      }
      if (tl > ts) { subir.push(clave); return; }                // este navegador es más reciente
      if (!tl) {                                                 // de antes de sincronizar: se unen
        if (esTareas) lista(s.secciones).forEach(function (id) { tareas[id] = true; });
        else local[clave] = unir(local[clave], s);
        subir.push(clave);
      }
    });

    escribir(K.progreso, local); escribir(K.tareas, tareas); escribir(K.meta, meta);
    return subir;
  }

  // Marca como validados los módulos que cubre un nivel (lo usa también examen.js).
  // Nunca baja el nivel: un diagnóstico peor no quita lo que ya se ganó.
  function validarHasta(nivel) {
    const actual = crudo(K.nivel);
    if (RANGO[actual] > (RANGO[nivel] || 0)) nivel = actual;
    const hasta = nivel === "avanzado" ? 15 : (nivel === "intermedio" ? 8 : 0);
    if (!hasta) return;
    try { localStorage.setItem(K.nivel, nivel); } catch (e) {}
    const st = leer(K.progreso, {});
    for (let n = 1; n <= hasta; n++) {
      const id = String(n).padStart(2, "0");
      st[id] = Object.assign({ secciones: [], quiz: false, total: 1 }, st[id], { pct: 100, validado: true });
    }
    escribir(K.progreso, st);
  }

  function nivelDeLosExamenes(examenes) {
    let mejor = null;
    lista(examenes).forEach(function (e) {
      const nv = e.tipo === "diagnostico" ? e.colocado : (e.aprobado ? e.objetivo : null);
      if (RANGO[nv] && (!mejor || RANGO[nv] > RANGO[mejor])) mejor = nv;
    });
    return mejor;
  }

  function fila(clave, meta) {
    const base = { usuario_id: uid, modulo: clave, actualizado_en: new Date(meta.t[clave]).toISOString() };
    if (clave === "tareas") {
      const ids = Object.keys(leer(K.tareas, {}));
      const enPagina = document.querySelectorAll(".task__check").length;
      if (enPagina) meta.totalTareas = enPagina;
      const total = meta.totalTareas || 0;
      return Object.assign(base, { secciones: ids, quiz: false, total: total,
        pct: total ? Math.round(Math.min(ids.length, total) / total * 100) : 0 });
    }
    const r = leer(K.progreso, {})[clave];
    if (!r) return null;
    return Object.assign(base, { secciones: lista(r.secciones), quiz: !!r.quiz, total: r.total || 0, pct: Math.round(r.pct || 0) });
  }

  function vaciar() {
    clearTimeout(temporizador); temporizador = null;
    if (!sb || !pendientes.size) return cola;
    const meta = leer(K.meta, {}); meta.t = meta.t || {};
    const filas = Array.from(pendientes).map(function (c) {
      if (!meta.t[c]) meta.t[c] = Date.now();
      return fila(c, meta);
    }).filter(Boolean);
    pendientes.clear();
    escribir(K.meta, meta);
    if (filas.length) {
      // en cola, para que dos envíos seguidos no lleguen al revés. Si falla (sin
      // internet), no pasa nada: la hora local queda por delante y se reintenta al volver
      cola = cola.then(function () {
        return sb.from("progreso").upsert(filas, { onConflict: "usuario_id,modulo" }).then(function () {}, function () {});
      });
    }
    return cola;
  }

  function cambio(clave) {
    const meta = leer(K.meta, {}); meta.t = meta.t || {};
    meta.t[clave] = Date.now();
    escribir(K.meta, meta);
    pendientes.add(clave);
    clearTimeout(temporizador);
    temporizador = setTimeout(vaciar, 400);
  }

  function conectar(cliente, idUsuario, datos) {
    sb = cliente; uid = idUsuario;
    if (window.cuentaProgreso) window.cuentaProgreso.cambio = cambio;
    else window.cuentaProgreso = { listo: Promise.resolve(), cambio: cambio };
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && pendientes.size) vaciar();
    });
    try {
      // ¿lo guardado aquí es de otra cuenta? (equipo compartido): no se mezcla
      const duena = crudo(K.cuenta);
      if (duena && duena !== idUsuario) {
        [K.progreso, K.tareas, K.nivel, K.meta].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      }
      try { localStorage.setItem(K.cuenta, idUsuario); } catch (e) {}
      if (datos) {
        fusionar(datos.filas).forEach(function (c) { pendientes.add(c); });
        const nv = nivelDeLosExamenes(datos.examenes);
        if (nv) validarHasta(nv);
      }
      const actual = crudo(K.nivel);
      if (RANGO[actual]) validarHasta(actual); // repone las marcas si se bajó un registro sin ellas
      if (pendientes.size) temporizador = setTimeout(vaciar, 1500);
    } catch (e) {}
  }

  return { traer: traer, conectar: conectar, vaciar: vaciar, validarHasta: validarHasta };
})();

// Avisa de un cambio local para que se suba a la cuenta (si hay sesión)
function avisarCambio(clave) { const c = window.cuentaProgreso; if (c) c.cambio(clave); }
// Ejecuta fn cuando el progreso de la cuenta ya está en este navegador
function despuesDeLaCuenta(fn) { const c = window.cuentaProgreso; (c ? c.listo : Promise.resolve()).then(fn); }

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
   navegador que persiste al cerrar la pestaña) y la sección 0b lo sube a la
   cuenta, para verlas igual en el teléfono y en el computador. */
const taskChecks = document.querySelectorAll(".task__check");
if (taskChecks.length) despuesDeLaCuenta(function tareasGuardadas() {
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
      avisarCambio("tareas");
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
      avisarCambio("tareas"); // el reinicio también viaja: si no, la cuenta lo devolvería
    });
  }
});

/* ---------- 9. Año dinámico en el footer ---------- */
const yearEl = document.querySelector("[data-year]");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- 9b. Service Worker (PWA: instalable + respaldo offline) ----------
   sw.js vive en la raíz del sitio; desde un módulo hay que subir un nivel.
   Registrarlo con scope de raíz hace que cubra todas las páginas. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    var enModulo = window.location.pathname.indexOf("/modulos/") !== -1;
    var swUrl = (enModulo ? "../" : "./") + "sw.js";
    navigator.serviceWorker.register(swUrl).catch(function () {});
  });
}

/* ---------- 10. Progreso del curso: secciones plegables y desbloqueo ----------
   Todo se construye desde aquí, sin tocar el HTML de los 34 módulos:
   · cada .content-block se convierte en una sección plegable
   · el alumno marca cada sección como leída y responde el quiz
   · al llegar al 80% de las actividades se desbloquea el módulo siguiente
   El progreso vive en localStorage y se sincroniza con la cuenta (0b). Es un
   control de avance pedagógico, NO una barrera de seguridad: lo que corre en
   el navegador siempre se puede saltar (justo lo que enseña el LAB 13). */
despuesDeLaCuenta(function progresoDelCurso() {
  const KEY = "academiaia-progreso";
  const UMBRAL = 80; // % de actividades para desbloquear el siguiente módulo

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function modId(href) { const m = (href || "").match(/modulo-(\d+)/); return m ? m[1] : null; }
  function prevId(id) { const n = parseInt(id, 10) - 1; return n < 1 ? null : String(n).padStart(2, "0"); }
  function pctOf(st, id) { const r = st[id]; return r && typeof r.pct === "number" ? r.pct : 0; }
  // Nivel de cada módulo: 1 básico (01-08), 2 intermedio (09-15), 3 avanzado (16+)
  function nivelModulo(id) { const n = parseInt(id, 10); return n <= 8 ? 1 : (n <= 15 ? 2 : 3); }
  // Nivel que abrió el examen de nivelación: avanzado=3, intermedio=2, ninguno=0
  function nivelExamen() {
    try { const v = localStorage.getItem("academiaia-nivel"); return v === "avanzado" ? 3 : (v === "intermedio" ? 2 : 0); }
    catch (e) { return 0; }
  }
  function unlocked(st, id) {
    if (nivelModulo(id) <= 2) return true; // básico e intermedio (01-15): siempre abiertos, sin candado
    if (nivelModulo(id) <= nivelExamen()) return true; // avanzado: si tu examen te colocó en avanzado
    const p = prevId(id); return !p || pctOf(st, p) >= UMBRAL; // si no, candado por progreso
  }
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
    const validado = rec.validado === true; // lo validó el examen de nivelación

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
    // descartar secciones que ya no existen (el módulo cambió o vienen de otra versión)
    leidas = leidas.filter((id) => secciones.some((b) => b.id === id));

    function render() {
      const done = leidas.length + (quizHecho ? 1 : 0);
      const calc = total ? Math.round((done / total) * 100) : 0;
      const pct = validado ? 100 : calc;
      fill.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      bar.classList.toggle("done", pct >= UMBRAL);
      const need = Math.ceil((UMBRAL / 100) * total);
      hint.textContent = validado && calc < 100
        ? "Validado con tu examen de nivelación. Las secciones quedan para repasar cuando quieras."
        : pct >= UMBRAL
        ? "¡Módulo completado! Ya puedes pasar al siguiente."
        : done + " de " + total + " actividades · te faltan " + Math.max(0, need - done) +
          " para llegar al " + UMBRAL + "% y desbloquear el módulo siguiente.";
      if (nextA) nextA.classList.toggle("locked", pct < UMBRAL);
      return pct;
    }

    function persist() {
      const pct = render();
      const st = load();
      const nuevo = { secciones: leidas, quiz: quizHecho, total: total, pct: pct };
      if (validado) nuevo.validado = true;
      if (JSON.stringify(st[here]) === JSON.stringify(nuevo)) return; // nada cambió: nada que subir
      st[here] = nuevo;
      save(st);
      avisarCambio(here);
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
      // las secciones se pliegan después de traer la cuenta: hay que volver a ubicarla
      if (t && t.classList.contains("cb")) { open(t); t.scrollIntoView(); }
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
});

/* ---------- 11. Términos del glosario enlazados dentro de los módulos ----------
   Lee glosario.html (única fuente de verdad: no se duplican definiciones aquí)
   y convierte la PRIMERA aparición de cada término en un enlace. Al tocarlo se
   abre una tarjeta con la definición, sin salir del módulo.
   · No se enlaza el término en el módulo donde se enseña (sería redundante).
   · Se omiten términos demasiado comunes y sentidos distintos (el «token» de
     Telegram es una llave, no el token de un modelo de lenguaje). */
(function glosarioEnModulos() {
  if (!document.querySelector(".mod-hero") || location.pathname.indexOf("/modulos/") === -1) return;

  const CACHE = "academiaia-glosario-v2";
  const MAX_ENLACES = 10;
  const OMITIR = ["inteligencia-artificial", "prompt", "evaluacion"];
  const OMITIR_EN = { token: ["13", "24"] }; // módulos donde la palabra significa otra cosa
  const EXCLUIR = "a, code, pre, kbd, h1, h2, h3, h4, h5, h6, button, label, figcaption, script, style, svg, input, textarea, .quiz, .toc, .mod-nav, .label, .src, .n";
  function numMod(ruta) { return ((ruta || "").match(/modulo-(\d+)/) || [])[1] || ""; }
  const modActual = numMod(location.pathname);

  function cargar() {
    try { const c = sessionStorage.getItem(CACHE); if (c) return Promise.resolve(JSON.parse(c)); } catch (e) {}
    return fetch("../glosario.html").then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const lista = Array.prototype.map.call(doc.querySelectorAll(".gloss__item[id]"), function (it) {
        const def = it.querySelector(".gloss__def").cloneNode(true);
        const mod = def.querySelector('a[href*="modulos/"]');
        Array.prototype.forEach.call(def.querySelectorAll("a"), function (a) { a.remove(); });
        return { id: it.id, term: it.querySelector(".gloss__term").textContent.trim(),
                 def: def.textContent.trim(), mod: mod ? numMod(mod.getAttribute("href")) : "" };
      });
      try { sessionStorage.setItem(CACHE, JSON.stringify(lista)); } catch (e) {}
      return lista;
    });
  }

  // "Alucinación" debe encontrar "alucinaciones"; "Multi-agente" también "multiagente"
  const VOCAL = { a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uúü]" };
  function patron(t) {
    return t.toLowerCase().split("").map(function (c) {
      if (VOCAL[c]) return VOCAL[c];
      if (c === " ") return "\\s+";
      if (c === "-") return "[-\\s]?";
      return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("") + "(?:es|s)?";
  }

  function preparar(lista) {
    const formas = [];
    lista.forEach(function (g) {
      if (OMITIR.indexOf(g.id) !== -1 || g.mod === modActual) return;
      if (OMITIR_EN[g.id] && OMITIR_EN[g.id].indexOf(modActual) !== -1) return;
      const base = g.term.replace(/\s*\(.*?\)\s*/g, "").trim();
      formas.push({ g: g, txt: base });
      const sigla = (g.term.match(/\(([A-Z]{2,5})\)/) || [])[1];
      if (sigla && sigla !== "IA") formas.push({ g: g, txt: sigla });
    });
    formas.sort(function (a, b) { return b.txt.length - a.txt.length; }); // "Agente autónomo" antes que "Agente"
    formas.forEach(function (f) { f.sigla = f.txt.length <= 5 && f.txt === f.txt.toUpperCase(); });
    const re = new RegExp("(?<![\\p{L}\\p{N}])(?:" + formas.map(function (f) { return "(" + patron(f.txt) + ")"; }).join("|") + ")(?![\\p{L}\\p{N}])", "giu");
    return { formas: formas, re: re };
  }

  function enlazar(lista) {
    if (!lista || !lista.length) return;
    const p = preparar(lista);
    const usados = {};
    let total = 0;
    const nodos = [];
    document.querySelectorAll(".content-block").forEach(function (bloque) {
      const w = document.createTreeWalker(bloque, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          return n.data.trim() && !n.parentElement.closest(EXCLUIR) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      while (w.nextNode()) nodos.push(w.currentNode);
    });

    nodos.forEach(function (nodo) {
      let resto = nodo;
      while (resto && total < MAX_ENLACES) {
        let hallado = null;
        for (const m of resto.data.matchAll(p.re)) {
          const i = m.slice(1).findIndex(function (x) { return x !== undefined; });
          const f = p.formas[i];
          if (usados[f.g.id]) continue;
          if (f.sigla && [f.txt, f.txt + "s", f.txt + "es"].indexOf(m[0]) === -1) continue; // siglas: solo en mayúsculas
          hallado = { m: m, g: f.g };
          break;
        }
        if (!hallado) break;
        const medio = resto.splitText(hallado.m.index);
        resto = medio.splitText(hallado.m[0].length);
        const a = document.createElement("a");
        a.className = "gloss-link";
        a.href = "../glosario.html#" + hallado.g.id;
        a.textContent = medio.data;
        a.dataset.g = hallado.g.id;
        medio.replaceWith(a);
        usados[hallado.g.id] = hallado.g;
        total++;
      }
    });

    if (total) tarjeta(usados);
  }

  // Una sola tarjeta flotante reutilizable, posicionada bajo (o sobre) el término
  function tarjeta(usados) {
    const pop = document.createElement("div");
    pop.className = "gloss-pop";
    pop.setAttribute("role", "dialog");
    pop.hidden = true;
    const titulo = document.createElement("strong");
    const def = document.createElement("p");
    const ver = document.createElement("a");
    ver.textContent = "Ver en el glosario →";
    pop.append(titulo, def, ver);
    document.body.appendChild(pop);
    let abierto = null;

    function cerrar() { pop.hidden = true; abierto = null; }
    function abrir(link) {
      const g = usados[link.dataset.g];
      titulo.textContent = g.term;
      def.textContent = g.def;
      ver.href = link.href;
      pop.setAttribute("aria-label", g.term);
      pop.hidden = false;
      const r = link.getBoundingClientRect();
      const ancho = pop.offsetWidth, alto = pop.offsetHeight;
      const x = Math.min(Math.max(16, r.left), window.innerWidth - ancho - 16);
      const abajo = r.bottom + 8 + alto < window.innerHeight;
      pop.style.left = (x + window.scrollX) + "px";
      pop.style.top = ((abajo ? r.bottom + 8 : r.top - alto - 8) + window.scrollY) + "px";
      abierto = link;
    }

    document.addEventListener("click", function (e) {
      const link = e.target.closest && e.target.closest(".gloss-link");
      if (link) { e.preventDefault(); if (abierto === link) cerrar(); else abrir(link); return; }
      if (!pop.contains(e.target)) cerrar();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrar(); });
    window.addEventListener("resize", cerrar);
  }

  cargar().then(enlazar).catch(function () {});
})();
