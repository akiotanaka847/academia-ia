/* =====================================================================
   ACADEMIA IA · Examen de nivelación
   Las preguntas llegan SIN la respuesta correcta (RPC examen_generar /
   examen_diagnostico) y la calificación se hace en el servidor
   (RPC examen_calificar). El navegador nunca ve qué opción es correcta
   hasta que envías tus respuestas: imposible hacer trampa desde el cliente.
   ===================================================================== */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://riqhbhvtfzebosdobdkf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpcWhiaHZ0ZnplYm9zZG9iZGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjI4NzIsImV4cCI6MjEwMDIzODg3Mn0.LR_SblaObzJ5vIC3tRHDyfNxZ65Cq6bh0x6D-66tm8k";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (s) => document.querySelector(s);
const secIntro = $("#exam-intro"), secRun = $("#exam-run"), secResult = $("#exam-result");
const NOMBRE = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado" };
const LETRAS = ["A", "B", "C", "D"];
const MODULO_INICIO = {
  principiante: "modulos/modulo-01-introduccion-ia.html",
  intermedio: "modulos/modulo-09-mapear-procesos.html",
  avanzado: "modulos/modulo-16-github.html",
};

let preguntas = [], respuestas = {}, idx = 0, modo = "diagnostico", objetivo = null;

function ver(sec) {
  [secIntro, secRun, secResult].forEach((s) => { if (s) s.hidden = s !== sec; });
  window.scrollTo(0, 0);
}
function aviso(t) { const el = $('[data-exam="aviso"]'); if (el) el.textContent = t || ""; }

/* No repetir: excluir las preguntas del intento anterior de este modo. */
function keyExcl() { return "academiaia-examen-ult-" + (modo === "reto" ? objetivo : "diag"); }
function leerExcl() { try { return JSON.parse(localStorage.getItem(keyExcl())) || []; } catch (e) { return []; } }
function guardarExcl(ids) { try { localStorage.setItem(keyExcl(), JSON.stringify(ids)); } catch (e) {} }

async function iniciar(m, obj) {
  modo = m; objetivo = obj || null; respuestas = {}; idx = 0; aviso("");
  const excl = leerExcl();
  let data, error;
  if (modo === "diagnostico") {
    ({ data, error } = await sb.rpc("examen_diagnostico", { p_por_nivel: 6, p_excluir: excl }));
  } else {
    ({ data, error } = await sb.rpc("examen_generar", { p_nivel: objetivo, p_n: 12, p_excluir: excl }));
  }
  if (error) { aviso("No se pudo cargar el examen: " + (error.message || "error") + ". ¿Ya ejecutaste el SQL del examen en Supabase?"); return; }
  preguntas = Array.isArray(data) ? data : [];
  if (!preguntas.length) { aviso("No hay preguntas disponibles todavía. Ejecuta los SQL del examen en Supabase y vuelve a intentarlo."); return; }
  guardarExcl(preguntas.map((q) => q.id));
  $('[data-exam="titulo"]').textContent = modo === "diagnostico" ? "Diagnóstico" : ("Reto " + NOMBRE[objetivo]);
  ver(secRun);
  render();
}

function render() {
  const q = preguntas[idx];
  $('[data-exam="pregunta"]').textContent = q.pregunta;
  $('[data-exam="contador"]').textContent = (idx + 1) + " / " + preguntas.length;
  $('[data-exam="fill"]').style.width = Math.round((idx / preguntas.length) * 100) + "%";

  const cont = $('[data-exam="opciones"]'); cont.textContent = "";
  (q.opciones || []).forEach((op, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "exam-opt" + (respuestas[q.id] === i ? " sel" : "");
    const k = document.createElement("span"); k.className = "exam-opt__k"; k.textContent = LETRAS[i];
    const t = document.createElement("span"); t.textContent = op;
    b.appendChild(k); b.appendChild(t);
    b.addEventListener("click", () => { respuestas[q.id] = i; render(); });
    cont.appendChild(b);
  });

  $('[data-exam="anterior"]').style.visibility = idx === 0 ? "hidden" : "visible";
  const sig = $('[data-exam="siguiente"]');
  sig.disabled = false;
  sig.textContent = idx === preguntas.length - 1 ? "Finalizar y ver resultado" : "Siguiente →";
}

async function calificar() {
  const sig = $('[data-exam="siguiente"]');
  sig.disabled = true; sig.textContent = "Calificando…";
  const payload = preguntas.map((q) => ({ id: q.id, elegida: respuestas[q.id] }));
  const { data, error } = await sb.rpc("examen_calificar", { p_respuestas: payload, p_tipo: modo, p_objetivo: objetivo });
  if (error) {
    aviso("No se pudo calificar: " + (error.message || "error"));
    sig.disabled = false; sig.textContent = "Finalizar y ver resultado";
    return;
  }
  mostrarResultado(data);
}

function desbloquearHasta(nivel) {
  try { localStorage.setItem("academiaia-nivel", nivel); } catch (e) {} // tu nivel abre los módulos de ese nivel
  const KEY = "academiaia-progreso";
  let hasta = nivel === "avanzado" ? 15 : (nivel === "intermedio" ? 8 : 0);
  if (!hasta) return;
  let st = {};
  try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  for (let n = 1; n <= hasta; n++) {
    const id = String(n).padStart(2, "0");
    st[id] = { secciones: [], quiz: true, total: 1, pct: 100, validado: true };
  }
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
}

