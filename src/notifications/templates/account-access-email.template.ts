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
  const subject = `Wegox | ${input.eyebrow} | ${input.businessName}`;
  const escapedBusinessName = escapeHtml(input.businessName);
  const escapedEyebrow = escapeHtml(input.eyebrow);
  const escapedHeadline = escapeHtml(input.headline);
  const escapedIntro = escapeHtml(input.intro);
  const escapedActionLabel = escapeHtml(input.actionLabel);
  const escapedActionUrl = escapeHtml(input.actionUrl);
  const escapedExpiryLabel = escapeHtml(input.expiryLabel);
  const escapedSupportLabel = escapeHtml(input.supportLabel);

  const html = `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f5efe5;font-family:Arial,Helvetica,sans-serif;color:#1f1914;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:linear-gradient(180deg,#f5eee2 0%,#fbf8f2 100%);">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid rgba(196,156,96,0.24);box-shadow:0 28px 72px rgba(36,28,20,0.12);">
              <tr>
                <td style="padding:18px 28px;background:#17120e;color:#f7f2e9;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="width:28px;height:28px;border-radius:8px;background:#b58a45;text-align:center;font-size:15px;font-weight:800;color:#17120e;">W</td>
                            <td style="padding-left:10px;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f7f2e9;">Wegox</td>
                          </tr>
                        </table>
                      </td>
                      <td align="right" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#cbb79c;">
                        ${escapedBusinessName}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:30px 30px 12px;background:linear-gradient(135deg,#221a13 0%,#3a2a1a 100%);color:#ffffff;">
                  <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.14);font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                    ${escapedEyebrow}
                  </div>
                  <h1 style="margin:16px 0 12px;font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;">
                    ${escapedHeadline}
                  </h1>
                  <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.9);">
                    ${escapedIntro}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 30px 10px;">
                  <div style="padding:22px;border-radius:20px;background:#fbf6ed;border:1px solid rgba(181,138,69,0.22);">
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4f3d2d;">
                      Para continuar, usa este enlace seguro y completa tu acceso.
                    </p>
                    <a href="${escapedActionUrl}" style="display:inline-block;padding:14px 24px;border-radius:14px;background:#b58a45;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                      ${escapedActionLabel}
                    </a>
                    <p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:#6d5b47;">
                      ${escapedExpiryLabel}
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 30px 28px;">
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#5d4a38;">
                    ${escapedSupportLabel}
                  </p>
                  <p style="margin:14px 0 0;font-size:12px;line-height:1.7;color:#8a755e;">
                    Si no solicitaste este acceso, puedes ignorar este correo.
                  </p>
                  <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#8a755e;">
                    Equipo Wegox
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
    `${input.headline} (${input.businessName})`,
    '',
    input.intro,
    '',
    `Acción: ${input.actionLabel}`,
    `Enlace seguro: ${input.actionUrl}`,
    input.expiryLabel,
    '',
    input.supportLabel,
    'Si no solicitaste este acceso, puedes ignorar este correo.',
    '',
    'Equipo Wegox',
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
    eyebrow: 'Activación de acceso',
    headline: 'Verifica tu correo y completa tu acceso',
    intro: `Te han invitado a administrar ${input.tenantName} desde Wegox. Al abrir este enlace verificaremos tu correo y podrás definir la contraseña con la que entrarás al panel.`,
    actionLabel: 'Activar acceso',
    actionUrl: input.setupUrl,
    expiryLabel: `Este enlace expira el ${formatExpiry(input.expiresAt)}.`,
    supportLabel:
      'Si el enlace expira, puedes usar la opción "Olvidé mi contraseña" para recibir uno nuevo.',
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
    eyebrow: 'Recuperación de acceso',
    headline: 'Restablece tu contraseña',
    intro:
      'Recibimos una solicitud para actualizar tu contraseña. Usa este enlace seguro para definir una nueva clave de acceso.',
    actionLabel: 'Restablecer contraseña',
    actionUrl: input.resetUrl,
    expiryLabel: `Este enlace expira el ${formatExpiry(input.expiresAt)}.`,
    supportLabel:
      'Si no pediste este cambio, ignora este mensaje y tu acceso actual no se modificará.',
  });
}
