# ComplainX — Complaint Tracker

A web-based complaint management system for submitting, assigning, tracking, and resolving user complaints. Built with Node.js, Express, MongoDB (Mongoose), and AngularJS/Bootstrap on the frontend.

## Features

- **Role-based access** — separate portals and permissions for `user`, `staff`, and `admin` roles, enforced via session-backed middleware that re-checks the role from the database on every request.
- **Complaint lifecycle** — `Submitted → Under Review → Assigned → In Progress → Resolved → Closed` (or `Rejected`), with a full status-history trail per complaint.
- **Auto-prioritization** — complaint priority (`Low` / `Medium` / `High`) is detected automatically from keywords rather than chosen by the user. Each complaint gets a readable ID (`CX1`, `CX2`, …).
- **File attachments** — users can attach an image or document (jpg, png, gif, pdf, doc, docx) to a complaint, up to 5 MB. Attachments are private: only the submitter, the assigned staff member, and admins can open them.
- **OTP-protected edits** — editing a submitted complaint requires a one-time password sent to the user's email.
- **Admin tools** — assign complaints to staff, confirm resolutions, manage categories, manage user roles, view assignment logs, view stats, and export complaints to CSV.
- **Staff portal** — staff can view complaints assigned to them and update status as they work.
- **Transactional email** — HTML emails (via Nodemailer/Gmail) for complaint confirmation, assignment (to user and staff), status updates, resolution confirmation, admin completion alerts, and OTP delivery.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB with Mongoose ODM
- **Auth:** Session-based authentication (`express-session`, sessions stored in MongoDB via `connect-mongo`), bcrypt password hashing
- **File Uploads:** Multer
- **Email:** Nodemailer (Gmail transport)
- **Frontend:** HTML, AngularJS, vanilla JavaScript, Bootstrap 5

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, or a MongoDB Atlas connection string

### 1. Clone and install

```bash
git clone https://github.com/sriramm84/Complain-Tracker.git
cd Complain-Tracker
npm install
```

### 2. Configure environment variables

Copy the example file and edit it:

```bash
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows
```

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | HTTP port (default `3000`) |
| `NODE_ENV` | No | Set to `production` when deploying (enables secure cookies) |
| `MONGO_URI` | Yes | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/complaint-tracker` |
| `SESSION_SECRET` | Yes | Long random string used to sign session cookies (mandatory when `NODE_ENV=production`) |
| `MAIL_USER` | No | Gmail address used to send emails |
| `MAIL_PASS` | No | Gmail [App Password](https://myaccount.google.com/apppasswords) (not your normal password) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` | For seeding | First admin account, created by `npm run seed` |

If `MAIL_USER` / `MAIL_PASS` are left empty the app still runs, but no emails are sent and complaint editing is unavailable (it needs an emailed OTP).

### 3. Seed the database (first run only)

```bash
npm run seed
```

This creates the admin account from your `.env` and a set of default categories (Electrical, Plumbing, IT Support, Cleaning, Maintenance, Other). It is safe to run again; existing data is left untouched.

### 4. Start the server

```bash
npm start        # normal start
npm run dev      # auto-restarts when you edit code
```

Open **http://localhost:3000** in your browser.

### 5. Log in

