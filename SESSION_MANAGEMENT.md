# Session Management & Timeout System

## Overview
Comprehensive session management system for GlucoSoin providing timeout enforcement, token rotation, and concurrent session control to enhance security and user experience.

## Features Implemented

### ✅ Core Functionality
- **Session Creation**: Create sessions on login with device tracking
- **Idle Timeout**: Automatic logout after 30 minutes of inactivity
- **Absolute Timeout**: Maximum session length of 12 hours
- **Token Rotation**: Automatic token refresh after 15 minutes
- **Concurrent Session Limits**: Maximum 3 devices per user
- **Session Management**: View and manage all active sessions

### ✅ Security Features
- Device tracking (browser, OS, mobile/desktop)
- IP address logging
- Session invalidation (manual and automatic)
- Audit logging for all session events
- Protection against session hijacking

## Architecture

### Backend Components

#### Service Layer
**File**: `server/services/sessionService.js`
- Session creation with device fingerprinting
- Session validation with timeout checks
- Activity updates for idle timeout prevention
- Session invalidation (individual and bulk)
- Concurrent session limit enforcement
- Automatic cleanup of expired sessions

#### Middleware
**File**: `server/middleware/sessionMiddleware.js`
- `validateSession`: Validates active sessions and checks timeouts
- `checkTokenRotation`: Notifies client when token needs refresh
- `optionalSession`: Validates session if present (non-blocking)

#### Controller
**File**: `server/controllers/sessionController.js`
- `POST /api/sessions/create` - Create new session
- `GET /api/sessions/validate` - Validate current session
- `POST /api/sessions/refresh` - Refresh activity timestamp
- `POST /api/sessions/logout` - Logout from current device
- `POST /api/sessions/logout-all` - Logout from all devices
- `GET /api/sessions/list` - View all active sessions
- `DELETE /api/sessions/:id` - Invalidate specific session
- `GET /api/sessions/config` - Get timeout configuration

#### Routes
**File**: `server/routes/sessionRoutes.js`
- All session management endpoints with authentication

### Data Storage
Stored in Firestore `user_sessions` collection:
```javascript
{
  sessionId: 'auto-generated-id',
  userId: 'firebase_uid',
  userRole: 'patient|doctor|admin',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  createdAt: '2025-01-15T10:30:00Z',
  lastActivity: '2025-01-15T10:45:00Z',
  expiresAt: '2025-01-15T22:30:00Z',    // Absolute timeout
  isActive: true,
  deviceInfo: {
    browser: 'Chrome',
    os: 'Windows',
    device: 'Desktop'
  }
}
```

### Configuration
Default timeouts (configurable):
```javascript
{
  idleTimeout: 30 * 60 * 1000,           // 30 minutes
  absoluteTimeout: 12 * 60 * 60 * 1000,  // 12 hours
  maxConcurrentSessions: 3,               // 3 devices
  tokenRotationInterval: 15 * 60 * 1000  // 15 minutes
}
```

## Usage Guide

### Login Flow Integration

#### Step 1: User Logs In
User authenticates with Firebase Auth (email/password).

#### Step 2: Create Session
After successful authentication, create a session:
```bash
POST /api/sessions/create
Authorization: Bearer <firebase_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Session created successfully",
  "data": {
    "sessionId": "abc123...",
    "expiresAt": "2025-01-15T22:30:00Z"
  }
}
```

**Frontend Action**:
- Store `sessionId` in localStorage or cookie
- Include in subsequent requests via `X-Session-ID` header

#### Step 3: Include Session ID in Requests
```javascript
fetch('/api/patients/123', {
  headers: {
    'Authorization': 'Bearer ' + firebaseToken,
    'X-Session-ID': sessionId
  }
});
```

### Session Validation

Middleware automatically validates sessions on protected routes:
```javascript
const { validateSession } = require('./middleware/sessionMiddleware');

router.get('/protected-route',
  verifyToken,        // Firebase auth
  validateSession,    // Session validation
  controller.method
);
```

