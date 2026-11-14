# Railway Deployment Guide for PackPlay

This guide explains how to deploy the PackPlay backend API and frontend web application to [Railway](https://railway.app), including provisioning MySQL, Redis, and setting up Google SSO using Google Cloud.

---

## 1. Google Cloud Project & Google SSO Setup

We have provisioned the Google Cloud project via `gcloud`:
* **Project Name:** `PackPlay SSO`
* **Project ID:** `packplay-sso-app`
* **Project Number:** `106271177460`

### Configure OAuth 2.0 Credentials:
1. Open the [Google Cloud Console Credentials page](https://console.cloud.google.com/apis/credentials?project=packplay-sso-app).
2. Configure your **OAuth Consent Screen** ([direct link](https://console.cloud.google.com/apis/credentials/consent?project=packplay-sso-app)):
   - **User Type:** External (or Internal if using Google Workspace).
   - **App Name:** `PackPlay`
   - **User Support Email:** Your email (`your-email@example.com`).
   - **Developer Contact:** Your email.
   - **Scopes:** `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
3. Create the **OAuth Client ID**:
   - Go to **Create Credentials** -> **OAuth client ID**.
   - **Application type:** `Web application`.
   - **Name:** `PackPlay Web Client`.
   - **Authorized JavaScript origins:**
     - `http://localhost:5173`
     - `https://<your-frontend-service>.up.railway.app`
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/auth/sso/google/callback`
     - `https://<your-backend-api-service>.up.railway.app/api/auth/sso/google/callback`
4. Copy the generated **Client ID** and **Client Secret**.

---

## 2. Deploying on Railway

In Railway, create a new project and add the following 4 services:

### Service 1: MySQL Database
* Click **+ New** -> **Database** -> **Add MySQL**.
* Railway will provision a managed MySQL 8 database and automatically generate `DATABASE_URL`.

### Service 2: Redis Cache
* Click **+ New** -> **Database** -> **Add Redis**.
* Railway will provision a managed Redis instance and generate `REDIS_URL`.

### Service 3: PackPlay Backend API
* Click **+ New** -> **GitHub Repo** -> select `PackPlay`.
* In Service **Settings**:
  - **Root Directory:** `/`
  - **Dockerfile Path:** `apps/api/Dockerfile`
* In Service **Variables**:
  | Variable | Value / Source |
  | :--- | :--- |
  | `DATABASE_URL` | `${{MySQL.DATABASE_URL}}` |
  | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
  | `NODE_ENV` | `production` |
  | `PORT` | `3000` (or leave default for Railway `$PORT`) |
  | `JWT_SECRET` | Generate random 64-character string |
  | `CALENDAR_FEED_ENCRYPTION_KEY` | Generate random 32-character string |
  | `SSO_STATE_ENCRYPTION_KEY` | Generate random 32-character string |
  | `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
  | `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |
  | `GOOGLE_REDIRECT_URI` | `https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/sso/google/callback` |
  | `FRONTEND_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
  | `CORS_ORIGIN` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
* In **Networking**:
  - Click **Generate Domain** to get your public API URL (e.g. `https://packplay-api-production.up.railway.app`).

### Service 4: PackPlay Frontend Web
* Click **+ New** -> **GitHub Repo** -> select `PackPlay`.
* In Service **Settings**:
  - **Root Directory:** `apps/web`
  - **Dockerfile Path:** `apps/web/Dockerfile`
* In Service **Variables**:
  | Variable | Value |
  | :--- | :--- |
  | `VITE_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
* In **Networking**:
  - Click **Generate Domain** to get your public Web URL (e.g. `https://packplay-web-production.up.railway.app`).

---

## 3. Post-Deployment Verification

1. Once the services build and deploy:
   - Check API health: `https://<api-domain>/health` -> returns `{"status":"ok","database":"up","redis":"up"}`.
   - Database migrations run automatically on container startup (`npx prisma migrate deploy`).
2. Update your Google Cloud Console OAuth Client:
   - Ensure the generated Railway domains are added to Authorized Origins and Redirect URIs.
3. Open `https://<web-domain>` to test login and Google SSO sign-in!
