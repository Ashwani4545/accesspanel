# Access Panel — Sign In / Sign Up System

A full-stack authentication system: Node.js + Express backend with MongoDB
(via Mongoose), JWT access + refresh tokens, bcrypt password hashing, and a
plain HTML/CSS/JS frontend with login, signup, and a protected dashboard.

## Features

- Sign up with name, email, password (hashed with bcrypt, 12 salt rounds)
- Sign in with short-lived JWT access token (15 min) + httpOnly refresh
  token cookie (7 days)
- Silent token refresh: the frontend automatically retries a failed request
  once after refreshing the access token
- Account lockout after 5 failed login attempts within 15 minutes
- Rate limiting on the login endpoint (20 attempts / 15 min per IP)
- Server-side validation with `express-validator`, field-level error display
  on the frontend
- Protected `/api/auth/me` route guarded by middleware, demoed on the
  dashboard page
- Logout that revokes the specific refresh token server-side

## Project structure

```
login-system/
├── backend/
│   ├── config/db.js              MongoDB connection
│   ├── controllers/authController.js
│   ├── middleware/authMiddleware.js
│   ├── models/User.js            Mongoose schema + password hashing
│   ├── routes/auth.js            /api/auth/* routes + validation rules
│   ├── utils/generateTokens.js
│   ├── server.js                 App entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html                Login page
    ├── signup.html                Signup page
    ├── dashboard.html            Protected page
    ├── css/style.css
    └── js/auth.js                Fetch wrapper + token handling
```

## Setup

### 1. MongoDB

Use a local MongoDB instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas)
cluster. Either way you need a connection string, e.g.:

```
mongodb://127.0.0.1:27017/login-system
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and generate real JWT secrets, e.g.
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
npm run dev      # or: npm start
```

The API runs on `http://localhost:5000` by default.

### 3. Frontend

The frontend is plain static HTML/CSS/JS — no build step. Serve it with any
static server so cookies behave correctly (opening the file directly with
`file://` will break the httpOnly refresh cookie flow):

```bash
cd frontend
npx serve .          # or: python3 -m http.server 5500
```

Then open `http://localhost:5500` (make sure the port matches
`CLIENT_ORIGIN` in `backend/.env`).

If your frontend runs on a different port, update `CLIENT_ORIGIN` in
`backend/.env` and `API_BASE` at the top of `frontend/js/auth.js`.

## API reference

| Method | Route              | Auth required | Description                       |
|--------|---------------------|:--:|------------------------------------|
| POST   | `/api/auth/signup`  | No | Create an account                  |
| POST   | `/api/auth/login`   | No | Log in, sets refresh cookie        |
| POST   | `/api/auth/refresh` | Cookie | Issue a new access token       |
| POST   | `/api/auth/logout`  | No | Revoke refresh token, clear cookie |
| GET    | `/api/auth/me`      | Bearer token | Get current user profile |

## Security notes / things to harden before production

- The access token is currently kept in `localStorage` for simplicity,
  which is readable by any script on the page (XSS risk). A more hardened
  setup keeps the access token in memory only and relies on the refresh
  cookie + a `/refresh` call on page load.
- Add CSRF protection (e.g. `csurf` or a double-submit cookie) since the
  refresh endpoint relies on a cookie.
- Add email verification and a "forgot password" flow for a production
  system.
- Set `secure: true` on the refresh cookie (already done automatically
  when `NODE_ENV=production`) and serve everything over HTTPS.
- Consider hashing refresh tokens before storing them in MongoDB, instead
  of storing them as plain strings.

## Tech stack

**Backend:** Node.js, Express, MongoDB, Mongoose, bcryptjs, jsonwebtoken,
express-validator, express-rate-limit, cookie-parser, cors

**Frontend:** HTML, CSS, vanilla JavaScript (fetch API)