**Automatic Checks**:
- ✅ Session exists
- ✅ User ID matches
- ✅ Session is active
- ✅ Not past absolute timeout
- ✅ Not past idle timeout

**On Timeout**:
```json
{
  "success": false,
  "error": "Session expired or invalid",
  "reason": "idle_timeout" | "absolute_timeout",
  "requiresLogin": true
}
```

### Keep-Alive (Prevent Idle Timeout)

Frontend should periodically refresh session during user activity:
```javascript
// Refresh every 5 minutes during active use
setInterval(async () => {
  await fetch('/api/sessions/refresh', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + firebaseToken,
      'X-Session-ID': sessionId
    }
  });
}, 5 * 60 * 1000);
```

### Token Rotation

Middleware adds header when token needs rotation:
```javascript
const { checkTokenRotation } = require('./middleware/sessionMiddleware');

router.use(verifyToken, validateSession, checkTokenRotation);
```

**Response Header**:
```
X-Token-Rotation-Required: true
```

**Frontend Action**:
```javascript
if (response.headers.get('X-Token-Rotation-Required')) {
  // Refresh Firebase token
  const newToken = await firebase.auth().currentUser.getIdToken(true);
  // Update stored token
  localStorage.setItem('firebaseToken', newToken);
}
```

### Logout

#### Single Device Logout
```bash
POST /api/sessions/logout
Authorization: Bearer <firebase_token>
X-Session-ID: <session_id>
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### All Devices Logout
```bash
POST /api/sessions/logout-all
Authorization: Bearer <firebase_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out from 3 device(s) successfully",
  "sessionsInvalidated": 3
}
```

### Session Management UI

#### View Active Sessions
```bash
GET /api/sessions/list
Authorization: Bearer <firebase_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "abc123",
        "createdAt": "2025-01-15T10:30:00Z",
        "lastActivity": "2025-01-15T11:45:00Z",
        "ipAddress": "192.168.1.1",
        "deviceInfo": {
          "browser": "Chrome",
          "os": "Windows",
          "device": "Desktop"
        }
      },
      {
        "sessionId": "def456",
        "createdAt": "2025-01-14T08:00:00Z",
        "lastActivity": "2025-01-15T09:30:00Z",
        "ipAddress": "10.0.0.5",
        "deviceInfo": {
          "browser": "Safari",
          "os": "iOS",
          "device": "Mobile"
        }
      }
    ],
    "count": 2
  }
}
```

#### Invalidate Specific Session
```bash
DELETE /api/sessions/def456
Authorization: Bearer <firebase_token>
```

**Use Case**: User sees unfamiliar device and wants to revoke access.

## Frontend Integration

### React Example

```javascript
// SessionManager.js
import { useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const useSessionManager = () => {
  const { firebaseToken, logout } = useContext(AuthContext);
  const sessionId = localStorage.getItem('sessionId');

  // Create session on login
  const createSession = async () => {
    const response = await fetch('/api/sessions/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + firebaseToken
      }
    });

    const data = await response.json();
    if (data.success) {
      localStorage.setItem('sessionId', data.data.sessionId);
    }
  };

  // Keep-alive interval
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch('/api/sessions/refresh', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + firebaseToken,
          'X-Session-ID': sessionId
        }
      });

      if (!response.ok) {
        // Session expired, logout
        logout();
      }

      // Check for token rotation
      if (response.headers.get('X-Token-Rotation-Required')) {
        await refreshFirebaseToken();
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [firebaseToken, sessionId]);

  return { createSession };
};
```

### Axios Interceptor for Session Headers

```javascript
import axios from 'axios';

axios.interceptors.request.use(config => {
  const sessionId = localStorage.getItem('sessionId');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  return config;
});

