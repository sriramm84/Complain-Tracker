// middleware/authMiddleware.js
// ALWAYS reads role live from the DB so role changes take effect immediately.

var User = require('../models/User');

// Any logged-in user
async function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'Please login to continue.' });
    }
    try {
        var user = await User.findById(req.session.userId).select('role name');
        if (!user) {
            req.session.destroy(function() {});
            return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
        }
        // Keep session role in sync with DB
        req.session.role = user.role;
        req.session.name = user.name;
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
}

// Admin only — reads role live from DB
async function isAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'Please login to continue.' });
    }
    try {
        var user = await User.findById(req.session.userId).select('role name');
        if (!user) {
            req.session.destroy(function() {});
            return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
        }
        // Sync session
        req.session.role = user.role;
        req.session.name = user.name;
        if (user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
}

// Staff only — reads role live from DB
async function isStaff(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'Please login to continue.' });
    }
    try {
        var user = await User.findById(req.session.userId).select('role name');
        if (!user) {
            req.session.destroy(function() {});
            return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
        }
        // Sync session
        req.session.role = user.role;
        req.session.name = user.name;
        if (user.role !== 'staff') {
            return res.status(403).json({ success: false, message: 'Access denied. Staff only.' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
}

module.exports = { isAuthenticated, isAdmin, isStaff };
