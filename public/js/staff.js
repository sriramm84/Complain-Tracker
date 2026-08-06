// staff.js — Staff Portal (Vanilla JS)

var currentComplaintId = null;

// ── PAGE LOAD ─────────────────────────────────────────────────
// Server already verified staff role before serving this page.
// Fetch session to get staff name and kick off data load.
window.addEventListener('DOMContentLoaded', function() {
    fetch('/api/auth/session')
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data.success) {
            // Session expired after server render — redirect to login
            window.location.href = '/login';
            return;
        }
        document.getElementById('staffName').textContent = data.user.name;
        loadComplaints();
    })
    .catch(function() { window.location.href = '/login'; });
});


// ── LOAD COMPLAINTS ───────────────────────────────────────────
function loadComplaints() {
    var params    = new URLSearchParams();
    var search    = (document.getElementById('searchInput') || {}).value || '';
    var status    = (document.getElementById('statusFilter') || {}).value || 'All';
    var priority  = (document.getElementById('priorityFilter') || {}).value || 'All';

    if (search.trim())    params.set('search',   search.trim());
    if (status !== 'All') params.set('status',   status);
    if (priority !== 'All') params.set('priority', priority);

    var list = document.getElementById('complaintsList');
    list.innerHTML = '<div class="text-center py-4" style="color:#9ca3af;"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</div>';

    fetch('/api/staff/complaints?' + params.toString())
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data.success) {
            list.innerHTML = '<div class="text-center py-4" style="color:#dc2626;">Failed to load complaints: ' + esc(data.message) + '</div>';
            return;
        }
        renderStats(data.complaints);
        renderComplaints(data.complaints);
    })
    .catch(function() {
        list.innerHTML = '<div class="text-center py-4" style="color:#dc2626;">Server error. Please refresh.</div>';
    });
}


// ── RENDER STATS ──────────────────────────────────────────────
function renderStats(list) {
    var counts = { 'Assigned': 0, 'In Progress': 0, 'Resolved': 0 };
    list.forEach(function(c) { if (counts[c.status] !== undefined) counts[c.status]++; });
    document.getElementById('statsRow').innerHTML =
        sCard(list.length, 'Total')          +
        sCard(counts['Assigned'],    'Assigned')    +
        sCard(counts['In Progress'], 'In Progress') +
        sCard(counts['Resolved'],    'Resolved');
}

function sCard(val, label) {
    return '<div class="col-6 col-md-3">' +
           '<div class="stat-card"><div class="stat-val">' + val +
           '</div><div class="stat-label">' + label + '</div></div></div>';
}


// ── RENDER COMPLAINT CARDS ────────────────────────────────────
function renderComplaints(list) {
    var el = document.getElementById('complaintsList');
    if (!list || list.length === 0) {
        el.innerHTML = '<div class="text-center py-5" style="color:#9ca3af;font-size:0.82rem;">No complaints assigned to you.</div>';
        return;
    }

    var html = '';
    list.forEach(function(c) {
        var catName  = c.category ? esc(c.category.name) : '';
        var userName = c.submittedBy ? esc(c.submittedBy.name) : '';
        var userPhone = c.submittedBy && c.submittedBy.phone ? esc(c.submittedBy.phone) : '';

        html += '<div class="complaint-card"><div style="padding:14px 16px;">' +

            // Header
            '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-1">' +
            '<div>' +
            '<div style="font-size:0.84rem;font-weight:600;">' +
            '<span style="color:#1e3a5f;font-size:0.73rem;font-weight:700;background:#eff6ff;' +
            'padding:2px 7px;border-radius:3px;border:1px solid #bfdbfe;margin-right:8px;">' +
            esc(c.complaintId || 'N/A') + '</span>' + esc(c.title) +
            '</div>' +
            '<div class="meta-text mt-1">' + catName + ' &bull; ' + fmtDate(c.createdAt) + '</div>' +
            '</div>' +
            '<div class="d-flex gap-1">' + sBadge(c.status) + ' ' + pBadge(c.priority) + '</div>' +
            '</div>' +

            // Description (truncated)
            '<p style="font-size:0.8rem;color:#6b7280;margin:6px 0 8px;">' +
            esc(c.description).substring(0, 200) + (c.description.length > 200 ? '...' : '') + '</p>' +

            // Client info — prominently shown to staff
            '<div style="font-size:0.78rem;background:#f0fdf4;border-left:3px solid #16a34a;' +
            'padding:7px 10px;border-radius:0 4px 4px 0;margin-bottom:8px;">' +
            'Client: <strong>' + userName + '</strong>' +
            (userPhone ? ' &nbsp;&bull;&nbsp; Phone: <strong>' + userPhone + '</strong>' : '') +
            '</div>' +

            // Footer
            '<div class="d-flex justify-content-between align-items-center">' +
            '<span class="meta-text">Submitted: ' + fmtDate(c.createdAt) + '</span>' +
            '<button class="btn btn-outline-secondary btn-sm" onclick="openDetail(\'' + c._id + '\')">View / Update</button>' +
            '</div>' +
            '</div></div>';
    });
    el.innerHTML = html;
}


