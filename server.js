// server.js — App entry point: DB connection, sessions, routes, static pages

require('dotenv').config();

var path       = require('path');
var express    = require('express');
var session    = require('express-session');
var MongoStore = require('connect-mongo');
var mongoose   = require('mongoose');
var multer     = require('multer');

var authRoutes      = require('./routes/authRoutes');
var complaintRoutes = require('./routes/complaintRoutes');
var adminRoutes     = require('./routes/adminRoutes');
var staffRoutes     = require('./routes/staffRoutes');
var uploadRoutes    = require('./routes/uploadRoutes');

var PORT           = process.env.PORT || 3000;
var MONGO_URI      = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/complaint-tracker';
var SESSION_SECRET = process.env.SESSION_SECRET;
var isProduction   = process.env.NODE_ENV === 'production';

if (!SESSION_SECRET) {
    if (isProduction) {
        console.error('SESSION_SECRET must be set in production.');
        process.exit(1);
    }
    SESSION_SECRET = 'dev-only-insecure-secret';
    console.warn('SESSION_SECRET not set — using an insecure development secret.');
}

var app = express();

if (isProduction) app.set('trust proxy', 1); // needed for secure cookies behind a proxy

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Sessions (stored in MongoDB) ──────────────────────────────
// Cookie name must match res.clearCookie('sessionId') in authController.logout
app.use(session({
    name:              'sessionId',
    secret:            SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    store:             MongoStore.create({ mongoUrl: MONGO_URI, ttl: 24 * 60 * 60 }),
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure:   isProduction,
        maxAge:   24 * 60 * 60 * 1000 // 1 day
    }
}));

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/staff',      staffRoutes);

// ── Attachments (access-checked, stored outside public/) ──────
app.use('/uploads', uploadRoutes);

// ── Static assets (/css, /js) ─────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Page routes ───────────────────────────────────────────────
function page(name) {
    return path.join(__dirname, 'public', 'pages', name + '.html');
}

// Protected pages bounce to /login?next=... when there is no session.
// Role checks happen client-side and on every API call (authMiddleware).
function requireLogin(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.redirect('/login?next=' + encodeURIComponent(req.path));
}

app.get('/',          function(req, res) { res.sendFile(page('index')); });
app.get('/home',      function(req, res) { res.redirect('/'); });
app.get('/login',     function(req, res) { res.sendFile(page('login')); });
app.get('/register',  function(req, res) { res.sendFile(page('register')); });
app.get('/dashboard', requireLogin, function(req, res) { res.sendFile(page('dashboard')); });
app.get('/admin',     requireLogin, function(req, res) { res.sendFile(page('admin')); });
app.get('/staff',     requireLogin, function(req, res) { res.sendFile(page('staff')); });

// ── 404 ───────────────────────────────────────────────────────
app.use(function(req, res) {
    if (req.path.indexOf('/api/') === 0)
        return res.status(404).json({ success: false, message: 'API route not found.' });
    return res.redirect('/');
});

// ── Error handler (multer upload errors, bad JSON, etc.) ──────
// eslint-disable-next-line no-unused-vars
app.use(function(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        var msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum size is 5 MB.' : err.message;
        return res.status(400).json({ success: false, message: msg });
    }
    if (err.type === 'entity.parse.failed')
        return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
    if (err.message === 'Only images and documents are allowed')
        return res.status(400).json({ success: false, message: err.message });

    console.error('Unhandled error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
});

// ── Start ─────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
    .then(function() {
        console.log('MongoDB connected');
        app.listen(PORT, function() {
            console.log('ComplainX running at http://localhost:' + PORT);
        });
    })
    .catch(function(err) {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });
