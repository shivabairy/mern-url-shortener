# MERN URL Shortener

A full-stack URL shortener built with the MERN stack. Paste a long URL, get a short link, copy it, and download a QR code for it. The backend adds production concerns on top of the basics: Redis caching, rate limiting, link expiry, and click tracking.

**Live demo:** https://frontend-ktk2.onrender.com
**Backend API:** https://bakend-3yqb.onrender.com

> The backend runs on Render's free tier, so the first request after a period of inactivity can take 1-2 minutes while the service wakes up.

---

## Features

- Shorten any long URL into a compact 7-character link (generated with `nanoid`)
- One-click copy and QR code generation, with PNG download
- Click tracking: every visit to a short link increments a counter in MongoDB
- Link expiry: each link expires after 30 days and returns `410 Gone`
- Rate limiting: 10 shorten requests per hour per IP, returning `429` when exceeded
- Redis caching (Upstash) using the cache-aside pattern to cut database reads on redirects
- Collision handling: a generated ID is checked against the database and regenerated if it already exists
- Meaningful error messages surfaced to the user in the UI
- CI/CD: every push to GitHub triggers an automatic redeploy on Render

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, DaisyUI, Axios, react-qr-code, qrcode |
| Backend | Node.js, Express.js, express-rate-limit, cors, dotenv, nanoid |
| Database | MongoDB Atlas with Mongoose |
| Cache | Redis via Upstash (`@upstash/redis`) |
| Deployment | Render (Web Service for the API, Static Site for the frontend) |

---

## Architecture

```
User (browser)
      |
      v
Frontend: React + Vite  (Render Static Site)
      |  Axios POST /api/shorten
      v
Backend: Node.js + Express  (Render Web Service)
      |
      |-- CORS + JSON body parsing
      |-- Rate limiter (10 requests/hour per IP)
      |-- Route handlers
      |        |
      |        |-- GET /:shortId  -->  Redis cache  --hit-->  redirect
      |        |                          |
      |        |                         miss
      |        |                          v
      |        |                      MongoDB Atlas  -->  cache result  -->  redirect
      |        |
      |        '-- POST /api/shorten  -->  generate unique ID  -->  save to MongoDB
      v
Response: { shortId, shortUrl }
```

### Redirect flow

1. A request arrives at `GET /:shortId`.
2. The server checks Redis for the ID.
3. On a cache hit, it redirects immediately.
4. On a cache miss, it queries MongoDB, returns `404` if the ID is unknown or `410` if the link has expired, stores the original URL in Redis for 24 hours, increments the click counter, and redirects.

---

## API Reference

### `POST /api/shorten`

Creates a short link. Rate limited to 10 requests per hour per IP.

**Request body**

```json
{ "originalUrl": "https://www.example.com/some/very/long/path" }
```

**Success response**

```json
{
  "shortId": "aB3xK9m",
  "shortUrl": "https://bakend-3yqb.onrender.com/aB3xK9m"
}
```

### `GET /:shortId`

Redirects to the original URL.

### Status codes

| Code | Meaning |
|---|---|
| `302` | Redirect to the original URL |
| `400` | Missing `originalUrl` in the request body |
| `404` | Short link does not exist |
| `410` | Short link has expired |
| `429` | Rate limit exceeded |
| `500` | Server error |

---

## Data Model

```js
{
  originalUrl: String,   // required
  shortId:     String,   // required, unique (indexed)
  clicks:      Number,   // default 0
  expiresAt:   Date,     // default: 30 days from creation
  createdAt:   Date,     // added by timestamps
  updatedAt:   Date      // added by timestamps
}
```

---

## Project Structure

```
MERN-URL-SHORTENER/
|-- backend/
|   |-- config/
|   |   '-- redis.js        # Upstash Redis client
|   |-- models/
|   |   '-- Url.js          # Mongoose schema
|   |-- routes/
|   |   '-- url.js          # shorten + redirect routes
|   |-- server.js           # Express app, middleware, DB connection
|   '-- package.json
'-- frontend/
    |-- src/
    |   |-- App.jsx         # UI and API calls
    |   |-- main.jsx
    |   '-- index.css       # Tailwind + DaisyUI imports
    '-- package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A MongoDB Atlas cluster (with your IP allowed in Network Access)
- An Upstash Redis database

### 1. Clone the repository

```bash
git clone https://github.com/shivabairy/mern-url-shortener.git
cd mern-url-shortener
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

Start the server:

```bash
npm run dev
```

You should see `Connected to MongoDB` and `Server running on port 5000`.

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:5000/api
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:5173.

---

## Deployment

| Service | Type | Notes |
|---|---|---|
| Backend | Render Web Service | Root directory `backend`, build `npm install`, start `node server.js` |
| Frontend | Render Static Site | Set `VITE_BACKEND_URL` to the deployed backend URL plus `/api` |

Set the same environment variables from the backend `.env` in the Render dashboard, with `BASE_URL` and `FRONTEND_URL` pointing at the deployed URLs. `FRONTEND_URL` must not have a trailing slash, otherwise CORS will block requests.

Pushing to the `main` branch redeploys both services automatically.

---

## Design Decisions

- **`nanoid` over UUID:** UUIDs are 36 characters with hyphens, which defeats the purpose of a short link. `nanoid(7)` gives compact, URL-safe IDs.
- **`410 Gone` for expired links:** distinguishes "this existed but is no longer available" from `404 Not Found`.
- **Rate limit on the shorten route only:** redirects stay unrestricted so legitimate link visitors are never blocked.
- **Cache-aside with Redis:** popular links are served from memory instead of hitting MongoDB on every redirect.
- **Environment-based configuration:** backend and frontend URLs live in environment variables, so the same code runs locally and in production.

---

## Known Limitations and Roadmap

- Redirects served from the Redis cache skip the click counter and the expiry check, so click counts undercount cached visits. A fix is to increment clicks asynchronously and store the expiry time alongside the cached value.
- Add a MongoDB TTL index on `expiresAt` to delete expired links automatically.
- Add user authentication (JWT) so each user can manage their own links.
- Add a dashboard with per-link analytics (clicks over time, device, location).
- Support custom aliases for short links.

---

## Author

**Bairi Shiva**
B.Tech, Computer Science and Engineering, Sreenidhi Institute of Science and Technology

GitHub: [shivabairy](https://github.com/shivabairy)
