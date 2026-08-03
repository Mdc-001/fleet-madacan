import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== process.env.API_SECRET) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const { to, cc, subject, text } = req.body;
  if (!to || !subject || !text) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "mail.madacan.com",
      port: 587,              // TLS port
      secure: false,          // false for TLS (true only if using port 465/SSL)
      auth: {
        user: process.env.EMAIL_USER, // applications
        pass: process.env.EMAIL_PASS, // #17112025+App
      },
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"Fleet App" <noreply@madacan.com>`, // ✅ valid sender address
      to,
      cc,
      subject,
      text,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Nodemailer error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
