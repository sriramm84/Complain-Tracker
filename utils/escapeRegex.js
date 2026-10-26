// utils/escapeRegex.js
// Escapes user input so it is matched literally inside a MongoDB $regex / RegExp.
// Prevents errors on input like "(" and ReDoS via crafted patterns.

function escapeRegex(value) {
    return String(value == null ? '' : value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegex;
