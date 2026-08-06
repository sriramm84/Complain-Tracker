// config/mailer.js — Professional HTML email templates with null-safe helpers

var nodemailer = require('nodemailer');

var isMailConfigured = Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
var transporter = isMailConfigured
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    })
    : null;

async function deliver(mailOptions) {
    if (!isMailConfigured || !transporter) {
        throw new Error('Email service is not configured. Set MAIL_USER and MAIL_PASS.');
    }
    return transporter.sendMail(mailOptions);
}

// ── Null-safe helpers ─────────────────────────────────────────
function safe(v)   { return v || ''; }
function cid(c)    { return c.complaintId || c._id || 'N/A'; }
function phone(u)  { return (u && u.phone) ? u.phone : 'Not provided'; }

// ── Shared HTML wrapper ───────────────────────────────────────
function wrap(bodyHtml) {
    return '<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
        + '<div style="background:#1e3a5f;padding:28px 32px;text-align:center;">'
        + '<h1 style="color:#ffffff;margin:0;font-size:1.6rem;letter-spacing:1px;">ComplainX</h1>'
        + '<p style="color:#93c5fd;margin:4px 0 0;font-size:0.82rem;">Complaint Management System</p>'
        + '</div>'
        + '<div style="padding:32px 36px;background:#ffffff;">' + bodyHtml + '</div>'
        + '<div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">'
        + '<p style="color:#9ca3af;font-size:0.75rem;margin:0;">This is an automated message from <strong>ComplainX Support Team</strong>.<br/>Please do not reply directly to this email.</p>'
        + '<p style="color:#9ca3af;font-size:0.72rem;margin:8px 0 0;">&copy; ' + new Date().getFullYear() + ' ComplainX. All rights reserved.</p>'
        + '</div></div>';
}

// ── Shared table row ──────────────────────────────────────────
function row(label, value, shade) {
    var bg = shade ? 'background:#f9fafb;' : '';
    return '<tr style="' + bg + '">'
        + '<td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;width:38%;">' + label + '</td>'
        + '<td style="padding:10px 14px;border:1px solid #e5e7eb;color:#111827;">' + (value || '&mdash;') + '</td>'
        + '</tr>';
}

