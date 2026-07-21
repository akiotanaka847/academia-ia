/* =====================================================================
   ACADEMIA IA · Acceso (Supabase)

   Flujo completo:
     1. Registro  → Supabase envía correo de confirmación
     2. Tú apruebas a la persona en el panel (perfiles.aprobado = true)
     3. Login     → contraseña correcta + está aprobada
     4. Segundo factor → código de 6 dígitos al correo
     5. Entra al curso

   Sobre el segundo factor: tras validar la contraseña cerramos la sesión
   y pedimos un código por correo. Así la única sesión que queda viva es
   la que nace de verificar el código, y hacen falta DE VERDAD las dos
   cosas (saber la contraseña + tener acceso al correo).

   Las claves de abajo son PÚBLICAS por diseño (van en el navegador). La
   seguridad real la ponen las políticas RLS de sql/supabase-setup.sql.
   ===================================================================== */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://riqhbhvtfzebosdobdkf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpcWhiaHZ0ZnplYm9zZG9iZGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjI4NzIsImV4cCI6MjEwMDIzODg3Mn0.LR_SblaObzJ5vIC3tRHDyfNxZ65Cq6bh0x6D-66tm8k";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Utilidades de interfaz ---------- */
const $ = (sel) => document.querySelector(sel);
const vistas = ["login", "registro", "codigo", "pendiente", "dentro"];
let correoPendiente = "";

function verVista(nombre) {
  vistas.forEach((v) => {
    const el = document.getElementById("vista-" + v);
    if (el) el.hidden = v !== nombre;
  });
  const aviso = $("#auth-msg");
  if (aviso) { aviso.textContent = ""; aviso.className = "auth__msg"; }
}

function msg(tipo, texto) {
  const el = $("#auth-msg");
  if (!el) return;
  el.className = "auth__msg " + tipo;
  el.textContent = texto;
}

function cargando(boton, activo, textoOriginal) {
  if (!boton) return;
  boton.disabled = activo;
  boton.textContent = activo ? "Un momento…" : textoOriginal;
}

/* A dónde ir después de entrar: si el guardián nos mandó aquí desde una
   página concreta, volvemos ahí. Solo aceptamos rutas internas (que empiecen
   por "/" pero no por "//"), para que nadie pueda usar esto como trampolín
   hacia otro sitio web. */
function destinoTrasLogin() {
  const p = new URLSearchParams(window.location.search).get("volver");
  if (p && p.charAt(0) === "/" && p.charAt(1) !== "/") return p;
  return "index.html";
}

/* ---------- Estado inicial: ¿ya hay sesión? ---------- */
async function estadoInicial() {
  // Si el guardián nos redirigió, explicamos por qué
  const params = new URLSearchParams(window.location.search);
  const motivo = params.get("motivo");
  const veniaDeOtraPagina = params.get("volver") !== null;
  const { data } = await sb.auth.getSession();

  if (!data || !data.session) {
    verVista("login");
    if (motivo === "pendiente") msg("err", "Tu cuenta todavía no está aprobada por el administrador.");
    else if (motivo === "error" || motivo === "lento") msg("err", "No pudimos verificar tu sesión. Vuelve a entrar.");
    else if (veniaDeOtraPagina) msg("err", "Inicia sesión para acceder al curso.");
    return;
  }

  const perfil = await leerPerfil(data.session.user.id);
  if (perfil && perfil.aprobado) {
    const quien = $("#dentro-email");
    if (quien) quien.textContent = perfil.nombre || perfil.email;
    const irAlCurso = $("#ir-al-curso");
    if (irAlCurso) irAlCurso.href = destinoTrasLogin();
    verVista("dentro");
  } else {
    await sb.auth.signOut();
    verVista("pendiente");
  }
}

async function leerPerfil(id) {
  const { data, error } = await sb
    .from("perfiles")
    .select("email, nombre, aprobado")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    // Lo más común: todavía no se ejecutó sql/supabase-setup.sql
    console.warn("No se pudo leer el perfil:", error.message);
    return null;
  }
  return data;
}

/* ---------- 1 · Registro ---------- */
async function registrarse(ev) {
  ev.preventDefault();
  const nombre = $("#reg-nombre").value.trim();
  const email = $("#reg-email").value.trim().toLowerCase();
  const pass = $("#reg-pass").value;
  const btn = $("#reg-btn");

  if (nombre.length < 2) return msg("err", "Escribe tu nombre completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg("err", "Ese correo no tiene un formato válido.");
  if (pass.length < 8) return msg("err", "La contraseña debe tener al menos 8 caracteres.");

  cargando(btn, true);
  const { error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { nombre: nombre }, emailRedirectTo: window.location.href },
  });
  cargando(btn, false, "Crear mi cuenta");

  if (error) return msg("err", "No se pudo crear la cuenta: " + error.message);
  verVista("pendiente");
  msg("ok", "Cuenta creada. Revisa tu correo y confirma tu dirección.");
}