function mostrarResultado(r) {
  const pct = Math.round((r.pct || 0) * 100);
  const umbral = Math.round((r.umbral || 0.8) * 100);
  secResult.classList.toggle("aprob", !!r.aprobado);
  $('[data-exam="score"]').textContent = pct + "%";

  const veredicto = $('[data-exam="veredicto"]'), sub = $('[data-exam="subveredicto"]');
  if (modo === "diagnostico") {
    veredicto.textContent = "Tu nivel: " + NOMBRE[r.colocado];
    sub.textContent = "Según tu desempeño, te colocamos en " + NOMBRE[r.colocado] + ". Puedes empezar ahí, o donde prefieras.";
  } else {
    veredicto.textContent = r.aprobado ? ("¡Aprobaste " + NOMBRE[objetivo] + "!") : ("Aún no alcanzas " + NOMBRE[objetivo]);
    sub.textContent = r.aprobado
      ? "Validamos tu nivel: se te desbloquean los módulos previos para empezar directo."
      : ("Necesitas al menos " + umbral + "%. Repasa y reinténtalo: saldrán otras preguntas.");
  }

  const nc = $('[data-exam="niveles"]'); nc.textContent = "";
  ["principiante", "intermedio", "avanzado"].forEach((nv) => {
    const d = (r.niveles || {})[nv];
    if (!d) return;
    const p = Math.round((d.pct || 0) * 100);
    const box = document.createElement("div");
    box.className = "exam-nivel" + (p >= umbral ? " ok" : "");
    const t = document.createElement("div"); t.className = "exam-nivel__t"; t.textContent = NOMBRE[nv];
    const pv = document.createElement("div"); pv.className = "exam-nivel__p"; pv.textContent = p + "%";
    const bar = document.createElement("div"); bar.className = "exam-nivel__bar";
    const bi = document.createElement("i"); bi.style.width = p + "%"; bar.appendChild(bi);
    const meta = document.createElement("div");
    meta.style.fontSize = ".75rem"; meta.style.color = "var(--text-dim)"; meta.style.marginTop = "6px";
    meta.textContent = d.aciertos + "/" + d.total + " aciertos";
    box.appendChild(t); box.appendChild(pv); box.appendChild(bar); box.appendChild(meta);
    nc.appendChild(box);
  });

  const ac = $('[data-exam="acciones"]'); ac.textContent = "";
  const nivelFinal = modo === "diagnostico" ? r.colocado : (r.aprobado ? objetivo : null);
  if (nivelFinal && nivelFinal !== "principiante") {
    desbloquearHasta(nivelFinal);
    const a = document.createElement("a");
    a.className = "btn btn--primary";
    a.href = MODULO_INICIO[nivelFinal] || "index.html#ruta";
    a.textContent = "Empezar en " + NOMBRE[nivelFinal] + " →";
    ac.appendChild(a);
  } else if (modo === "diagnostico") {
    const a = document.createElement("a");
    a.className = "btn btn--primary";
    a.href = MODULO_INICIO.principiante;
    a.textContent = "Empezar por el principio →";
    ac.appendChild(a);
  }
  const idxLink = document.createElement("a");
  idxLink.className = "btn btn--text"; idxLink.href = "index.html#ruta"; idxLink.textContent = "Ver el temario";
  ac.appendChild(idxLink);

  const rv = $('[data-exam="review"]'); rv.textContent = "";
  const porId = {};
  (r.detalle || []).forEach((d) => { porId[d.id] = d; });
  preguntas.forEach((q) => {
    const d = porId[q.id] || {};
    const acert = !!d.acierto;
    const el = document.createElement("div");
    el.className = "exam-rev " + (acert ? "ok" : "no");
    const qq = document.createElement("div"); qq.className = "exam-rev__q"; qq.textContent = (acert ? "✓ " : "✗ ") + q.pregunta;
    const aa = document.createElement("div"); aa.className = "exam-rev__a";
    const tuTxt = q.opciones && q.opciones[respuestas[q.id]] !== undefined ? q.opciones[respuestas[q.id]] : "(sin responder)";
    const coTxt = q.opciones && q.opciones[d.correcta] !== undefined ? q.opciones[d.correcta] : "—";
    if (acert) {
      const b = document.createElement("b"); b.textContent = "Correcto: " + coTxt; aa.appendChild(b);
    } else {
      aa.appendChild(document.createTextNode("Tu respuesta: " + tuTxt + " · "));
      const b = document.createElement("b"); b.textContent = "Correcta: " + coTxt; aa.appendChild(b);
    }
    el.appendChild(qq); el.appendChild(aa);
    if (d.explicacion) {
      const ex = document.createElement("div"); ex.className = "exam-rev__exp"; ex.textContent = d.explicacion;
      el.appendChild(ex);
    }
    rv.appendChild(el);
  });

  ver(secResult);
}

/* ---------- Conexiones ---------- */
document.querySelectorAll(".exam-choice").forEach((c) =>
  c.addEventListener("click", () => iniciar(c.dataset.modo, c.dataset.nivel))
);
$('[data-exam="siguiente"]').addEventListener("click", () => {
  const q = preguntas[idx];
  if (respuestas[q.id] === undefined) { aviso("Elige una opción para continuar."); return; }
  aviso("");
  if (idx < preguntas.length - 1) { idx++; render(); } else { calificar(); }
});
$('[data-exam="anterior"]').addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
$('[data-exam="reiniciar"]').addEventListener("click", () => { ver(secIntro); aviso(""); });