// ── OPEN DETAIL MODAL ─────────────────────────────────────────
function openDetail(id) {
    currentComplaintId = id;
    document.getElementById('modalBody').innerHTML =
        '<div class="text-center py-3"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</div>';
    document.getElementById('statusMsg').textContent = '';
    document.getElementById('newStatus').value      = '';
    document.getElementById('statusNote').value     = '';

    new bootstrap.Modal(document.getElementById('detailModal')).show();

    fetch('/api/staff/complaints/' + id)
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data.success) {
            document.getElementById('modalBody').innerHTML = '<p style="color:#dc2626;">' + esc(data.message) + '</p>';
            return;
        }
        var c = data.complaint;
        document.getElementById('modalTitle').textContent = '[' + esc(c.complaintId || 'N/A') + '] ' + c.title;

        // Build timeline
        var timeline = '';
        if (c.statusHistory && c.statusHistory.length > 0) {
            timeline = '<div style="margin-top:16px;">' +
                '<div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;' +
                'color:#9ca3af;margin-bottom:8px;">Status History</div>' +
                '<div class="timeline">';
            c.statusHistory.forEach(function(h) {
                timeline +=
                    '<div class="timeline-item"><div class="timeline-dot"></div>' +
                    '<div class="timeline-text"><strong>' + esc(h.status) + '</strong>' +
                    ' <span style="color:#9ca3af;">by ' + esc(h.changedBy || 'System') +
                    (h.changedByRole ? ' <span style="font-size:0.68rem;background:#f3f4f6;padding:1px 5px;' +
                    'border-radius:3px;text-transform:uppercase;">' + h.changedByRole + '</span>' : '') +
                    '</span></div>' +
                    (h.note ? '<div style="font-size:0.73rem;color:#9ca3af;font-style:italic;">' + esc(h.note) + '</div>' : '') +
                    '<div class="timeline-date">' + fmtDate(h.date) + '</div>' +
                    '</div>';
            });
            timeline += '</div></div>';
        }

        var attach = c.attachment
            ? '<div style="font-size:0.78rem;margin-top:8px;">Attachment: ' +
              '<a href="' + c.attachment + '" target="_blank" style="color:#2563eb;">View file</a></div>'
            : '';

        document.getElementById('modalBody').innerHTML =
            '<table class="table table-sm table-bordered mb-0" style="font-size:0.8rem;">' +
            '<tr><td class="fw-semibold" style="width:140px;background:#f9fafb;">Complaint ID</td>' +
            '<td><strong style="color:#1e3a5f;">' + esc(c.complaintId || 'N/A') + '</strong></td></tr>' +
            '<tr><td class="fw-semibold" style="background:#f9fafb;">Category</td>' +
            '<td>' + (c.category ? esc(c.category.name) : '') + '</td></tr>' +
            '<tr><td class="fw-semibold" style="background:#f9fafb;">Priority</td>' +
            '<td>' + pBadge(c.priority) + '</td></tr>' +
            '<tr><td class="fw-semibold" style="background:#f9fafb;">Status</td>' +
            '<td>' + sBadge(c.status) + '</td></tr>' +
            '<tr style="background:#f0fdf4;"><td class="fw-semibold">Client Name</td>' +
            '<td><strong>' + (c.submittedBy ? esc(c.submittedBy.name) : '') + '</strong></td></tr>' +
            '<tr style="background:#f0fdf4;"><td class="fw-semibold">Client Phone</td>' +
            '<td><strong>' + (c.submittedBy && c.submittedBy.phone ? esc(c.submittedBy.phone) : '<span style="color:#9ca3af;">Not provided</span>') + '</strong></td></tr>' +
            '<tr style="background:#f0fdf4;"><td class="fw-semibold">Client Email</td>' +
            '<td>' + (c.submittedBy ? esc(c.submittedBy.email) : '') + '</td></tr>' +
            '<tr><td class="fw-semibold" style="background:#f9fafb;">Description</td>' +
            '<td style="white-space:pre-wrap;">' + esc(c.description) + '</td></tr>' +
            '</table>' + attach + timeline;

        // Hide update form for terminal statuses — no further action possible
        var terminalStatuses = ['Closed', 'Resolved', 'Rejected'];
        var updateForm      = document.getElementById('statusUpdateForm');
        var terminalMsg     = document.getElementById('terminalStatusMsg');
        var terminalClose   = document.getElementById('terminalCloseBtn');
        if (terminalStatuses.indexOf(c.status) !== -1) {
            if (updateForm)    updateForm.style.display    = 'none';
            if (terminalClose) terminalClose.style.display = 'block';
            if (terminalMsg) {
                var msgMap = {
                    'Closed':   '✓ This case is closed. No further updates can be made.',
                    'Resolved': '✓ Marked as resolved. Awaiting admin confirmation.',
                    'Rejected': '✗ This complaint has been rejected by admin.'
                };
                terminalMsg.textContent   = msgMap[c.status] || '';
                terminalMsg.style.display = 'block';
                var colourMap = { 'Closed':'#16a34a', 'Resolved':'#2563eb', 'Rejected':'#dc2626' };
                terminalMsg.style.color   = colourMap[c.status] || '#374151';
            }
        } else {
            if (updateForm)    updateForm.style.display    = 'block';
            if (terminalClose) terminalClose.style.display = 'none';
            if (terminalMsg)   terminalMsg.style.display   = 'none';
        }
    })
    .catch(function() {
        document.getElementById('modalBody').innerHTML = '<p style="color:#dc2626;">Failed to load complaint details.</p>';
    });
}


