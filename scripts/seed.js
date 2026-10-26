// scripts/seed.js — Creates the first admin account and default categories.
// Safe to re-run: existing admin / categories are left untouched.
//
// Usage: npm run seed
// Reads ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE and MONGO_URI from .env

require('dotenv').config();

var mongoose = require('mongoose');
var User     = require('../models/User');
var Category = require('../models/Category');

var MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/complaint-tracker';

var DEFAULT_CATEGORIES = [
    { name: 'Electrical',  description: 'Power outages, wiring, lighting, appliances' },
    { name: 'Plumbing',    description: 'Leaks, blockages, water supply' },
    { name: 'IT Support',  description: 'Network, hardware, software issues' },
    { name: 'Cleaning',    description: 'Housekeeping and sanitation' },
    { name: 'Maintenance', description: 'Furniture, doors, general repairs' },
    { name: 'Other',       description: 'Anything not covered above' }
];

async function seedAdmin() {
    var email    = (process.env.ADMIN_EMAIL    || '').trim().toLowerCase();
    var password =  process.env.ADMIN_PASSWORD || '';
    var name     = (process.env.ADMIN_NAME     || 'Administrator').trim();
    var phone    = (process.env.ADMIN_PHONE    || '').trim();

    if (!email || !password) {
        console.log('Skipping admin: set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create one.');
        return;
    }

    var existing = await User.findOne({ email: email });
    if (existing) {
        if (existing.role !== 'admin') {
            existing.role = 'admin';
            await existing.save();
            console.log('Promoted existing user ' + email + ' to admin.');
        } else {
            console.log('Admin ' + email + ' already exists.');
        }
        return;
    }

    await User.create({ name: name, email: email, phone: phone, password: password, role: 'admin' });
    console.log('Created admin ' + email + '.');
}

async function seedCategories() {
    var added = 0;
    for (var i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        var c  = DEFAULT_CATEGORIES[i];
        var ex = await Category.findOne({ name: c.name });
        if (!ex) { await Category.create(c); added++; }
    }
    console.log('Categories: ' + added + ' added, ' + (DEFAULT_CATEGORIES.length - added) + ' already present.');
}

mongoose.connect(MONGO_URI)
    .then(seedAdmin)
    .then(seedCategories)
    .then(function() { return mongoose.disconnect(); })
    .catch(function(err) {
        console.error('Seed failed:', err.message);
        process.exit(1);
    });