| Role | How to get access | Lands on |
|---|---|---|
| `admin` | Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` | `/admin` |
| `user` | Register a new account | `/dashboard` |
| `staff` | Register a normal account, then an admin changes its role to **staff** under **Users** | `/staff` |

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm : File ...\npm.ps1 cannot be loaded because running scripts is disabled` (Windows PowerShell) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use `npm.cmd` instead of `npm` |
| `net start MongoDB` → `System error 5 ... Access is denied` (Windows) | MongoDB is usually already running as a service. Check with `Get-Service MongoDB`; if it's stopped, start it from an Administrator terminal |
| `MongoDB connection failed` on startup | MongoDB isn't running, or `MONGO_URI` is wrong |
| `EADDRINUSE` / port already in use | Change `PORT` in `.env` |
| Seed prints `Skipping admin` | Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` |
| No emails arrive | Set `MAIL_USER` and a Gmail App Password in `MAIL_PASS`, then restart |

## Project Structure

```
.
├── server.js                # Entry point: MongoDB, sessions, routes, page routing, error handling
├── package.json
├── .env.example             # Template for your .env
├── config/
│   └── mailer.js            # Nodemailer setup + HTML email templates
├── controllers/
│   ├── adminController.js
│   ├── authController.js
│   ├── complaintController.js
│   └── staffController.js
├── middleware/
│   └── authMiddleware.js    # isAuthenticated / isAdmin / isStaff guards
├── models/
│   ├── AssignmentLog.js
│   ├── Category.js
│   ├── Complaint.js
│   └── User.js
├── public/
│   ├── css/style.css
│   ├── js/                  # admin.js, auth.js, staff.js, user.js
│   └── pages/               # index, home, login, register, dashboard, staff, admin
├── routes/
│   ├── adminRoutes.js
│   ├── authRoutes.js
│   ├── complaintRoutes.js
│   ├── staffRoutes.js
│   └── uploadRoutes.js      # Access-checked attachment downloads
├── scripts/
│   └── seed.js              # Creates first admin + default categories
├── utils/
│   └── escapeRegex.js       # Escapes user input used in database searches
├── uploads/                 # Attachments (created at runtime, not committed)
└── README.md
```

## Pages

| URL | Page | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/login`, `/register` | Authentication | Public |
| `/dashboard` | User portal | Logged in |
| `/staff` | Staff portal | Logged in (staff) |
| `/admin` | Admin portal | Logged in (admin) |

Protected pages redirect to `/login` when there is no session.

## API Overview

All API routes return JSON.

### Auth — `/api/auth`
| Method | Route | Access |
|---|---|---|
| POST | `/register` | Public |
| POST | `/login` | Public |
| POST | `/logout` | Public |
| GET | `/session` | Public |
| GET | `/categories` | Authenticated |
| GET | `/profile` | Authenticated |
| PUT | `/profile` | Authenticated |
| PUT | `/change-password` | Authenticated |

### Complaints — `/api/complaints`
| Method | Route | Access |
|---|---|---|
| POST | `/` | Authenticated (multipart, optional `attachment`) |
| GET | `/my` | Authenticated |
| GET | `/:id` | Authenticated |
| POST | `/:id/request-otp` | Authenticated |
| PUT | `/:id` | Authenticated (requires OTP) |
| DELETE | `/:id` | Authenticated |

### Staff — `/api/staff`
| Method | Route | Access |
|---|---|---|
| GET | `/complaints` | Staff |
| GET | `/complaints/:id` | Staff |
| PUT | `/complaints/:id/status` | Staff |

### Admin — `/api/admin`
| Method | Route | Access |
|---|---|---|
| GET | `/complaints` | Admin |
| PUT | `/complaints/:id` | Admin |
| DELETE | `/complaints/:id` | Admin |
| POST | `/complaints/:id/assign` | Admin |
| POST | `/complaints/:id/confirm-resolution` | Admin |
| GET | `/assignment-logs` | Admin |
| GET | `/staff` | Admin |
| GET | `/stats` | Admin |
| GET | `/export-csv` | Admin |
| GET | `/users` | Admin |
| PUT | `/users/:id/role` | Admin |
| GET | `/categories` | Admin |
| POST | `/categories` | Admin |
| DELETE | `/categories/:id` | Admin |

### Attachments — `/uploads`
| Method | Route | Access |
|---|---|---|
| GET | `/:file` | Submitter, assigned staff, or admin |

## Roles

| Role | Capabilities |
|---|---|
| `user` | Submit, view, and (with OTP) edit their own complaints |
| `staff` | View and update status of complaints assigned to them |
| `admin` | Full visibility: assign complaints, manage categories, manage user roles, view logs/stats, export CSV |

## Security Notes

- Passwords are hashed with bcrypt; sessions are stored server-side in MongoDB with `httpOnly` cookies.
- User roles are re-read from the database on every request, so role changes apply immediately.
- Search input is escaped before being used in database queries.
- Attachments are stored outside `public/` and served only to permitted users.
- OTPs are generated with Node's cryptographically secure `crypto.randomInt` and expire after 2 minutes.
- Never commit your `.env` file; it is listed in `.gitignore`.

## License

No license specified yet. Add a `LICENSE` file if you intend to open-source this project.
