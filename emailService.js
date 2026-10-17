require("dotenv").config();
const nodemailer = require("nodemailer");

// Create Nodemailer Transporter
function getTransporter() {
    const host = process.env.EMAIL_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    if (!user || !pass) {
        return null;
    }

    // Direct port 465 SSL transport with timeouts
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
    });
}

// Generate ChatHub Branded HTML Template
function getEmailTemplate({ title, heading, bodyText, otpCode, footerText }) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 10px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
                        <!-- Header with Brand Logo -->
                        <tr>
                            <td style="padding: 32px 36px 20px; text-align: left; background: #ffffff;">
                                <div style="display: inline-flex; align-items: center; gap: 8px;">
                                    <span style="display: inline-block; width: 34px; height: 34px; background: #10b981; border-radius: 9px; text-align: center; line-height: 34px; color: #ffffff; font-size: 18px; font-weight: 700;">💬</span>
                                    <span style="font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px; margin-left: 8px;">ChatHub</span>
                                </div>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 10px 36px 30px;">
                                <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">${heading}</h1>
                                <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                                    ${bodyText}
                                </p>

                                ${otpCode ? `
                                <div style="background-color: #ecfdf5; border: 1px dashed #10b981; border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 24px;">
                                    <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #047857; margin-bottom: 6px;">Your One-Time Code</span>
                                    <span style="display: block; font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #065f46; font-family: 'Courier New', Courier, monospace;">${otpCode}</span>
                                </div>
                                <p style="font-size: 13px; color: #6b7280; margin: 0 0 18px 0; text-align: center;">
                                    ⏳ This code is valid for <strong>5 minutes</strong>. Do not share it with anyone.
                                </p>
                                ` : ''}

                                <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin: 20px 0 0 0;">
                                    ${footerText || "If you did not request this, you can safely ignore this email."}
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 20px 36px; border-top: 1px solid #e5e7eb; text-align: center;">
                                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                                    © ${new Date().getFullYear()} ChatHub. Fast, secure and seamless communication.
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
}

// Send Email with OTP or Notification
async function sendOtpEmail({ toEmail, otpCode, purpose = "signup" }) {
    const isSignup = purpose === "signup";
    const subject = isSignup ? "Verify your ChatHub Account" : "ChatHub Password Recovery Code";
    const heading = isSignup ? "Welcome to ChatHub! 👋" : "Reset your ChatHub password";
    const bodyText = isSignup 
        ? "Thank you for signing up. Please enter the following 6-digit verification code to activate your account and start chatting."
        : "We received a request to reset your password. Use the verification code below to authorize your password reset.";

    const html = getEmailTemplate({
        title: subject,
        heading,
        bodyText,
        otpCode,
        footerText: isSignup 
            ? "Welcome aboard! Let's connect together." 
            : "If you did not request a password reset, please secure your account immediately."
    });

    // 1. Try HTTPS API Providers first (Bypasses Render's port 25/465/587 firewall blocks)
    // A. Resend API (HTTPS Port 443)
    if (process.env.RESEND_API_KEY) {
        try {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: process.env.RESEND_FROM || "ChatHub <onboarding@resend.dev>",
                    to: [toEmail],
                    subject,
                    html
                })
            });
            const data = await res.json();
            if (res.ok && data?.id) {
                console.log(`[Email Service - Resend HTTPS] Sent to ${toEmail}, ID: ${data.id}`);
                return { success: true, messageId: data.id };
            }
            console.error(`[Email Service - Resend] API error:`, data);
        } catch (apiErr) {
            console.error(`[Email Service - Resend] Network error:`, apiErr.message);
        }
    }

    // B. Brevo API (HTTPS Port 443 - 300 free emails/day to any recipient)
    if (process.env.BREVO_API_KEY) {
        try {
            const senderEmail = process.env.EMAIL_USER || "noreply@chathub.com";
            const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": process.env.BREVO_API_KEY.trim(),
                    "Content-Type": "application/json",
                    "accept": "application/json"
                },
                body: JSON.stringify({
                    sender: { name: "ChatHub Security", email: senderEmail },
                    to: [{ email: toEmail }],
                    subject,
                    htmlContent: html
                })
            });
            const data = await res.json();
            if (res.ok && data?.messageId) {
                console.log(`[Email Service - Brevo HTTPS] Sent to ${toEmail}, ID: ${data.messageId}`);
                return { success: true, messageId: data.messageId };
            }
            console.error(`[Email Service - Brevo] API error:`, data);
        } catch (apiErr) {
            console.error(`[Email Service - Brevo] Network error:`, apiErr.message);
        }
    }

    // C. Google Apps Script Webhook (HTTPS Port 443 using personal Gmail)
    if (process.env.GMAIL_WEBHOOK_URL) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(process.env.GMAIL_WEBHOOK_URL.trim(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: toEmail, subject, html }),
                redirect: "follow",
                signal: controller.signal
            });
            clearTimeout(timer);
            const text = await res.text();
            let parsed = {};
            try { parsed = JSON.parse(text); } catch (e) {}
            if (res.ok && (parsed.success !== false)) {
                console.log(`[Email Service - Gmail Webhook HTTPS] Sent to ${toEmail}`);
                return { success: true };
            }
            console.error(`[Email Service - Gmail Webhook] Response error:`, text);
        } catch (whErr) {
            console.error(`[Email Service - Gmail Webhook] Error:`, whErr.message);
        }
    }

    // 2. Fallback to Direct Nodemailer SMTP (Works on local or paid cloud hosts)
    const transporter = getTransporter();
    const fromAddress = process.env.EMAIL_FROM || `"ChatHub Security" <${process.env.EMAIL_USER || "noreply@chathub.com"}>`;

    if (!transporter) {
        console.error(`[Email Service] No transporter or email API configured.`);
        return { success: false, error: "Email delivery service is not configured." };
    }

    try {
        const sendPromise = transporter.sendMail({
            from: fromAddress,
            to: toEmail,
            subject,
            html
        });
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Email sending timeout (18000ms)")), 18000)
        );
        const info = await Promise.race([sendPromise, timeoutPromise]);
        console.log(`[Email Service] Sent to ${toEmail}, Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`[Email Service] Failed or timed out sending email to ${toEmail}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendOtpEmail
};
