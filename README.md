# Academia IA

Programa interno de formación en Inteligencia Artificial aplicada al trabajo. De los fundamentos a los agentes autónomos, la automatización con Adobe Workfront Fusion, el web scraping y un proyecto final.

## Contenido

- **10 niveles · 34 módulos** con videos, ejemplos, comparativas y autoevaluaciones (quizzes).
- **Cuaderno de tareas** ([`tareas.html`](tareas.html)) con una tarea aplicada por módulo y seguimiento de progreso.
- **23 laboratorios interactivos** ([`laboratorios.html`](laboratorios.html)) que corren en el navegador, inspirados en las certificaciones de IBM, AWS, Microsoft y Google.
- **Biblioteca de prompts** ([`prompts.html`](prompts.html)) y **glosario** ([`glosario.html`](glosario.html)).
- **Examen de nivelación** ([`examen.html`](examen.html)) calificado en el servidor (Supabase).
- **Progreso en la cuenta**: módulos, tareas y nivel se guardan en Supabase y siguen a cada persona en el teléfono y el computador.

## Estructura

```
index.html            Página principal (temario)
tareas.html           Cuaderno de tareas prácticas
laboratorios.html     Laboratorios interactivos (lógica en js/labs.js)
prompts.html          Biblioteca de prompts
glosario.html         Glosario de términos
examen.html           Examen de nivelación (js/examen.js)
acceso.html           Ingreso, registro y cambio de contraseña (js/auth.js)
correos/              Plantillas de correo para Supabase
css/styles.css        Sistema de diseño (claro minimalista)
js/main.js            Interactividad (animaciones, quizzes, progreso)
modulos/              Los 34 módulos del programa
```

Sitio estático: HTML, CSS y JavaScript, sin dependencias ni build. Se abre con doble clic o se sirve con cualquier servidor estático.
