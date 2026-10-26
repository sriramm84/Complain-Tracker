# complaint-tracker
A web-based complaint tracking system for managing, monitoring, and resolving user complaints.

**ComplainX** lets users submit complaints (with an optional attachment), admins review and assign them to staff, and staff resolve them, with email notifications at each step.

## Features
- **Users:** register and log in, submit complaints with a file attachment, track status and history, edit a complaint after OTP verification by email, manage their profile and password
- **Admins:** view, filter and search all complaints, set status and priority, assign complaints to staff, confirm resolutions, view the assignment log, manage users' roles and categories, export to CSV
- **Staff:** view assigned complaints and mark them In Progress or Resolved
- **Automatic priority** detection from complaint keywords, and human-readable IDs (`CX1`, `CX2`, ...)

Workflow: `Submitted → Under Review → Assigned → In Progress → Resolved → Closed` (or `Rejected`)

## Tech stack
Node.js, Express, MongoDB (Mongoose), express-session with connect-mongo, Multer, Nodemailer, AngularJS and Bootstrap 5.

## Getting started

**Requirements:** Node.js 18+ and MongoDB (local or Atlas)

```bash
npm install
cp .env.example .env      # then edit the values
npm run seed              # creates the first admin + default categories
npm start                 # or: npm run dev (auto-restart on changes)
```

Open http://localhost:3000 and log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

To add staff: have the person register as a normal user, then change their role to **staff** in Admin → Users.

## Configuration (`.env`)
| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `3000`) |
| `MONGO_URI` | MongoDB connection string |
| `SESSION_SECRET` | Secret for signing session cookies (required when `NODE_ENV=production`) |
| `MAIL_USER`, `MAIL_PASS` | Gmail address and [App Password](https://myaccount.google.com/apppasswords) for notifications and OTPs |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` | First admin account, used by `npm run seed` |

If mail isn't configured the app still runs, but no notifications are sent and complaint editing isn't available, because it needs an emailed OTP.

## Project structure
```
server.js            App entry: DB, sessions, routes, static pages
config/mailer.js     Email templates and sending
controllers/         Request handlers (auth, complaint, admin, staff)
middleware/          Session and role guards
models/              Mongoose schemas (User, Complaint, Category, AssignmentLog)
routes/              API routers under /api/*, plus access-checked /uploads
scripts/seed.js      Creates the first admin and default categories
utils/               Shared helpers
public/              Frontend (pages, js, css)
uploads/             Complaint attachments (served only to the submitter, assigned staff and admins)
```

## Pages
| URL | Page |
|---|---|
| `/` | Landing page |
| `/login`, `/register` | Authentication |
| `/dashboard` | User portal |
| `/admin` | Admin portal |
| `/staff` | Staff portal |
