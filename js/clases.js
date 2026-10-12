/* =====================================================================
   ACADEMIA IA · Clases prácticas
   Simuladores y entregables de las clases con formato «aprende,
   constrúyelo, úsalo y llévatelo». Todo corre en el navegador.
   Igual que en labs.js: solo textContent y nodos DOM (nunca innerHTML).
   ===================================================================== */

function claseEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}
function claseIcono(nombre) {
  const i = claseEl("span", "ico ico--" + nombre);
  i.setAttribute("aria-hidden", "true");
  return i;
}

/* ---------------------------------------------------------------------
   CLASE 01 · Simulador del bucle del agente
   El alumno elige las cinco piezas y el agente sigue un guion distinto
   según lo que falte. Orden de los fallos: sin herramienta para leer →
   herramienta peligrosa con reglas vagas → sin memoria → reglas vagas →
   sin herramienta para avisar → sin parada → todo bien.
--------------------------------------------------------------------- */
(function simuladorAgente() {
  const sim = document.querySelector(".agente-sim");
  if (!sim) return;
  const traza = sim.querySelector(".traza");
  const veredicto = sim.querySelector(".agente-sim__veredicto");
  const btn = sim.querySelector(".agente-sim__run");
  const pass = document.querySelector(".clase-pass");

  const TAREAS = "4 tareas: «Diseño de banners» (Ana, vence 3 oct, 60\u00a0%) · «Copy para redes» (Luis, vence 9 oct, 100\u00a0%) · " +
    "«Aprobación del cliente» (Marta, vence 1 oct, 0\u00a0%) · «Plan de medios» (Ana, vence 20 oct, 30\u00a0%)";
  const BUSCAR = { t: "actua", txt: "buscar_tareas(proyecto: \"Aurora\")" };
  const VER_TAREAS = { t: "observa", txt: TAREAS };

  function leer() {
    const tools = Array.prototype.map.call(sim.querySelectorAll('input[name="tool"]:checked'), (i) => i.value);
    return {
      claras: sim.querySelector('input[name="instr"]:checked').value === "claras",
      buscar: tools.indexOf("buscar") !== -1,
      enviar: tools.indexOf("enviar") !== -1,
      cambiar: tools.indexOf("cambiar") !== -1,
      memoria: sim.querySelector('input[name="memoria"]').checked,
      parada: sim.querySelector('input[name="parada"]').checked,
    };
  }

  // Devuelve { pasos, nivel: "ok" | "aviso" | "mal", titulo, texto }
  function guion(p) {
    const avisar = [
      { t: "piensa", txt: "Hay 2 atrasadas: «Aprobación del cliente» (Marta) y «Diseño de banners» (Ana). Aviso a cada una." },
      { t: "actua", txt: "enviar_mensaje(para: \"Marta\", tarea: \"Aprobación del cliente\")" },
      { t: "observa", txt: "Mensaje enviado a Marta." },
      { t: "actua", txt: "enviar_mensaje(para: \"Ana\", tarea: \"Diseño de banners\")" },
      { t: "observa", txt: "Mensaje enviado a Ana." },
    ];

    if (!p.buscar) {
      return {
        pasos: [
          { t: "piensa", txt: "Necesito las tareas del proyecto Aurora, pero no tengo ninguna forma de consultarlas." },
          { t: "responde", txt: "«Seguramente hay 2 o 3 tareas atrasadas, probablemente las de diseño. Te recomiendo revisarlas.»" },
        ],
        nivel: "mal", titulo: "Inventó la respuesta",
        texto: "Sin una herramienta para leer Workfront solo pudo adivinar, y lo dijo con total seguridad. Así nacen las alucinaciones.",
      };
    }
    if (p.cambiar && !p.claras) {
      return {
        pasos: [
          { t: "piensa", txt: "Me piden ayudar con los proyectos. Reviso Aurora." }, BUSCAR, VER_TAREAS,
          { t: "piensa", txt: "Hay 2 tareas atrasadas. La forma más rápida de que no haya atrasos es mover sus fechas." },
          { t: "actua", txt: "cambiar_fecha(tarea: \"Aprobación del cliente\", nueva: \"15 oct\")" },
          { t: "actua", txt: "cambiar_fecha(tarea: \"Diseño de banners\", nueva: \"15 oct\")" },
          { t: "responde", txt: "«Listo: el proyecto Aurora ya no tiene tareas atrasadas.»" },
        ],
        nivel: "mal", titulo: "Hizo algo que nadie pidió",
        texto: "Con reglas vagas y permiso para cambiar fechas, «resolvió» el atraso escondiéndolo. Dale solo las herramientas que necesita y reglas claras.",
      };
    }
    if (!p.memoria) {
      const pasos = [{ t: "piensa", txt: "Tengo que revisar las tareas de Aurora." }, BUSCAR, VER_TAREAS];
      const vueltas = p.parada ? 1 : 3;
      for (let i = 0; i < vueltas; i++) {
        pasos.push({ t: "piensa", txt: "No recuerdo si ya revisé las tareas. Mejor las busco." }, BUSCAR, VER_TAREAS);
      }
      return {
        pasos: pasos.concat([{ t: "corte", txt: p.parada ? "Repite lo mismo hasta el tope de 6 vueltas y se detiene sin terminar." : "Corte de seguridad del simulador: sin parada seguiría para siempre." }]),
        nivel: "mal", titulo: "Se quedó dando vueltas",
        texto: "Sin memoria olvidó que ya había buscado y repitió lo mismo. Cada vuelta gasta tiempo y dinero. " +
          (p.parada ? "La parada al menos lo detuvo." : "Y sin parada, nada lo habría detenido."),
      };
    }
    if (!p.claras) {
      return {
        pasos: [
          { t: "piensa", txt: "«Ayúdame con mis proyectos»… no sé qué necesita exactamente. Reviso Aurora." }, BUSCAR, VER_TAREAS,
          { t: "responde", txt: "«Aurora tiene 4 tareas: 1 terminada y 3 abiertas. ¿Quieres que haga algo con ellas?»" },
        ],
        nivel: "aviso", titulo: "Hizo algo, pero no lo que querías",
        texto: "Con instrucciones vagas tuvo que adivinar el objetivo: resumió el proyecto y no avisó a nadie. Di qué quieres lograr y qué no debe hacer.",
      };
    }
    if (!p.enviar) {
      return {
        pasos: [
          { t: "piensa", txt: "Busco las tareas atrasadas de Aurora." }, BUSCAR, VER_TAREAS,
          { t: "piensa", txt: "Hay 2 atrasadas. Debo avisar a Marta y a Ana, pero no tengo cómo enviar mensajes." },
          { t: "responde", txt: "«Atrasadas: Aprobación del cliente (Marta) y Diseño de banners (Ana). No pude avisarles.»" },
        ],
        nivel: "aviso", titulo: "Encontró el problema, pero no pudo avisar",
        texto: "Le falta la herramienta para enviar mensajes. Las herramientas son lo único que un agente puede hacer.",
      };
    }
    const base = [{ t: "piensa", txt: "Busco las tareas atrasadas de Aurora y aviso a cada responsable." }, BUSCAR, VER_TAREAS].concat(avisar);
    if (!p.parada) {
      return {
        pasos: base.concat([
          { t: "piensa", txt: "¿Habrá algo más? Por si acaso, reviso otra vez." }, BUSCAR, VER_TAREAS,
          { t: "piensa", txt: "Las mismas 2 tareas. Por si acaso, reviso otra vez." }, BUSCAR,
          { t: "corte", txt: "Corte de seguridad del simulador: el agente no sabía cuándo parar." },
        ]),
        nivel: "mal", titulo: "No sabía cuándo parar",
        texto: "Cumplió la misión, pero siguió dando vueltas «por si acaso». La parada le dice cuándo terminar: objetivo cumplido o un tope de vueltas.",
      };
    }
    const final = base.concat([
      { t: "piensa", txt: "Avisé a todas las personas con tareas atrasadas. Objetivo cumplido." },
      { t: "responde", txt: "«Revisé 4 tareas de Aurora: 2 atrasadas. Avisé a Marta (Aprobación del cliente) y a Ana (Diseño de banners).»" },
    ]);
    if (p.cambiar) {
      return {
        pasos: final, nivel: "aviso", titulo: "Funcionó, pero sobra una herramienta",
        texto: "Las reglas claras le impidieron cambiar fechas, pero tenía permiso para hacerlo. Quítale lo que no necesita: es el principio de mínimo privilegio.",
      };
    }
    return {
      pasos: final, nivel: "ok", titulo: "¡Agente funcionando!",
      texto: "Leyó datos reales, avisó solo a quien debía y supo cuándo terminar. Esas son las cinco piezas trabajando juntas.",
    };
  }

  const ETIQUETA = { piensa: "Piensa", actua: "Actúa", observa: "Observa", responde: "Responde", corte: "Se detiene" };
  // «Responde» es neutro: la respuesta puede estar mal (el veredicto es quien juzga)
  const ICONO = { piensa: "sparkle", actua: "zap", observa: "search", responde: "file-text", corte: "alert" };

  let temporizadores = [];
  function ejecutar() {
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
    traza.textContent = "";
    veredicto.hidden = true;
    const g = guion(leer());
    const pausa = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320;
    g.pasos.forEach((paso, i) => {
      temporizadores.push(setTimeout(() => {
        const li = claseEl("li", "traza__paso traza__paso--" + paso.t);
        li.appendChild(claseIcono(ICONO[paso.t]));
        const cuerpo = claseEl("div");
        cuerpo.appendChild(claseEl("b", null, ETIQUETA[paso.t]));
        cuerpo.appendChild(claseEl(paso.t === "actua" ? "code" : "span", null, paso.txt));
        li.appendChild(cuerpo);
        traza.appendChild(li);
      }, pausa * i));
    });
    temporizadores.push(setTimeout(() => {
      veredicto.textContent = "";
      veredicto.className = "agente-sim__veredicto " + g.nivel;
      veredicto.appendChild(claseIcono(g.nivel === "ok" ? "check-circle" : (g.nivel === "aviso" ? "alert" : "x-circle")));
      const t = claseEl("div");
      t.appendChild(claseEl("b", null, g.titulo));
      t.appendChild(claseEl("span", null, g.texto));
      veredicto.appendChild(t);
      veredicto.hidden = false;
      if (g.nivel === "ok" && pass) pass.classList.add("show");
    }, pausa * g.pasos.length));
  }
  btn.addEventListener("click", ejecutar);
})();

/* ---------------------------------------------------------------------
   Entregables «Llévatelo»: copiar o descargar como archivo .md
--------------------------------------------------------------------- */
document.querySelectorAll("[data-copiar]").forEach((b) => {
  b.addEventListener("click", async () => {
    const origen = document.getElementById(b.dataset.copiar);
    if (!origen) return;
    const antes = b.textContent;
    try { await navigator.clipboard.writeText(origen.textContent); b.textContent = "¡Copiado!"; }
    catch (e) { b.textContent = "No se pudo copiar"; }
    setTimeout(() => { b.textContent = antes; }, 1800);
  });
});
document.querySelectorAll("[data-descargar]").forEach((b) => {
  b.addEventListener("click", () => {
    const origen = document.getElementById(b.dataset.descargar);
    if (!origen) return;
    const blob = new Blob([origen.textContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = claseEl("a");
    a.href = url;
    a.download = b.dataset.archivo || "archivo.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});
