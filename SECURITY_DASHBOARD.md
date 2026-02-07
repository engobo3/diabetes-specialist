# Security Monitoring Dashboard

## Overview
Centralized security monitoring dashboard for GlucoSoin administrators providing real-time insights into system security, user activity, and potential threats.

## Features

### ✅ Dashboard Metrics
- **Security Health Score**: Overall security rating (0-100) with recommendations
- **Failed Login Attempts**: Track authentication failures
- **Rate Limit Violations**: Monitor API abuse
- **Active Sessions**: Real-time session overview
- **2FA Adoption**: Track two-factor authentication usage
- **Suspicious Activity**: Alert on security threats
- **Data Access Patterns**: Analyze user access behavior

### ✅ Admin-Only Access
- All endpoints require admin role
- 2FA enforcement for admin users
- Audit logging for all dashboard access
- Unauthorized access attempts logged

## Architecture

### Backend Components

#### Service Layer
**File**: `server/services/securityDashboardService.js`

**Key Methods**:
- `getSecurityMetrics(timeWindowHours)` - Overall metrics summary
- `getFailedLoginAttempts(limit)` - Failed authentication logs
- `getRateLimitViolations(limit)` - Rate limit breaches
- `getActiveSessionsOverview()` - Current session statistics
- `get2FAAdoptionMetrics()` - 2FA adoption rates
- `getSuspiciousActivities(limit)` - Security alerts
- `getDataAccessPatterns(timeWindowHours)` - Access analytics
- `getSecurityHealthScore()` - Automated security assessment

#### Controller Layer
**File**: `server/controllers/securityDashboardController.js`

**Endpoints**:
- `GET /api/security/dashboard/overview` - Complete dashboard (all metrics)
- `GET /api/security/dashboard/metrics` - Security metrics
- `GET /api/security/dashboard/health-score` - Health assessment
- `GET /api/security/dashboard/failed-logins` - Failed logins
- `GET /api/security/dashboard/rate-limits` - Rate violations
- `GET /api/security/dashboard/sessions` - Active sessions
- `GET /api/security/dashboard/2fa-adoption` - 2FA stats
- `GET /api/security/dashboard/suspicious-activity` - Security alerts
- `GET /api/security/dashboard/access-patterns` - Access analytics

#### Routes
**File**: `server/routes/securityDashboardRoutes.js`
- All routes protected by `verifyToken` and `enforceAdminTwoFactor` middleware

## API Usage

### Get Complete Dashboard Overview

**Request**:
```bash
GET /api/security/dashboard/overview
Authorization: Bearer <admin_firebase_token>
X-2FA-Verified: true
```

**Response**:
```json
{
  "success": true,
  "data": {
    "healthScore": {
      "score": 85,
      "rating": "Good",
      "issues": [],
      "recommendations": [
        "Encourage users to enable 2FA"
      ],
      "metrics": {
        "failedLogins": 12,
        "rateLimitViolations": 3,
        "twoFAAdoptionRate": "65.5",
        "suspiciousActivity": 2
      }
    },
    "metrics": {
      "timeWindow": "24 hours",
      "failedLogins": 12,
      "suspiciousActivity": 2,
      "rateLimitViolations": 3,
      "twoFactorEvents": {
        "setupsInitiated": 8,
        "enabled": 7,
        "failed": 4,
        "verified": 156
      },
      "sessionEvents": {
        "created": 45,
        "expired": 8,
        "invalidated": 12
      },
      "dataAccess": {
        "total": 1234,
        "byRole": {
          "doctor": 856,
          "patient": 345,
          "admin": 33
        }
      },
      "securityAlerts": [...],
      "totalEvents": 1456
    },
    "activeSessions": {
      "totalActive": 67,
      "byRole": {
        "patient": 45,
        "doctor": 18,
        "admin": 4
      },
      "byDevice": {
        "Desktop": 42,
        "Mobile": 20,
        "Tablet": 5
      },
      "byBrowser": {
        "Chrome": 38,
        "Safari": 15,
        "Firefox": 10,
        "Edge": 4
      },
      "recentSessions": [...]
    },
    "twoFAAdoption": {
      "total": 150,
      "enabled": 98,
      "disabled": 52,
      "adoptionRate": "65.3",
      "byRole": [
        {
          "role": "admin",
          "total": 10,
          "enabled": 10,
          "adoptionRate": "100.0"
        },
        {
          "role": "doctor",
          "total": 50,
          "enabled": 42,
          "adoptionRate": "84.0"
        },
        {
          "role": "patient",
          "total": 90,
          "enabled": 46,
          "adoptionRate": "51.1"
        }
      ]
    },
    "suspiciousActivities": [...],
    "generatedAt": "2025-01-15T12:30:00Z"
  }
}
```

