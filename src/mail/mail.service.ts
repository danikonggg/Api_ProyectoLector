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

    await this.getTransporter().sendMail({
      from,
      to,
      subject: 'Recuperación de contraseña - ApiLector',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hola, ${nombre}</h2>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Restablecer contraseña
            </a>
          </div>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
          <p><strong>Este enlace expira en 1 hora.</strong></p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #6b7280; font-size: 14px;">
            Si no solicitaste restablecer tu contraseña, ignora este correo.
            Tu contraseña permanecerá sin cambios.
          </p>
        </div>
      `,
    });

    this.logger.log(`Correo de recuperación enviado a: ${to}`);
  }
}
