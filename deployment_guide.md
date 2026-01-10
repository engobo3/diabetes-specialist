# Deployment Guide for Diabetes Specialist App

This guide outlines the steps to deploy the Diabetes Specialist application (React Client + Node.js Server).

## Prerequisites

- **Node.js** (v18 or higher)
- **Firebase Project**: You need a Firebase project with Authentication and Firestore enabled.
- **Service Account**: A `serviceAccountKey.json` file from your Firebase project console.

## Environment Variables

### Client (`client/.env`)
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=https://your-server-domain.com
```
*For local development:* `http://localhost:5000`

### Server (`server/.env` - Recommended for Production)
For production, it is best to provide credentials via environment variables rather than a file.
```env
PORT=5000
FIREBASE_SERVICE_ACCOUNT={"type": "service_account", ...} 
```
*Alternatively, place `serviceAccountKey.json` in `server/config/`.*

## 1. Build the Client

Navigate to the client directory and run the build command. This compiles the React app into static files.

```bash
cd client
npm install
npm run build
```

The output will be in `client/dist`.

## Firebase Deployment (Recommended)

This project is configured for seamless deployment to Firebase (Hosting + Cloud Functions).

### Prerequisites
1.  **Firebase CLI**: Install with `npm install -g firebase-tools`.
2.  **Login**: Run `firebase login`.
3.  **Project**: Ensure you have a project created in the Firebase Console.

### Steps
1.  **Initialize (One-time)**:
    - Run `firebase init hosting functions`.
    - Select your project.
    - **Hosting**:
        - Public directory: `client/dist`
        - Configure as single-page app? **Yes**
        - Overwrite index.html? **No**
    - **Functions**:
        - Codebase: `server` (Use existing folder)

    *Note: A `firebase.json` is already provided, so you might just need to attach your project.*
    - `firebase use --add` (Select your project)

2.  **Deploy**:
    ```bash
    firebase deploy
    ```
    This command will:
    - Build your client (ensure you ran `npm run build` in `client/` first).
    - Deploy static files to Firebase Hosting.
    - Deploy your Express app to Cloud Functions.

### important Note
Your API URL in the client (`client/.env`) might need to change for production.
After deployment, your API will be available at `https://your-project.web.app/api`.
Make sure `VITE_API_URL` is set relative (empty string) or to the full production URL if they differ.
Since we use rewrites, you can set `VITE_API_URL=""` (empty) in `client/.env.production` so requests go to `/api/...` which Firebase redirects to the function.
