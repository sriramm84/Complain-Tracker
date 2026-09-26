# ComplainX — Complaint Tracker

A web-based complaint management system for submitting, assigning, tracking, and resolving user complaints. Built with Node.js, Express, MongoDB (Mongoose), and vanilla JS/Bootstrap on the frontend.

## Features

- **Role-based access** — separate portals and permissions for `user`, `staff`, and `admin` roles, enforced via session-backed middleware that re-checks the role from the database on every request.
- **Complaint lifecycle** — `Submitted → Under Review → Assigned → In Progress → Resolved → Closed` (or `Rejected`), with a full status-history trail per complaint.
- **Auto-prioritization** — complaint priority (`Low` / `Medium` / `High`) is detected automatically rather than chosen by the user.
- **File attachments** — users can attach an image or document (jpg, png, gif, pdf, doc, docx) to a complaint, up to 5 MB, handled via Multer.
- **OTP-protected edits** — editing a submitted complaint requires a one-time password sent to the user's email.
- **Admin tools** — assign complaints to staff, confirm resolutions, manage categories, manage user roles, view assignment logs, view stats, and export complaints to CSV.
- **Staff portal** — staff can view complaints assigned to them and update status as they work.
- **Transactional email** — HTML emails (via Nodemailer/Gmail) for complaint confirmation, assignment (to user and staff), status updates, resolution confirmation, admin completion alerts, and OTP delivery.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB with Mongoose ODM
- **Auth:** Session-based authentication, bcrypt password hashing
- **File Uploads:** Multer
- **Email:** Nodemailer (Gmail transport)
- **Frontend:** HTML, vanilla JavaScript, Bootstrap 5

## Project Structure

```
.
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
│   └── staffRoutes.js
└── README.md
```

> **Note:** This repository currently ships the application logic (models, controllers, routes, views) but does not include a `server.js`/`app.js` entry point or a `package.json`. To run the project you'll need to add both — see [Setup](#setup) below for the pieces they need to wire together.

## API Overview

All routes are JSON APIs unless noted; mount them under a prefix such as `/api` in your entry file.

### Auth (`authRoutes.js`)
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

### Complaints (`complaintRoutes.js`)
| Method | Route | Access |
|---|---|---|
| POST | `/` | Authenticated (multipart, optional `attachment`) |
| GET | `/my` | Authenticated |
| GET | `/:id` | Authenticated |
| POST | `/:id/request-otp` | Authenticated |
| PUT | `/:id` | Authenticated (requires OTP) |
| DELETE | `/:id` | Authenticated |

### Staff (`staffRoutes.js`)
| Method | Route | Access |
|---|---|---|
| GET | `/complaints` | Staff |
| GET | `/complaints/:id` | Staff |
| PUT | `/complaints/:id/status` | Staff |

### Admin (`adminRoutes.js`)
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

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/sriramm84/complain-tracker.git
   cd complain-tracker
   ```

2. **Add a `package.json`** (not yet present) and install dependencies used by this codebase:
   ```bash
   npm init -y
   npm install express mongoose bcryptjs express-session multer nodemailer
   ```

3. **Add an entry file** (e.g. `server.js`) that:
   - Connects to MongoDB via `mongoose.connect(...)`
   - Configures `express-session`
   - Serves the `public/` folder as static files
   - Mounts the route files, e.g.:
     ```js
     app.use('/api/auth', require('./routes/authRoutes'));
     app.use('/api/complaints', require('./routes/complaintRoutes'));
     app.use('/api/staff', require('./routes/staffRoutes'));
     app.use('/api/admin', require('./routes/adminRoutes'));
     ```

4. **Environment variables** — create a `.env` file (and load it, e.g. with `dotenv`):
   ```
   MONGODB_URI=mongodb://localhost:27017/complaintracker
   SESSION_SECRET=your-session-secret
   MAIL_USER=your-gmail-address@gmail.com
   MAIL_PASS=your-gmail-app-password
   PORT=3000
   ```
   - `MAIL_USER` / `MAIL_PASS` are required for email notifications (Gmail transport, via `config/mailer.js`); if unset, email sending is disabled but the rest of the app still runs.

5. **Run**
   ```bash
   node server.js
   ```
   Then open `public/pages/index.html` (served statically) in your browser.

## Roles

| Role | Capabilities |
|---|---|
| `user` | Submit, view, and (with OTP) edit their own complaints |
| `staff` | View and update status of complaints assigned to them |
| `admin` | Full visibility: assign complaints, manage categories, manage user roles, view logs/stats, export CSV |

## License

No license specified yet. Add a `LICENSE` file if you intend to open-source this project.
