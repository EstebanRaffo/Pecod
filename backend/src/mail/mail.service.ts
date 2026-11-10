import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter;
  private logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // HU22: Configurar transporter con variables de entorno
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = this.configService.get<number>('MAIL_PORT');
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPass = this.configService.get<string>('MAIL_PASS');

    // Usar valores por defecto para desarrollo (Mailpit)
    const host = mailHost || 'localhost';
    const port = mailPort || 1025;
    const user = mailUser || 'dev@pecod.local';
    const pass = mailPass || 'password';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // true = TLS, false = STARTTLS o sin auth (Mailpit)
      auth: {
        user,
        pass,
      },
    });

    this.logger.log(`Mail transporter initialized: ${host}:${port}`);
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
    userName: string,
  ): Promise<void> {
    try {
      const mailFrom = this.configService.get<string>(
        'MAIL_FROM',
        'noreply@pecod.edu',
      );

      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Restablecer tu contraseña</h2>
            <p>Hola ${userName},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña en PECOD. Si fuiste tú quien realizó esta solicitud, haz clic en el enlace de abajo:</p>
            <p>
              <a href="${resetLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                Restablecer contraseña
              </a>
            </p>
            <p>Este enlace es válido por 60 minutos.</p>
            <p>Si no solicitaste restablecer tu contraseña, ignora este correo.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">
              © 2026 PECOD - Plataforma Educativa Multi-Institucional. Todos los derechos reservados.
            </p>
          </body>
        </html>
      `;

      const textContent = `
Restablecer tu contraseña

Hola ${userName},

Recibimos una solicitud para restablecer tu contraseña en PECOD. Si fuiste tú quien realizó esta solicitud, accede a través de este enlace:

${resetLink}

Este enlace es válido por 60 minutos.

Si no solicitaste restablecer tu contraseña, ignora este correo.

© 2026 PECOD - Plataforma Educativa Multi-Institucional. Todos los derechos reservados.
      `.trim();

      await this.transporter.sendMail({
        from: mailFrom,
        to: email,
        subject: 'Restablecer tu contraseña - PECOD',
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error,
      );
      // No lanzar error: el email es best-effort (HU22: respuesta genérica sin timing leaks)
    }
  }
}
