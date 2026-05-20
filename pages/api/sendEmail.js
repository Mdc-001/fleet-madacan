import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // 🔐 Token validation
  if (req.headers.authorization !== `Bearer ${process.env.API_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, cc, subject, text } = req.body;

  const transporter = nodemailer.createTransport({
    host: "mail.madacan.com",
    port: 587,
    secure: false, // TLS on port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.sendMail({
      from: "Fleet App <noreply@madacan.com>",
      to,
      cc,
      subject,
      text,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
