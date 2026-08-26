# Plantillas de correo

Estas plantillas **no se usan desde el sitio**: hay que pegarlas en el panel de Supabase,
que es quien envía los correos de autenticación.

## Cómo instalar la plantilla

1. Entra a tu proyecto en Supabase.
2. Ve a **Authentication → Emails** (o *Email Templates*).
3. Elige la plantilla **Reset Password** (Restablecer contraseña).
4. En **Subject** (asunto) pon:
   `Crea una contraseña nueva · Academia IA`
5. Abre `restablecer-contrasena.html`, copia **todo** el contenido y pégalo en el cuerpo del mensaje.
6. Guarda.

## Notas importantes

- El logo se carga desde `https://academicoai.netlify.app/apple-touch-icon.png`.
  Si algún día cambias de dominio, actualiza esa URL en la plantilla.
- `{{ .ConfirmationURL }}` es la variable de Supabase que genera el enlace seguro.
  **No la cambies ni la traduzcas**, o el enlace dejará de funcionar.
- El diseño usa tablas y estilos en línea a propósito: es lo único que renderiza
  bien en Outlook, Gmail y Apple Mail.

## Si los correos no llegan

Supabase trae un servicio de correo de cortesía con un límite muy bajo
(unos pocos envíos por hora) y que suele caer en spam. Para uso real hay que
configurar un SMTP propio en **Authentication → SMTP Settings** (Resend, SendGrid,
Postmark, Amazon SES…), verificando antes el dominio en ese proveedor.
