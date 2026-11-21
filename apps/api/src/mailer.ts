import { createTransport } from 'nodemailer';
import type { SmtpConfig } from './config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * IF-10: sends one plain-text email through the configured SMTP server. Port 465 uses TLS from
 * the start; other ports upgrade with STARTTLS when the server offers it.
 */
export async function sendMail(smtp: SmtpConfig, mail: Mail): Promise<void> {
  // shortcut: one connection per email, fine for a handful of invites and resets; pool it if
  // the app ever sends in bulk.
  const transport = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.password } } : {}),
  });
  await transport.sendMail({ from: smtp.from, ...mail });
}
