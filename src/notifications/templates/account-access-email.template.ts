function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(expiresAt: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(expiresAt);
}

type AccountAccessEmailTemplateInput = {
  businessName: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  expiryLabel: string;
  supportLabel: string;
};

export function buildAccountAccessEmail(
  input: AccountAccessEmailTemplateInput,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${input.eyebrow} | ${input.businessName}`;
  const html = `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f7f3ec;font-family:Arial,Helvetica,sans-serif;color:#221b15;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:linear-gradient(180deg,#efe3cd 0%,#f9f6ef 100%);">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid rgba(181,138,69,0.18);box-shadow:0 24px 60px rgba(36,28,20,0.08);">
              <tr>
                <td style="padding:32px;background:linear-gradient(135deg,#17120e 0%,#342718 100%);color:#ffffff;">
                  <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.14);font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
                    ${escapeHtml(input.eyebrow)}
                  </div>
                  <h1 style="margin:18px 0 12px;font-size:30px;line-height:1.2;font-weight:800;">${escapeHtml(input.headline)}</h1>
                  <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                    ${escapeHtml(input.intro)}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 32px 12px;">
                  <div style="padding:22px;border-radius:24px;background:#faf6ee;border:1px solid rgba(181,138,69,0.16);">
                    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#463728;">
                      Usa el siguiente enlace seguro para continuar con tu cuenta.
                    </p>
                    <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:14px 22px;border-radius:16px;background:#b58a45;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                      ${escapeHtml(input.actionLabel)}
                    </a>
                    <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#6b5b46;">
                      ${escapeHtml(input.expiryLabel)}
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 32px 30px;">
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#6b5b46;">
                    ${escapeHtml(input.supportLabel)}
                  </p>
                  <p style="margin:16px 0 0;font-size:12px;line-height:1.7;color:#8c7a62;">
                    Si no solicitaste este acceso, puedes ignorar este correo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  const text = [
    input.headline,
    '',
    input.intro,
    '',
    `${input.actionLabel}: ${input.actionUrl}`,
    input.expiryLabel,
    '',
    input.supportLabel,
  ].join('\n');

  return {
    subject,
    html,
    text,
  };
}

export function buildTenantAdminInvitationEmail(input: {
  tenantName: string;
  setupUrl: string;
  expiresAt: Date;
}): {
  subject: string;
  html: string;
  text: string;
} {
  return buildAccountAccessEmail({
    businessName: input.tenantName,
    preheader: 'Activa tu acceso y define tu contraseña segura.',
    eyebrow: 'Activacion de acceso',
    headline: 'Verifica tu correo y completa tu acceso',
    intro: `Te han invitado a administrar ${input.tenantName} desde Wegox. Al abrir este enlace verificaremos tu correo y podras definir la contraseña con la que entraras al panel.`,
    actionLabel: 'Activar acceso',
    actionUrl: input.setupUrl,
    expiryLabel: `Este enlace expira el ${formatExpiry(input.expiresAt)}.`,
    supportLabel:
      'Si el enlace expira, puedes usar la opcion "Olvide mi contrasena" para recibir uno nuevo.',
  });
}

export function buildPasswordResetEmail(input: {
  businessName: string;
  resetUrl: string;
  expiresAt: Date;
}): {
  subject: string;
  html: string;
  text: string;
} {
  return buildAccountAccessEmail({
    businessName: input.businessName,
    preheader: 'Restablece tu contraseña de forma segura.',
    eyebrow: 'Recuperacion de acceso',
    headline: 'Restablece tu contraseña',
    intro:
      'Recibimos una solicitud para actualizar tu contraseña. Usa este enlace seguro para definir una nueva clave de acceso.',
    actionLabel: 'Restablecer contraseña',
    actionUrl: input.resetUrl,
    expiryLabel: `Este enlace expira el ${formatExpiry(input.expiresAt)}.`,
    supportLabel:
      'Si no pediste este cambio, ignora este mensaje y tu acceso actual no se modificara.',
  });
}