### Get Security Health Score

**Request**:
```bash
GET /api/security/dashboard/health-score
Authorization: Bearer <admin_firebase_token>
X-2FA-Verified: true
```

**Response**:
```json
{
  "success": true,
  "data": {
    "score": 85,
    "rating": "Good",
    "issues": [
      "Low 2FA adoption rate among patients"
    ],
    "recommendations": [
      "Encourage users to enable 2FA",
      "Make 2FA mandatory for sensitive roles"
    ],
    "metrics": {
      "failedLogins": 12,
      "rateLimitViolations": 3,
      "twoFAAdoptionRate": "65.5",
      "suspiciousActivity": 2
    }
  }
}
```

**Health Score Calculation**:
- **Starts at 100 points**
- **Deductions**:
  - Failed logins > 50: -15 points
  - Rate violations > 20: -10 points
  - 2FA adoption < 50%: -20 points
  - Suspicious activity > 10: -15 points
- **Bonuses**:
  - 2FA adoption > 80%: +5 points

**Ratings**:
- 90-100: Excellent
- 75-89: Good
- 60-74: Fair
- 40-59: Poor
- 0-39: Critical

### Get Failed Login Attempts

**Request**:
```bash
GET /api/security/dashboard/failed-logins?limit=50
Authorization: Bearer <admin_firebase_token>
X-2FA-Verified: true
```

**Response**:
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "timestamp": "2025-01-15T12:25:00Z",
        "userId": "user@example.com",
        "ipAddress": "192.168.1.100",
        "reason": "Invalid password",
        "severity": "warning"
      },
      ...
    ],
    "count": 12
  }
}
```

### Get Active Sessions

**Request**:
```bash
GET /api/security/dashboard/sessions
Authorization: Bearer <admin_firebase_token>
X-2FA-Verified: true
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalActive": 67,
    "byRole": {
      "patient": 45,
      "doctor": 18,
      "admin": 4
    },
    "byDevice": {
      "Desktop": 42,
      "Mobile": 20,
      "Tablet": 5
    },
    "byBrowser": {
      "Chrome": 38,
      "Safari": 15,
      "Firefox": 10,
      "Edge": 4
    },
    "recentSessions": [
      {
        "userId": "user123",
        "userRole": "doctor",
        "createdAt": "2025-01-15T10:00:00Z",
        "lastActivity": "2025-01-15T12:20:00Z",
        "ipAddress": "192.168.1.50",
        "deviceInfo": {
          "browser": "Chrome",
          "os": "Windows",
          "device": "Desktop"
        }
      },
      ...
    ]
  }
}
```

### Get Data Access Patterns

**Request**:
```bash
GET /api/security/dashboard/access-patterns?timeWindow=24
Authorization: Bearer <admin_firebase_token>
X-2FA-Verified: true
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalAccess": 1234,
    "byResource": {
      "patient": 856,
      "prescription": 234,
      "vital": 144
    },
    "byHour": [12, 8, 5, 3, 2, 4, 15, 42, 67, 89, 102, ...],
    "topUsers": [
      { "userId": "doctor_smith", "accessCount": 234 },
      { "userId": "doctor_jones", "accessCount": 187 },
      ...
    ],
    "averagePerHour": "51.4"
  }
}
```

## Frontend Integration

### React Dashboard Component Example

```javascript
// SecurityDashboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