// ── UPDATE STATUS ─────────────────────────────────────────────
function updateStatus() {
    var status = document.getElementById('newStatus').value;
    var note   = document.getElementById('statusNote').value.trim();
    var msgEl  = document.getElementById('statusMsg');

    msgEl.textContent = '';
    msgEl.style.color = '';

    if (!status) {
        msgEl.textContent = 'Please select a status to update.';
        msgEl.style.color = '#dc2626';
        return;
    }

    var btn = document.querySelector('#detailModal .modal-footer .btn-primary');
    btn.disabled    = true;
    btn.textContent = 'Updating...';

    fetch('/api/staff/complaints/' + currentComplaintId + '/status', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: status, note: note })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        btn.disabled    = false;
        btn.textContent = 'Update Status';

        if (data.success) {
            msgEl.textContent = 'Status updated to "' + status + '" successfully.';
            msgEl.style.color = '#16a34a';
            document.getElementById('newStatus').value  = '';
            document.getElementById('statusNote').value = '';
            loadComplaints();  // refresh the list
            // Auto-close modal after short delay
            setTimeout(function() {
                var m = bootstrap.Modal.getInstance(document.getElementById('detailModal'));
                if (m) m.hide();
            }, 1500);
        } else {
            msgEl.textContent = data.message;
            msgEl.style.color = '#dc2626';
        }
    })
    .catch(function() {
        btn.disabled    = false;
        btn.textContent = 'Update Status';
        msgEl.textContent = 'Server error. Please try again.';
        msgEl.style.color = '#dc2626';
    });
}


// ── LOGOUT ────────────────────────────────────────────────────
function staffLogout() {
    fetch('/api/auth/logout', { method: 'POST' })
    .then(function() { window.location.href = '/login'; });
}


// ── HELPERS ───────────────────────────────────────────────────
function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    return dt.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function sBadge(s) {
    var m = {
        'Submitted':    'badge-status-pending',
        'Under Review': 'badge-status-assigned',
        'Assigned':     'badge-status-assigned',
        'In Progress':  'badge-status-inprogress',
        'Resolved':     'badge-status-resolved',
        'Closed':       'badge-status-resolved',
        'Rejected':     'badge-status-rejected'
    };
    return '<span class="badge ' + (m[s] || '') + '">' + esc(s) + '</span>';
}

function pBadge(p) {
    var m = {
        'High':   'badge-priority-high',
        'Medium': 'badge-priority-medium',
        'Low':    'badge-priority-low'
    };
    return '<span class="badge ' + (m[p] || '') + '">' + esc(p) + '</span>';
}