// ── 1. COMPLAINT CONFIRMATION ─────────────────────────────────
async function sendComplaintConfirmation(toEmail, userName, complaint) {
    var catName = (complaint.category && complaint.category.name) ? complaint.category.name : '';
    var id = cid(complaint);

    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(userName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px;">Thank you for reaching out. Your complaint has been received.</p>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Complaint ID', '<strong style="color:#1e3a5f;">' + id + '</strong>', true)
        + row('Title', safe(complaint.title))
        + row('Category', safe(catName), true)
        + row('Priority', safe(complaint.priority))
        + row('Status', 'Submitted', true)
        + '</table>'
        + '<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:20px;">'
        + '<p style="margin:0;color:#1e40af;font-size:0.88rem;"><strong>What happens next?</strong><br/>'
        + 'Our team will review your complaint and assign a staff member shortly.</p></div>'
        + '<p style="color:#6b7280;font-size:0.85rem;">Regards,<br/><strong>ComplainX Support Team</strong></p>';

    await deliver({
        from:    '"ComplainX Support" <' + process.env.MAIL_USER + '>',
        to:      toEmail,
        subject: '[' + id + '] Complaint Received — ' + safe(complaint.title),
        html:    wrap(body)
    });
}

// ── 2. ASSIGNMENT TO USER ─────────────────────────────────────
async function sendAssignmentToUser(toEmail, userName, complaint, staffMember) {
    var id = cid(complaint);
    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(userName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px;">Your complaint has been assigned to a staff member who will contact you shortly.</p>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Complaint ID', '<strong style="color:#1e3a5f;">' + id + '</strong>', true)
        + row('Complaint Title', safe(complaint.title))
        + row('Status', 'Assigned', true)
        + row('Assigned Staff', '<strong>' + safe(staffMember.name) + '</strong>')
        + row('Staff Contact', phone(staffMember), true)
        + row('Staff Email', safe(staffMember.email))
        + '</table>'
        + '<div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:20px;">'
        + '<p style="margin:0;color:#166534;font-size:0.88rem;">'
        + safe(staffMember.name) + ' will review your complaint and reach out to you. Please keep your phone accessible.</p></div>'
        + '<p style="color:#6b7280;font-size:0.85rem;">Regards,<br/><strong>ComplainX Support Team</strong></p>';

    await deliver({
        from:    '"ComplainX Support" <' + process.env.MAIL_USER + '>',
        to:      toEmail,
        subject: '[' + id + '] Complaint Assigned — Action in Progress',
        html:    wrap(body)
    });
}

// ── 3. ASSIGNMENT TO STAFF ────────────────────────────────────
async function sendAssignmentToStaff(toEmail, staffName, complaint, user) {
    var id = cid(complaint);
    var catName = (complaint.category && complaint.category.name) ? complaint.category.name : '';
    var priorityColour = complaint.priority === 'High' ? '#dc2626' : complaint.priority === 'Medium' ? '#d97706' : '#374151';

    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(staffName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px;">A new complaint has been assigned to you. Please review and take action.</p>'
        + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px 18px;margin-bottom:20px;">'
        + '<p style="margin:0;color:#1e40af;font-size:0.9rem;font-weight:600;">Complaint ID: ' + id + '</p></div>'
        + '<h3 style="color:#374151;font-size:0.95rem;margin-bottom:10px;">Complaint Details</h3>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Title', safe(complaint.title), true)
        + row('Category', safe(catName))
        + row('Priority', '<strong style="color:' + priorityColour + ';">' + safe(complaint.priority) + '</strong>', true)
        + row('Description', safe(complaint.description))
        + '</table>'
        + '<h3 style="color:#374151;font-size:0.95rem;margin-bottom:10px;">Client Information</h3>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Client Name', '<strong>' + safe(user.name) + '</strong>', true)
        + row('Phone Number', phone(user))
        + row('Email', safe(user.email), true)
        + '</table>'
        + '<div style="background:#fefce8;border-left:4px solid #d97706;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:20px;">'
        + '<p style="margin:0;color:#92400e;font-size:0.88rem;"><strong>Action Required:</strong> Contact the client and update the status to "In Progress" when you begin, and "Resolved" when done.</p></div>'
        + '<p style="color:#6b7280;font-size:0.85rem;">Regards,<br/><strong>ComplainX Support Team</strong></p>';

    await deliver({
        from:    '"ComplainX Support" <' + process.env.MAIL_USER + '>',
        to:      toEmail,
        subject: '[' + id + '] New Complaint Assigned — Action Required',
        html:    wrap(body)
    });
}

// ── 4. STATUS UPDATE TO USER ──────────────────────────────────
async function sendStatusUpdate(toEmail, userName, complaint) {
    var id = cid(complaint);
    var statusColour = { 'Under Review':'#2563eb','Assigned':'#16a34a','In Progress':'#d97706','Resolved':'#16a34a','Closed':'#374151','Rejected':'#dc2626' };
    var colour = statusColour[complaint.status] || '#374151';

    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(userName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px;">There has been an update on your complaint.</p>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Complaint ID', '<strong style="color:#1e3a5f;">' + id + '</strong>', true)
        + row('Title', safe(complaint.title))
        + row('New Status', '<strong style="color:' + colour + ';">' + safe(complaint.status) + '</strong>', true)
        + '</table>'
        + (complaint.adminNote
            ? '<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:20px;">'
            + '<p style="margin:0 0 4px;font-weight:600;color:#1e40af;">Message from Support Team:</p>'
            + '<p style="margin:0;color:#374151;">' + safe(complaint.adminNote) + '</p></div>'
            : '')
        + '<p style="color:#6b7280;font-size:0.85rem;">Regards,<br/><strong>ComplainX Support Team</strong></p>';

    await deliver({
        from:    '"ComplainX Support" <' + process.env.MAIL_USER + '>',
        to:      toEmail,
        subject: '[' + id + '] Status Update — ' + safe(complaint.status),
        html:    wrap(body)
    });
}

// ── 6. RESOLUTION CONFIRMATION ────────────────────────────────
async function sendResolutionConfirmation(toEmail, userName, complaint) {
    var id = cid(complaint);
    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(userName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px;">We are pleased to inform you that your complaint has been <strong>resolved successfully</strong>.</p>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Complaint ID', '<strong style="color:#1e3a5f;">' + id + '</strong>', true)
        + row('Title', safe(complaint.title))
        + row('Final Status', '<strong style="color:#16a34a;">Closed</strong>', true)
        + '</table>'
        + '<div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:18px 20px;border-radius:0 6px 6px 0;margin-bottom:24px;">'
        + '<p style="margin:0;color:#166534;font-size:0.92rem;">Your complaint has been reviewed, resolved, and officially closed by our support team.</p></div>'
        + '<p style="color:#6b7280;font-size:0.85rem;">Thank you for using ComplainX.<br/><br/>Regards,<br/><strong>ComplainX Support Team</strong></p>';

    await deliver({
        from:    '"ComplainX Support" <' + process.env.MAIL_USER + '>',
        to:      toEmail,
        subject: '[' + id + '] Complaint Resolved — Case Closed',
        html:    wrap(body)
    });
}

// ── 7. COMPLETION ALERT TO ADMIN ──────────────────────────────
async function sendCompletionAlertToAdmin(adminEmail, adminName, complaint, staffMember) {
    var id = cid(complaint);
    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(adminName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px;">A staff member has marked a complaint as <strong>Resolved</strong>. Please review and confirm.</p>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        + row('Complaint ID', '<strong style="color:#1e3a5f;">' + id + '</strong>', true)
        + row('Title', safe(complaint.title))
        + row('Resolved By', '<strong>' + safe(staffMember.name) + '</strong>', true)
        + row('Staff Email', safe(staffMember.email))
        + row('Resolved At', new Date().toLocaleString('en-IN'), true)
        + '</table>'
        + '<div style="background:#fefce8;border-left:4px solid #d97706;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:20px;">'
        + '<p style="margin:0;color:#92400e;font-size:0.88rem;"><strong>Action Required:</strong> Log in to the admin panel, review this complaint, and click "Confirm" to close it and notify the user.</p></div>'
        + '<p style="color:#6b7280;font-size:0.85rem;">Regards,<br/><strong>ComplainX System</strong></p>';

    await deliver({
        from:    '"ComplainX System" <' + process.env.MAIL_USER + '>',
        to:      adminEmail,
        subject: '[' + id + '] Action Required — Staff Marked Complaint Resolved',
        html:    wrap(body)
    });
}

// ── 8. OTP EMAIL ──────────────────────────────────────────────
async function sendOtpEmail(toEmail, userName, otp) {
    var body = '<h2 style="color:#111827;margin-bottom:4px;">Hello, ' + safe(userName) + '</h2>'
        + '<p style="color:#6b7280;margin-bottom:28px;">You have requested to edit your complaint. Use the OTP below to verify your identity.</p>'
        + '<div style="text-align:center;margin:28px 0;">'
        + '<div style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:8px;padding:20px 40px;">'
        + '<div style="font-size:2.2rem;font-weight:700;letter-spacing:14px;color:#1e3a5f;">' + safe(otp) + '</div>'
        + '</div></div>'
        + '<p style="text-align:center;color:#dc2626;font-weight:600;font-size:0.88rem;margin-bottom:20px;">This OTP is valid for 2 minutes only.</p>'
        + '<p style="color:#9ca3af;font-size:0.78rem;">If you did not request this, please ignore this email.<br/><br/>Regards,<br/><strong>ComplainX Support Team</strong></p>';

    await deliver({
        from:    '"ComplainX Support" <' + process.env.MAIL_USER + '>',
        to:      toEmail,
        subject: 'Your Verification OTP — ComplainX',
        html:    wrap(body)
    });
}

module.exports = {
    isMailConfigured: isMailConfigured,
    sendComplaintConfirmation: sendComplaintConfirmation,
    sendAssignmentToUser: sendAssignmentToUser,
    sendAssignmentToStaff: sendAssignmentToStaff,
    sendStatusUpdate: sendStatusUpdate,
    sendResolutionConfirmation: sendResolutionConfirmation,
    sendCompletionAlertToAdmin: sendCompletionAlertToAdmin,
    sendOtpEmail: sendOtpEmail
};
