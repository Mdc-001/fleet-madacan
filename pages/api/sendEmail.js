import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { to, cc, subject, text } = req.body;

  // ✅ Verify required fields
  if (!to || !subject || !text) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    // ✅ Create transporter using env vars
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,   // e.g. "smtp.gmail.com"
      port: process.env.SMTP_PORT,   // e.g. 465
      secure: true,                  // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ✅ Send mail
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      cc,
      subject,
      text,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Nodemailer error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