export const SecurityDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await axios.get('/api/security/dashboard/overview', {
          headers: {
            'Authorization': 'Bearer ' + firebaseToken,
            'X-2FA-Verified': 'true'
          }
        });

        setDashboard(response.data.data);
      } catch (error) {
        console.error('Dashboard error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="security-dashboard">
      {/* Health Score Card */}
      <div className="health-score-card">
        <h2>Security Health Score</h2>
        <div className="score">{dashboard.healthScore.score}/100</div>
        <div className="rating">{dashboard.healthScore.rating}</div>

        {dashboard.healthScore.recommendations.length > 0 && (
          <div className="recommendations">
            <h3>Recommendations:</h3>
            <ul>
              {dashboard.healthScore.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Failed Logins (24h)</h3>
          <div className="metric-value">{dashboard.metrics.failedLogins}</div>
        </div>

        <div className="metric-card">
          <h3>Active Sessions</h3>
          <div className="metric-value">{dashboard.activeSessions.totalActive}</div>
        </div>

        <div className="metric-card">
          <h3>2FA Adoption</h3>
          <div className="metric-value">{dashboard.twoFAAdoption.adoptionRate}%</div>
        </div>

        <div className="metric-card">
          <h3>Suspicious Activity</h3>
          <div className="metric-value">{dashboard.metrics.suspiciousActivity}</div>
        </div>
      </div>

      {/* Recent Suspicious Activities */}
      <div className="suspicious-activities">
        <h2>Recent Alerts</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Event</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.suspiciousActivities.map(activity => (
              <tr key={activity.id}>
                <td>{new Date(activity.timestamp).toLocaleString()}</td>
                <td>{activity.userId}</td>
                <td>{activity.description}</td>
                <td>
                  <span className={`severity-${activity.severity}`}>
                    {activity.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### Chart.js Integration Example

```javascript
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Access Patterns by Hour
const accessByHourData = {
  labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
  datasets: [{
    label: 'Access Count',
    data: dashboard.dataAccessPatterns.byHour,
    borderColor: 'rgb(75, 192, 192)',
    backgroundColor: 'rgba(75, 192, 192, 0.2)',
  }]
};

<Line data={accessByHourData} options={{ responsive: true }} />

// Sessions by Device
const deviceData = {
  labels: Object.keys(dashboard.activeSessions.byDevice),
  datasets: [{
    data: Object.values(dashboard.activeSessions.byDevice),
    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
  }]
};

<Doughnut data={deviceData} />

// 2FA Adoption by Role
const twoFAData = {
  labels: dashboard.twoFAAdoption.byRole.map(r => r.role),
  datasets: [{
    label: 'Adoption Rate (%)',
    data: dashboard.twoFAAdoption.byRole.map(r => parseFloat(r.adoptionRate)),
    backgroundColor: 'rgba(54, 162, 235, 0.5)'
  }]
};

<Bar data={twoFAData} options={{ scales: { y: { max: 100 } } }} />
```

## Security Considerations

### ✅ Implemented
- Admin-only access (role check)
- 2FA enforcement for all dashboard access
- Audit logging for dashboard views
- Unauthorized access attempts logged
- No PII/PHI exposed in metrics (only aggregates)

### ⚠️ Best Practices
1. **Regular Monitoring**: Check dashboard daily
2. **Alert Thresholds**: Set up notifications for critical scores
3. **Investigate Anomalies**: Review suspicious activities promptly
4. **2FA Enforcement**: Ensure all admins use 2FA
5. **Access Logs**: Regularly audit who accesses the dashboard

## Monitoring Recommendations

### Daily Tasks
- Review security health score
- Check for suspicious activities
- Monitor failed login attempts
- Verify active sessions look normal

### Weekly Tasks
- Analyze 2FA adoption trends
- Review rate limit violations
- Examine data access patterns
- Investigate any score drops

### Monthly Tasks
- Generate security reports
- Review and update alert thresholds
- Analyze long-term trends
- Plan security improvements

## Interview Talking Points

### Technical Implementation
✅ "I built a centralized security monitoring dashboard that aggregates data from audit logs, active sessions, and user accounts. Admins can see everything from failed login attempts to 2FA adoption rates in real-time."

✅ "The dashboard includes an automated security health score (0-100) that evaluates multiple factors and provides specific recommendations for improvement."

✅ "All dashboard endpoints require admin authentication with 2FA enforcement, and every dashboard access is logged for accountability."

### Security Features
✅ "The dashboard provides early warning of potential security issues - if failed login attempts spike or we see unusual data access patterns, admins are alerted immediately."

✅ "We track 2FA adoption by role, making it easy to identify which user groups need encouragement to enable two-factor authentication."

✅ "The access patterns analysis helps detect insider threats by identifying users accessing unusually high volumes of patient data."

### Business Value
✅ "Security dashboards are critical for compliance - they demonstrate proactive monitoring and provide audit trails for regulatory review."

✅ "The health score gives executives a single number to track security posture over time, making it easy to see if security is improving or degrading."

✅ "By catching security issues early through monitoring, we prevent costly breaches that could damage user trust and business reputation."

## Troubleshooting

### Dashboard Shows No Data
- **Cause**: No audit logs or users in system
- **Solution**: Ensure audit logging is working and users exist

### Health Score is Critical
- **Review**: Check issues and recommendations in response
- **Action**: Address highest-priority issues first

### Can't Access Dashboard
- **Check**: User has admin role
- **Check**: 2FA is enabled and verified
- **Check**: Firebase token is valid

### Metrics Seem Wrong
- **Verify**: Time window parameter is correct
- **Check**: Audit logs are being created properly
- **Review**: Firestore indexes are created

---

**Status**: ✅ Production Ready
**Admin Access**: Required with 2FA
**Refresh Rate**: Recommended 30-60 seconds
**Best Viewed**: Wide screen (1920x1080+)