/* ---------- 2 · Entrar (contraseña → aprobación → código) ---------- */
async function entrar(ev) {
  ev.preventDefault();
  const email = $("#log-email").value.trim().toLowerCase();
  const pass = $("#log-pass").value;
  const btn = $("#log-btn");
  if (!email || !pass) return msg("err", "Escribe tu correo y tu contraseña.");

  cargando(btn, true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    cargando(btn, false, "Entrar →");
    if (/not confirmed/i.test(error.message)) {
      return msg("err", "Todavía no confirmaste tu correo. Busca el mensaje de confirmación en tu bandeja.");
    }
    return msg("err", "Correo o contraseña incorrectos.");
  }

  // ¿La persona está aprobada por el administrador?
  const perfil = await leerPerfil(data.user.id);
  if (!perfil || !perfil.aprobado) {
    await sb.auth.signOut();
    cargando(btn, false, "Entrar →");
    return verVista("pendiente");
  }

  // Segundo factor: cerramos la sesión y exigimos la prueba del correo
  await sb.auth.signOut();
  const { error: errOtp } = await sb.auth.signInWithOtp({
    email,
    // OJO: en supabase-js v2 estas opciones van DENTRO de "options".
    // Si shouldCreateUser queda fuera, se ignora y vale true: cualquiera
    // podría crearse una cuenta por esta vía saltándose tu aprobación.
    options: { shouldCreateUser: false, emailRedirectTo: urlDeVuelta() },
  });
  cargando(btn, false, "Entrar →");

  if (errOtp) return msg("err", "No se pudo enviar el correo: " + errOtp.message);
  correoPendiente = email;
  const destino = $("#codigo-destino");
  if (destino) destino.textContent = email;
  verVista("codigo");
  msg("ok", "Te enviamos un correo. Ábrelo para terminar de entrar.");
}

/* A dónde debe volver el enlace del correo: la misma página, sin ancla.
   Así funciona igual en Netlify que en GitHub Pages (ambas autorizadas). */
function urlDeVuelta() {
  return window.location.href.split("#")[0].split("?")[0];
}

/* ---------- 3 · Verificar el código (segundo factor) ---------- */
async function verificarCodigo(ev) {
  ev.preventDefault();
  const code = $("#cod-input").value.trim();
  const btn = $("#cod-btn");
  if (!/^\d{6}$/.test(code)) return msg("err", "El código son 6 dígitos.");

  cargando(btn, true);
  const { data, error } = await sb.auth.verifyOtp({
    email: correoPendiente,
    token: code,
    type: "email",
  });
  cargando(btn, false, "Verificar y entrar →");

  if (error) return msg("err", "Código incorrecto o caducado. Pide uno nuevo.");

  const perfil = await leerPerfil(data.user.id);
  if (!perfil || !perfil.aprobado) {
    await sb.auth.signOut();
    return verVista("pendiente");
  }
  window.location.href = destinoTrasLogin();
}

async function reenviarCodigo() {
  if (!correoPendiente) return;
  const { error } = await sb.auth.signInWithOtp({
    email: correoPendiente,
    options: { shouldCreateUser: false, emailRedirectTo: urlDeVuelta() },
  });
  msg(error ? "err" : "ok", error ? "No se pudo reenviar: " + error.message : "Correo reenviado.");
}

/* ---------- 4 · Salir ---------- */
async function salir() {
  await sb.auth.signOut();
  verVista("login");
  msg("ok", "Sesión cerrada.");
}

/* ---------- Conexiones ---------- */
function on(sel, evento, fn) { const el = $(sel); if (el) el.addEventListener(evento, fn); }

on("#form-registro", "submit", registrarse);
on("#form-login", "submit", entrar);
on("#form-codigo", "submit", verificarCodigo);
on("#cod-reenviar", "click", reenviarCodigo);
on("#btn-salir", "click", salir);
on("#ir-registro", "click", (e) => { e.preventDefault(); verVista("registro"); });
on("#ir-login", "click", (e) => { e.preventDefault(); verVista("login"); });
on("#pendiente-volver", "click", (e) => { e.preventDefault(); verVista("login"); });

estadoInicial();
