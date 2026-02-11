/**
 * Email Notification Service
 * Sends email alerts for security events and important notifications
 * Supports multiple providers: SendGrid, Nodemailer, Console (dev)
 */

const nodemailer = require('nodemailer');
const auditLogger = require('./auditLogger');

class EmailNotificationService {
    constructor() {
        this.provider = process.env.EMAIL_PROVIDER || 'console'; // 'sendgrid', 'nodemailer', 'console'
        this.from = process.env.EMAIL_FROM || 'noreply@glucosoin.com';
        this.adminEmail = process.env.ADMIN_EMAIL || 'admin@glucosoin.com';
        this.enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false';
        this.transporter = null;

        this._initializeProvider();
    }

    _initializeProvider() {
        if (!this.enabled) {
            console.log('Email notifications disabled');
            return;
        }

        switch (this.provider) {
            case 'sendgrid':
                console.log('Email provider: SendGrid (not configured)');
                break;
            case 'nodemailer':
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD
                    }
                });
                this.from = process.env.EMAIL_FROM || process.env.GMAIL_USER;
                console.log(`Email provider: Nodemailer (Gmail: ${process.env.GMAIL_USER})`);
                break;
            case 'console':
            default:
                console.log('Email provider: Console (development mode)');
                break;
        }
    }

    /**
     * Send email (implementation varies by provider)
     */
    async _sendEmail({ to, subject, text, html }) {
        if (!this.enabled) {
            return { success: false, reason: 'disabled' };
        }

        try {
            switch (this.provider) {
                case 'sendgrid':
                    // await this.sgMail.send({ to, from: this.from, subject, text, html });
                    console.log(`[SendGrid] Would send: ${subject} to ${to}`);
                    break;

                case 'nodemailer':
                    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
                    console.log(`[Nodemailer] Sent: ${subject} to ${to}`);
                    break;

                case 'console':
                default:
                    console.log('📧 EMAIL NOTIFICATION');
                    console.log(`To: ${to}`);
                    console.log(`From: ${this.from}`);
                    console.log(`Subject: ${subject}`);
                    console.log(`Content: ${text || html}`);
                    console.log('---');
                    break;
            }

            // Log notification in audit system
            await auditLogger.log({
                eventType: 'EMAIL_NOTIFICATION',
                recipient: to,
                subject,
                provider: this.provider,
                success: true,
                severity: 'info'
            });

            return { success: true };
        } catch (error) {
            console.error('Email sending error:', error);
            await auditLogger.log({
                eventType: 'EMAIL_NOTIFICATION_FAILED',
                recipient: to,
                subject,
                error: error.message,
                severity: 'error'
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Security Event Notifications
     */
    async notifyUnauthorizedAccess({ userId, resource, ipAddress, timestamp }) {
        const subject = '🚨 Security Alert: Unauthorized Access Attempt';
        const text = `
Security Alert

An unauthorized access attempt was detected:

User: ${userId}
Resource: ${resource}
IP Address: ${ipAddress}
Time: ${new Date(timestamp).toLocaleString()}

This attempt has been logged and blocked. If this was not you, please contact support immediately.

--
GlucoSoin Security Team
        `.trim();

        return this._sendEmail({
            to: this.adminEmail,
            subject,
            text
        });
    }

    async notifyMultipleFailedLogins({ userId, count, ipAddress, timestamp }) {
        const subject = '⚠️ Security Alert: Multiple Failed Login Attempts';
        const text = `
Security Alert

Multiple failed login attempts detected:

User: ${userId}
Failed Attempts: ${count}
IP Address: ${ipAddress}
Time: ${new Date(timestamp).toLocaleString()}

The account may be under attack. Consider:
1. Resetting the password
2. Enabling two-factor authentication
3. Reviewing recent activity

--
GlucoSoin Security Team
        `.trim();

        return this._sendEmail({
            to: this.adminEmail,
            subject,
            text
        });
    }

    async notifyDataBreach({ affectedUsers, dataType, timestamp }) {
        const subject = '🚨 CRITICAL: Potential Data Breach Detected';
        const text = `
CRITICAL SECURITY ALERT

A potential data breach has been detected:

Affected Users: ${affectedUsers}
Data Type: ${dataType}
Time: ${new Date(timestamp).toLocaleString()}

IMMEDIATE ACTION REQUIRED:
1. Investigate the incident
2. Secure affected systems
3. Notify affected users
4. Report to authorities if required

--
GlucoSoin Security Team
        `.trim();

        return this._sendEmail({
            to: this.adminEmail,
            subject,
            text
        });
    }

    async notifySuspiciousActivity({ userId, activity, metadata, timestamp }) {
        const subject = '⚠️ Suspicious Activity Detected';
        const text = `
Security Alert

Suspicious activity detected:

User: ${userId}
Activity: ${activity}
Details: ${JSON.stringify(metadata, null, 2)}
Time: ${new Date(timestamp).toLocaleString()}

This activity is being monitored. Review the audit logs for more information.

--
GlucoSoin Security Team
        `.trim();

        return this._sendEmail({
            to: this.adminEmail,
            subject,
            text
        });
    }

    /**
     * Medical/Clinical Notifications
     */
    async notifyCriticalPatientStatus({ patientName, patientId, doctorEmail, status, lastReading }) {
        const subject = '⚠️ Patient Alert: Critical Status';
        const text = `
Patient Alert

A patient requires immediate attention:

Patient: ${patientName} (ID: ${patientId})
Status: ${status}
Last Reading: ${lastReading}

Please review the patient's records and take appropriate action.

--
GlucoSoin Medical Team
        `.trim();

        return this._sendEmail({
            to: doctorEmail,
            subject,
            text
        });
    }

    async notifyAppointmentReminder({ patientEmail, patientName, doctorName, appointmentDate }) {
        const subject = '📅 Appointment Reminder';
        const text = `
Appointment Reminder

Hello ${patientName},

This is a reminder about your upcoming appointment:

Doctor: ${doctorName}
Date & Time: ${new Date(appointmentDate).toLocaleString()}

Please arrive 10 minutes early. If you need to reschedule, please contact us as soon as possible.

--
GlucoSoin
        `.trim();

        return this._sendEmail({
            to: patientEmail,
            subject,
            text
        });
    }

    /**
     * Administrative Notifications
     */
    async notifyNewUserRegistration({ userName, userEmail, role, timestamp }) {
        const subject = '👤 New User Registration';
        const text = `
New User Registration

A new user has registered:

Name: ${userName}
Email: ${userEmail}
Role: ${role}
Time: ${new Date(timestamp).toLocaleString()}

--
GlucoSoin Admin
        `.trim();

        return this._sendEmail({
            to: this.adminEmail,
            subject,
            text
        });
    }

    async notifySystemError({ errorType, errorMessage, stackTrace, timestamp }) {
        const subject = '🔴 System Error Alert';
        const text = `
System Error

An error occurred in the system:

Type: ${errorType}
Message: ${errorMessage}
Time: ${new Date(timestamp).toLocaleString()}

Stack Trace:
${stackTrace}

--
GlucoSoin System
        `.trim();

        return this._sendEmail({
            to: this.adminEmail,
            subject,
            text
        });
    }

    /**
     * Batch send emails (for notifications to multiple users)
     */
    async sendBatch(emails) {
        const results = await Promise.allSettled(
            emails.map(email => this._sendEmail(email))
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        return {
            total: results.length,
            successful,
            failed,
            results
        };
    }
}

// Singleton instance
const emailService = new EmailNotificationService();

module.exports = emailService;
