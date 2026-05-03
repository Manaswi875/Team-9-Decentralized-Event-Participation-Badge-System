/**
 * Creates and exports a single shared mailer so that every module that
 * needs to send email uses the same transport configuration and delivery
 * mode (SMTP vs file-preview).
 */

const { createMailer } = require("./lib/mailer");
const config = require("./lib/config");
const { logServer } = require("./logger");

const mailer = createMailer(config, { log: logServer });

module.exports = mailer;