axios.interceptors.response.use(
  response => {
    // Check for token rotation
    if (response.headers['x-token-rotation-required']) {
      refreshFirebaseToken();
    }
    return response;
  },
  error => {
    if (error.response?.status === 401) {
      // Session expired, redirect to login
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(error);
  }
);
```

## Testing

### Test Suite
**File**: `server/__tests__/session-management.test.js`

**20 Tests Covering**:
- ✅ Session creation with device parsing
- ✅ Expiration time calculation
- ✅ Session validation (valid, invalid, mismatched)
- ✅ Activity timestamp updates
- ✅ Session invalidation
- ✅ Multiple session management
- ✅ Concurrent session limits
- ✅ Token rotation indicators
- ✅ Configuration validation
- ✅ Cleanup operations
- ✅ Edge cases (null/empty values)

**Run Tests**:
```bash
cd server
npm test -- __tests__/session-management.test.js
```

**Results**: ✅ 20/20 passing

## Security Considerations

### ✅ Implemented
- Session IDs are cryptographically secure (Firestore auto-generated)
- IP address logging for anomaly detection
- Device fingerprinting for user awareness
- Automatic timeout enforcement (idle and absolute)
- Concurrent session limits prevent account sharing
- Audit logging for all session events
- Token rotation prevents token reuse attacks

### ⚠️ Production Recommendations
1. **HTTPS Only**: Ensure all traffic is encrypted
2. **Secure Cookies**: Use HttpOnly, Secure, SameSite cookies for session ID
3. **IP Change Detection**: Alert user if IP changes during session
4. **Geographic Alerts**: Notify user of logins from unusual locations
5. **Device Verification**: Implement device recognition/trust
6. **Session Hijacking Detection**: Monitor for suspicious activity patterns
7. **Brute Force Protection**: Rate limit session creation attempts

## Maintenance

### Automatic Cleanup
Run cleanup job periodically (e.g., daily cron):
```javascript
const sessionService = require('./services/sessionService');

// Clean up expired sessions
const cleanedCount = await sessionService.cleanupExpiredSessions();
console.log(`Cleaned ${cleanedCount} expired sessions`);
```

**Cloud Functions Example**:
```javascript
exports.cleanupSessions = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const count = await sessionService.cleanupExpiredSessions();
    console.log(`Cleaned ${count} sessions`);
  });
```

## Interview Talking Points

### Technical Implementation
✅ "I implemented a comprehensive session management system with idle and absolute timeouts. Sessions automatically expire after 30 minutes of inactivity or 12 hours maximum, preventing abandoned sessions from remaining active."

✅ "The system tracks device information (browser, OS, mobile/desktop) and IP addresses, allowing users to see all active sessions and revoke access from unfamiliar devices."

✅ "Token rotation is handled transparently - the middleware notifies the client when a token needs refresh, preventing expired token errors."

### Security Features
✅ "Concurrent session limits prevent account sharing by restricting users to 3 active devices. Older sessions are automatically invalidated when the limit is reached."

✅ "All session events are logged to the audit system, providing visibility into login patterns and suspicious activity."

✅ "The idle timeout prevents security risks from users leaving their accounts logged in on public computers."

### Best Practices
✅ "I followed OWASP session management guidelines, including secure session ID generation, timeout enforcement, and proper session invalidation on logout."

✅ "The system is designed for horizontal scalability - sessions are stored in Firestore rather than server memory, allowing multiple backend instances to share session state."

## Troubleshooting

### Session Expires Too Quickly
- **Cause**: Frontend not refreshing session activity
- **Solution**: Implement keep-alive mechanism (call `/api/sessions/refresh` every 5 minutes)

### User Logged Out Unexpectedly
- **Check**: Audit logs for session invalidation reason
- **Common Causes**:
  - Idle timeout (no activity for 30 minutes)
  - Absolute timeout (session older than 12 hours)
  - Manual logout from another device
  - Concurrent session limit reached

### Token Rotation Not Working
- **Check**: Frontend handling `X-Token-Rotation-Required` header
- **Solution**: Implement response interceptor to refresh Firebase token

### Session Not Found Error
- **Cause**: Session ID not included in request headers
- **Solution**: Ensure `X-Session-ID` header is sent with all authenticated requests

---

**Status**: ✅ Production Ready
**Test Coverage**: 20/20 tests passing
**Security Review**: Recommended before production deployment
