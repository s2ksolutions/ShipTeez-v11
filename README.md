# ShipTeez - Deployment Guide

This guide details how to deploy the ShipTeez e-commerce platform.

## Architecture

*   **Frontend**: React (Vite)
*   **Backend**: Node.js (Express)
*   **Database**: SQLite (Local) or PostgreSQL (Remote)
*   **AI**: Google Gemini API

---

## 1. Prerequisites

*   **Node.js 18+**
*   **npm** or **yarn**

---

## 2. Setup

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration
Create a `.env` file (optional for local dev):
```
JWT_SECRET=your_secret_key
API_KEY=your_gemini_api_key
```

### Build Frontend
```bash
npm run build
```

---

## 3. Running Locally

### Backend (Node.js)
Start the Express server. It will automatically initialize the `shipteez.db` SQLite database.

```bash
# Runs on http://localhost:3001
node server.js
```

### Frontend (Vite)
Run the development server for the UI.

```bash
# Runs on http://localhost:5173
npm run dev
```

The frontend is configured to proxy requests or point to `http://localhost:3001/api` by default.

---

## 4. Production

For production deployment:
1.  Serve the `dist` folder using Nginx or the Express server itself.
2.  Set `NODE_ENV=production`.
3.  Use a robust database like PostgreSQL if scaling horizontally.
