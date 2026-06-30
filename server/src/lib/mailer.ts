import nodemailer from 'nodemailer'

// SMTP mailer. Configured via env; if SMTP_HOST is not set the mailer is
// "disabled" and callers fall back to returning the reset link directly (dev /
// no-SMTP deployments). This keeps password reset usable even before email is
// wired up.
const HOST = process.env.SMTP_HOST
const PORT = parseInt(process.env.SMTP_PORT || '587')
const USER = process.env.SMTP_USER
const PASS = process.env.SMTP_PASS
// SMTP_SECURE=true for port 465 (implicit TLS); otherwise STARTTLS on 587.
const SECURE = process.env.SMTP_SECURE === 'true'
const FROM = process.env.SMTP_FROM || USER || 'no-reply@kps.local'

export const mailerEnabled = !!HOST

let transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: USER ? { user: USER, pass: PASS } : undefined,
    })
  }
  return transporter
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  if (!mailerEnabled) {
    console.warn('[mailer] SMTP not configured — skipping email to', opts.to)
    return false
  }
  await getTransporter().sendMail({ from: FROM, ...opts })
  return true
}

// Base URL the app is served at, used to build links inside emails. For the
// single-origin deployment this is where the API/frontend live.
export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || '3001'}`).replace(/\/$/, '')
}

export async function sendPasswordResetEmail(to: string, token: string, displayName?: string): Promise<boolean> {
  const link = `${appBaseUrl()}/?reset_token=${encodeURIComponent(token)}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>รีเซตรหัสผ่าน — KPS Transportation ERP</h2>
      <p>สวัสดี ${displayName || ''}</p>
      <p>มีคำขอรีเซตรหัสผ่านสำหรับบัญชีของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 24 ชั่วโมง):</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0ea371;color:#fff;border-radius:6px;text-decoration:none">ตั้งรหัสผ่านใหม่</a></p>
      <p>หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้: <br><a href="${link}">${link}</a></p>
      <p>ถ้าคุณไม่ได้ร้องขอ สามารถเพิกเฉยอีเมลนี้ได้</p>
    </div>`
  return sendMail({ to, subject: 'รีเซตรหัสผ่าน KPS ERP', html })
}
