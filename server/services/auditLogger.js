/**
 * Audit Logging Service
 * Tracks all access and modifications to sensitive medical data
 * Critical for compliance and security auditing
 */

const { db } = require('../config/firebaseConfig');
const fs = require('fs').promises;
const path = require('path');

class AuditLogger {
    constructor() {
        this.collectionName = 'audit_logs';
        this.localPath = path.join(__dirname, '../data/audit_logs.json');
    }

    /**
     * Log an audit event
     */
    async log(eventData) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            ...eventData,
            environment: process.env.NODE_ENV || 'development'
        };

        try {
            if (db) {
                const docRef = await db.collection(this.collectionName).add(auditEntry);
                return { id: docRef.id, ...auditEntry };
            } else {
                return await this._logLocal(auditEntry);
            }
        } catch (error) {
            console.error('Audit logging error:', error);
            return await this._logLocal(auditEntry);
        }
    }

    /**
     * Log data access event
     */
    async logDataAccess({ userId, userRole, resourceType, resourceId, action, success = true, metadata = {} }) {
        return this.log({
            eventType: 'DATA_ACCESS',
            userId,
            userRole,
            resourceType,
            resourceId,
            action,
            success,
            metadata,
            severity: 'info'
        });
    }

    /**
     * Log data modification event
     */
    async logDataModification({ userId, userRole, resourceType, resourceId, action, changes, success = true, metadata = {} }) {
        return this.log({
            eventType: 'DATA_MODIFICATION',
            userId,
            userRole,
            resourceType,
            resourceId,
            action,
            changes,
            success,
            metadata,
            severity: 'warning'
        });
    }

    /**
     * Log security event
     */
    async logSecurity({ userId, userRole, eventType, description, severity = 'warning', metadata = {} }) {
        return this.log({
            eventType: 'SECURITY',
            userId,
            userRole,
            securityEventType: eventType,
            description,
            metadata,
            severity
        });
    }

    /**
     * Get audit trail for a resource
     */
    async getResourceAuditTrail(resourceType, resourceId, limit = 50) {
        try {
            if (db) {
                const snapshot = await db.collection(this.collectionName)
                    .where('resourceType', '==', resourceType)
                    .where('resourceId', '==', resourceId)
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get();

                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                const logs = await this._readLocal();
                return logs
                    .filter(log => log.resourceType === resourceType && log.resourceId === resourceId)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, limit);
            }
        } catch (error) {
            console.error('Audit trail error:', error);
            return [];
        }
    }

    /**
     * Local file operations (fallback)
     */
    async _logLocal(entry) {
        try {
            let logs = await this._readLocal();
            const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const logEntry = { id, ...entry };
            logs.push(logEntry);

            if (logs.length > 10000) {
                logs = logs.slice(-10000);
            }

            await fs.writeFile(this.localPath, JSON.stringify(logs, null, 2));
            return logEntry;
        } catch (error) {
            console.error('Local audit logging error:', error);
            return { id: 'error', ...entry };
        }
    }

    async _readLocal() {
        try {
            const data = await fs.readFile(this.localPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }
}

const auditLogger = new AuditLogger();
module.exports = auditLogger;
