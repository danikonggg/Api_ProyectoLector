import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      throw new InternalServerErrorException(
        'El servicio de correo no está configurado. Agrega SMTP_HOST, SMTP_USER y SMTP_PASS en las variables de entorno.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: { user, pass },
    });

    return this.transporter;
  }

  async sendPasswordResetEmail(to: string, nombre: string, resetUrl: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM', 'no-reply@apilector.com');
    const year = new Date().getFullYear();

    await this.getTransporter().sendMail({
      from,
      to,
      subject: '🔐 Restablece tu contraseña — ApiLector',
      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="
                    background: linear-gradient(135deg,#4F46E5,#7C3AED);
                    border-radius:14px;
                    padding:14px 28px;
                  ">
                    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                      📚 ApiLector
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="
              background:#ffffff;
              border-radius:20px;
              box-shadow:0 4px 24px rgba(0,0,0,0.08);
              overflow:hidden;
            ">

              <!-- Card top accent -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,#4F46E5,#7C3AED);
                    height:6px;
                  "></td>
                </tr>
              </table>

              <!-- Card body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 40px 32px;">

                    <!-- Icon -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="
                          background:#EEF2FF;
                          border-radius:50%;
                          width:64px;height:64px;
                          text-align:center;
                          vertical-align:middle;
                          font-size:28px;
                          line-height:64px;
                        ">🔐</td>
                      </tr>
                    </table>

                    <!-- Title -->
                    <h1 style="
                      margin:0 0 8px;
                      font-size:24px;
                      font-weight:700;
                      color:#1e1b4b;
                      line-height:1.3;
                    ">¿Olvidaste tu contraseña?</h1>

                    <!-- Subtitle -->
                    <p style="
                      margin:0 0 24px;
                      font-size:16px;
                      color:#6b7280;
                      line-height:1.6;
                    ">
                      Hola <strong style="color:#374151;">${nombre}</strong>, recibimos una solicitud para restablecer
                      la contraseña de tu cuenta. Si fuiste tú, haz clic en el botón de abajo.
                    </p>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="border-top:1px solid #e5e7eb;"></td>
                      </tr>
                    </table>

                    <!-- Button -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td align="center" style="
                          background:linear-gradient(135deg,#4F46E5,#7C3AED);
                          border-radius:10px;
                        ">
                          <a href="${resetUrl}" target="_blank" style="
                            display:inline-block;
                            padding:14px 36px;
                            color:#ffffff;
                            font-size:16px;
                            font-weight:600;
                            text-decoration:none;
                            letter-spacing:0.3px;
                          ">Restablecer contraseña →</a>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry notice -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="
                          background:#FFF7ED;
                          border-left:4px solid #F97316;
                          border-radius:0 8px 8px 0;
                          padding:12px 16px;
                        ">
                          <p style="margin:0;font-size:14px;color:#92400E;">
                            ⏱️ <strong>Este enlace expira en 1 hora.</strong>
                            Si no lo usas a tiempo, deberás solicitar uno nuevo.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="
                      margin:0;
                      font-size:12px;
                      color:#4F46E5;
                      word-break:break-all;
                      line-height:1.5;
                    ">${resetUrl}</p>

                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="border-top:1px solid #f3f4f6;"></td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 40px 36px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="
                          background:#F9FAFB;
                          border-radius:10px;
                          padding:14px 16px;
                        ">
                          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                            🛡️ <strong style="color:#374151;">¿No fuiste tú?</strong>
                            Ignora este correo con total seguridad. Tu contraseña
                            <strong>no cambiará</strong> a menos que uses el enlace de arriba.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 8px;">
              <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">
                © ${year} ApiLector · Todos los derechos reservados
              </p>
              <p style="margin:0;font-size:12px;color:#d1d5db;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
      `,
    });

    this.logger.log(`Correo de recuperación enviado a: ${to}`);
  }
}
