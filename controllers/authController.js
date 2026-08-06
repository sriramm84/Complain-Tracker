// controllers/authController.js

var mongoose = require('mongoose');
var User     = require('../models/User');


async function register(req, res) {
    try {
        var name            = (req.body.name            || '').trim();
        var email           = (req.body.email           || '').trim().toLowerCase();
        var phone           = (req.body.phone           || '').trim();
        var password        =  req.body.password        || '';
        var confirmPassword =  req.body.confirmPassword || '';

        if (!name || !email || !phone || !password || !confirmPassword)
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        if (name.length < 2)
            return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
        if (!/^[a-zA-Z\s]+$/.test(name))
            return res.status(400).json({ success: false, message: 'Name must contain only letters.' });
        if (!/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        if (!/^\d{10}$/.test(phone))
            return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        if (password !== confirmPassword)
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });

        // Check duplicate email (handles E11000 gracefully)
        var existing = await User.findOne({ email: email });
        if (existing)
            return res.status(400).json({ success: false, message: 'Email already registered.' });

        var user = await User.create({ name: name, email: email, phone: phone, password: password });

        req.session.userId = user._id;
        req.session.role   = user.role;
        req.session.name   = user.name;

        // FIX: save session before sending response to prevent race condition
        req.session.save(function(err) {
            if (err) {
                console.error('Session save error on register:', err.message);
                return res.status(500).json({ success: false, message: 'Session error. Please try logging in.' });
            }
            return res.status(201).json({
                success: true,
                message: 'Account created successfully.',
                user:    { id: user._id, name: user.name, role: user.role }
            });
        });
    } catch (err) {
        console.error('register error:', err.message);
        // Handle MongoDB duplicate key error
        if (err.code === 11000)
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        return res.status(500).json({ success: false, message: err.message || 'Registration failed.' });
    }
}


async function login(req, res) {
    try {
        var email    = (req.body.email    || '').trim().toLowerCase();
        var password =  req.body.password || '';

        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password are required.' });

        var user = await User.findOne({ email: email });
        if (!user)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        var ok = await user.comparePassword(password);
        if (!ok)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        req.session.userId = user._id;
        req.session.role   = user.role;   // always fresh from DB
        req.session.name   = user.name;

        // FIX: save session before sending response
        req.session.save(function(err) {
            if (err) {
                console.error('Session save error on login:', err.message);
                return res.status(500).json({ success: false, message: 'Session error. Please try again.' });
            }
            return res.json({
                success: true,
                message: 'Login successful.',
                user:    { id: user._id, name: user.name, role: user.role }
            });
        });
    } catch (err) {
        console.error('login error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


function logout(req, res) {
    req.session.destroy(function(err) {
        res.clearCookie('sessionId');
        if (err) {
            console.error('logout error:', err.message);
            return res.status(500).json({ success: false, message: 'Logout failed.' });
        }
        return res.json({ success: true, message: 'Logged out.' });
    });
}


async function getSession(req, res) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    try {
        // Always read fresh from DB so role changes take effect immediately
        var user = await User.findById(req.session.userId).select('name role email phone');
        if (!user) {
            req.session.destroy(function() {});
            return res.status(401).json({ success: false, message: 'Session expired. Please login.' });
        }
        // Sync session with DB
        req.session.role = user.role;
        req.session.name = user.name;
        return res.json({
            success: true,
            user: {
                id:    req.session.userId,
                name:  user.name,
                role:  user.role,
                email: user.email,
                phone: user.phone || ''
            }
        });
    } catch (err) {
        console.error('getSession error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
}


async function getProfile(req, res) {
    try {
        var user = await User.findById(req.session.userId).select('-password');
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found.' });
        return res.json({ success: true, user: user });
    } catch (err) {
        console.error('getProfile error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function updateProfile(req, res) {
    try {
        var name  = (req.body.name  || '').trim();
        var phone = (req.body.phone || '').trim();

        if (!name || name.length < 2)
            return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
        if (!/^[a-zA-Z\s]+$/.test(name))
            return res.status(400).json({ success: false, message: 'Name must contain only letters.' });
        if (!phone || !/^\d{10}$/.test(phone))
            return res.status(400).json({ success: false, message: 'Phone must be exactly 10 digits.' });

        // Email is NOT editable — never accept it from body
        var user = await User.findByIdAndUpdate(
            req.session.userId,
            { name: name, phone: phone },
            { new: true, runValidators: false }  // manual validation above
        ).select('-password');

        if (!user)
            return res.status(404).json({ success: false, message: 'User not found.' });

        req.session.name = user.name;
        return res.json({ success: true, message: 'Profile updated.', user: user });
    } catch (err) {
        console.error('updateProfile error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function changePassword(req, res) {
    try {
        var currentPassword = req.body.currentPassword || '';
        var newPassword     = req.body.newPassword     || '';
        var confirmNew      = req.body.confirmNew      || '';

        if (!currentPassword || !newPassword || !confirmNew)
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        if (newPassword.length < 6)
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
        if (newPassword !== confirmNew)
            return res.status(400).json({ success: false, message: 'New passwords do not match.' });

        var user = await User.findById(req.session.userId);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found.' });

        var ok = await user.comparePassword(currentPassword);
        if (!ok)
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

        user.password = newPassword;
        await user.save();
        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('changePassword error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}

module.exports = { register, login, logout, getSession, getProfile, updateProfile, changePassword };
