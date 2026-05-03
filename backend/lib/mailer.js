const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");

function encodeAttachmentContent(content, encoding) {
  if (!content) {
    return null;
  }

  if (Buffer.isBuffer(content)) {
    return content.toString("base64");
  }

  if (typeof content === "string") {
    return encoding === "base64" ? content : Buffer.from(content).toString("base64");
  }

  return null;
}

function toResendAttachment(attachment) {
  if (!attachment?.filename) {
    return null;
  }

  if (attachment.path) {
    return {
      filename: attachment.filename,
      path: attachment.path,
      ...(attachment.cid || attachment.contentId
        ? { contentId: attachment.cid || attachment.contentId }
        : {}),
    };
  }

  const encodedContent = encodeAttachmentContent(attachment.content, attachment.encoding);
  if (!encodedContent) {
    return null;
  }

  return {
    filename: attachment.filename,
    content: encodedContent,
    ...(attachment.cid || attachment.contentId
      ? { contentId: attachment.cid || attachment.contentId }
      : {}),
  };
}

function createMailer(config, options = {}) {
  const log = typeof options.log === "function" ? options.log : () => {};
  const smtpConfigured = Boolean(config.SMTP_HOST);
  const resendConfigured = !smtpConfigured && Boolean(config.RESEND_API_KEY);
  const resend = resendConfigured ? new Resend(config.RESEND_API_KEY) : null;
  const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: Number(config.SMTP_PORT) || 587,
        secure: Boolean(config.SMTP_SECURE),
        auth:
          config.SMTP_USER && config.SMTP_PASS
            ? {
                user: config.SMTP_USER,
                pass: config.SMTP_PASS,
              }
            : undefined,
      })
    : null;

  async function sendEmail(store, message) {
    const emailId = `email-${crypto.randomUUID()}`;
    const previewFile = path.join(config.EMAIL_PREVIEW_DIR, `${emailId}.html`);
    log("mailer.preview.write", {
      emailId,
      type: message.type,
      to: message.to,
      subject: message.subject,
      previewFile,
    });
    await fs.writeFile(previewFile, message.previewHtml || message.html, "utf8");

    let messageId = null;
    let deliveryMode = "preview";

    if (resendConfigured) {
      log("mailer.send.start", {
        emailId,
        type: message.type,
        to: message.to,
        subject: message.subject,
        provider: "resend",
      });
      const { data, error } = await resend.emails.send({
        from: config.EMAIL_FROM,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: (message.attachments || [])
          .map(toResendAttachment)
          .filter(Boolean),
      });

      if (error) {
        log("mailer.send.error", {
          emailId,
          type: message.type,
          to: message.to,
          provider: "resend",
          error: error.message || "Resend email send failed.",
        });
        throw new Error(error.message || "Resend email send failed.");
      }

      messageId = data?.id || null;
      deliveryMode = "resend";
    } else if (transporter) {
      log("mailer.send.start", {
        emailId,
        type: message.type,
        to: message.to,
        subject: message.subject,
        provider: "smtp",
        host: config.SMTP_HOST,
        port: Number(config.SMTP_PORT) || 587,
        secure: Boolean(config.SMTP_SECURE),
      });
      const smtpResult = await transporter.sendMail({
        from: config.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments || [],
      });

      messageId = smtpResult.messageId || null;
      deliveryMode = "smtp";
    }

    const emailRecord = {
      emailId,
      type: message.type,
      guestId: message.guestId || null,
      to: message.to,
      subject: message.subject,
      sentAt: new Date().toISOString(),
      previewUrl: `/api/emails/${encodeURIComponent(emailId)}/preview`,
      deliveryMode,
      messageId,
    };

    store.emails.unshift(emailRecord);
    log("mailer.send.success", {
      emailId,
      type: message.type,
      to: message.to,
      deliveryMode,
      messageId,
    });
    return emailRecord;
  }

  return {
    deliveryMode: resendConfigured ? "resend" : smtpConfigured ? "smtp" : "preview",
    sendEmail,
  };
}

module.exports = {
  createMailer,
};
