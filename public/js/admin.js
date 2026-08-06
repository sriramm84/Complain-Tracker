// admin.js — Admin Dashboard

angular.module('adminApp', [])
.controller('AdminCtrl', function($scope, $http) {

    $scope.adminName      = '';
    $scope.currentAdminId = null;
    $scope.activeTab      = 'complaints';
    $scope.currentAdminId = null;

    $scope.complaints        = [];
    $scope.staffList         = [];
    $scope.statCards         = [];
    $scope.users             = [];
    $scope.categories        = [];
    $scope.logs              = [];
    $scope.loadingComplaints = false;
    $scope.loadingLogs       = false;
    $scope.loadingUsers      = false;

    $scope.statusOptions      = ['Submitted','Under Review','Assigned','In Progress','Resolved','Closed','Rejected'];
    $scope.adminStatusOptions = ['Under Review','Rejected']; // 'Assigned' removed — use section 3 Assign button instead

    $scope.filterSearch      = '';
    $scope.filterStatus      = '';
    $scope.filterCategory    = '';
    $scope.filterPriority    = '';
    $scope.filterDateFrom    = '';
    $scope.filterDateTo      = '';
    $scope.filterComplaintId = '';
    $scope.filterUserName    = '';
    $scope.filterStaffName   = '';

    $scope.logFilterStatus   = '';
    $scope.logFilterDateFrom = '';
    $scope.logFilterDateTo   = '';

    $scope.userSearch     = '';
    $scope.userRoleFilter = '';

    $scope.newCatName  = '';
    $scope.newCatDesc  = '';
    $scope.catMsg      = '';
    $scope.catErr      = '';
    $scope.showFilters = false; // advanced filter drawer — hidden by default


    // ── SESSION INIT ───────────────────────────────────────────
    // Server already verified admin role before serving this page.
    // Fetch session to get name/id and kick off data load.
    $http.get('/api/auth/session').then(function(res) {
        if (!res.data.success) {
            // Session expired — server guard missed it; redirect to login
            window.location.href = '/login';
            return;
        }
        $scope.adminName      = res.data.user.name;
        $scope.currentAdminId = res.data.user.id;
        $scope.init();
    }).catch(function() { window.location.href = '/login'; });



    $scope.init = function() {
        $scope.loadStats();
        $scope.loadComplaints();
        $scope.loadStaff();
        $scope.loadUsers();
        $scope.loadCategories();
        $scope.loadLogs();
    };

    $scope.switchTab = function(tab) {
        $scope.activeTab = tab;
        if (tab === 'tracking')   $scope.loadLogs();
        if (tab === 'users')      $scope.loadUsers();
        if (tab === 'categories') $scope.loadCategories();
    };


    // ── STATS ──────────────────────────────────────────────────
    $scope.loadStats = function() {
        $http.get('/api/admin/stats').then(function(res) {
            if (!res.data.success) return;
            var s = res.data.stats;
            $scope.statCards = [
                { val: s.total,       label: 'Total'        },
                { val: s.submitted,   label: 'Submitted'    },
                { val: s.underReview, label: 'Under Review' },
                { val: s.assigned,    label: 'Assigned'     },
                { val: s.inProgress,  label: 'In Progress'  },
                { val: s.resolved,    label: 'Resolved'     },
                { val: s.closed,      label: 'Closed'       }
            ];
        });
    };


    $scope.loadStaff = function() {
        $http.get('/api/admin/staff').then(function(res) {
            if (res.data.success) $scope.staffList = res.data.staff;
        });
    };

    $scope.loadCategories = function() {
        $http.get('/api/admin/categories').then(function(res) {
            if (res.data.success) $scope.categories = res.data.categories;
        });
    };


    // ── LOAD COMPLAINTS ────────────────────────────────────────
    $scope.loadComplaints = function() {
        $scope.loadingComplaints = true;
        var p = [];
        if ($scope.filterSearch.trim())      p.push('search='      + encodeURIComponent($scope.filterSearch.trim()));
        if ($scope.filterComplaintId.trim()) p.push('complaintId=' + encodeURIComponent($scope.filterComplaintId.trim()));
        if ($scope.filterUserName.trim())    p.push('userName='    + encodeURIComponent($scope.filterUserName.trim()));
        if ($scope.filterStaffName.trim())   p.push('staffName='   + encodeURIComponent($scope.filterStaffName.trim()));
        if ($scope.filterStatus)             p.push('status='      + encodeURIComponent($scope.filterStatus));
        if ($scope.filterCategory)           p.push('category='    + encodeURIComponent(String($scope.filterCategory)));
        if ($scope.filterPriority)           p.push('priority='    + encodeURIComponent($scope.filterPriority));
        if ($scope.filterDateFrom)           p.push('dateFrom='    + encodeURIComponent($scope.filterDateFrom));
        if ($scope.filterDateTo)             p.push('dateTo='      + encodeURIComponent($scope.filterDateTo));
        var qs = p.length > 0 ? '?' + p.join('&') : '';

        $http.get('/api/admin/complaints' + qs)
        .then(function(res) {
            $scope.loadingComplaints = false;
            $scope.complaints = (res.data.complaints || []).map(function(c) {
                c._newStatus     = '';
                c._newNote       = c.adminNote || '';
                c._assignStaffId = (c.assignedTo && c.assignedTo._id) ? c.assignedTo._id : '';
                c._updateMsg     = '';
                c._updateErr     = false;
                c.showTimeline   = false;
                return c;
            });
        })
        .catch(function() { $scope.loadingComplaints = false; });
    };

    $scope.clearFilters = function() {
        $scope.filterSearch = $scope.filterStatus = $scope.filterCategory = '';
        $scope.filterPriority = $scope.filterDateFrom = $scope.filterDateTo = '';
        $scope.filterComplaintId = $scope.filterUserName = $scope.filterStaffName = '';
        $scope.loadComplaints();
    };


    // ── UPDATE COMPLAINT ───────────────────────────────────────
    $scope.updateComplaint = function(c) {
        var payload = {};
        if (c._newStatus)                         payload.status    = c._newStatus;
        if (typeof c._newNote === 'string')        payload.adminNote = c._newNote;

        if (!payload.status && typeof payload.adminNote === 'undefined') {
            c._updateErr = false;
            c._updateMsg = 'Select a new status or add a note first.';
            setTimeout(function() { $scope.$apply(function() { c._updateMsg = ''; }); }, 3000);
            return;
        }

        $http.put('/api/admin/complaints/' + c._id, payload)
        .then(function(res) {
            c._updateErr = !res.data.success;
            c._updateMsg = res.data.success ? 'Updated successfully.' : res.data.message;
            if (res.data.success) {
                if (payload.status)    c.status    = payload.status;
                if (payload.adminNote !== undefined) c.adminNote = payload.adminNote;
                c.statusHistory = res.data.complaint.statusHistory;
                c._newStatus = '';
                $scope.loadStats();
            }
            setTimeout(function() { $scope.$apply(function() { c._updateMsg = ''; }); }, 4000);
        })
        .catch(function(err) { c._updateErr = true; c._updateMsg = (err && err.data && err.data.message) ? err.data.message : 'Server error. Please try again.'; });
    };


    // ── ASSIGN TO STAFF ────────────────────────────────────────
    $scope.assignComplaint = function(c) {
        if (!c._assignStaffId) {
            c._updateErr = true;
            c._updateMsg = 'Please select a staff member first.';
            setTimeout(function() { $scope.$apply(function() { c._updateMsg = ''; }); }, 3000);
            return;
        }
        $http.post('/api/admin/complaints/' + c._id + '/assign', { staffId: c._assignStaffId })
        .then(function(res) {
            c._updateErr = !res.data.success;
            c._updateMsg = res.data.success
                ? 'Assigned to ' + (res.data.complaint.assignedTo ? res.data.complaint.assignedTo.name : '') + '. Emails sent.'
                : res.data.message;
            if (res.data.success) {
                c.status        = 'Assigned';
                c.statusHistory = res.data.complaint.statusHistory;
                c.assignedTo    = res.data.complaint.assignedTo;
                c.assignedAt    = res.data.complaint.assignedAt;
                $scope.loadStats();
                $scope.loadLogs();
            }
            setTimeout(function() { $scope.$apply(function() { c._updateMsg = ''; }); }, 5000);
        })
        .catch(function(err) { c._updateErr = true; c._updateMsg = (err && err.data && err.data.message) ? err.data.message : 'Server error. Please try again.'; });
    };


    // ── CONFIRM RESOLUTION ─────────────────────────────────────
    $scope.confirmResolution = function(c) {
        if (!confirm('Confirm resolution of ' + (c.complaintId || 'this complaint') + '?\nThis will close the case and notify the user.')) return;
        $http.post('/api/admin/complaints/' + c._id + '/confirm-resolution', {})
        .then(function(res) {
            c._updateErr = !res.data.success;
            c._updateMsg = res.data.success ? 'Confirmed. User notified. Case closed.' : res.data.message;
            if (res.data.success) {
                c.status        = 'Closed';
                c.statusHistory = res.data.complaint.statusHistory;
                $scope.loadStats();
                $scope.loadLogs();
            }
            setTimeout(function() { $scope.$apply(function() { c._updateMsg = ''; }); }, 4000);
        })
        .catch(function(err) { c._updateErr = true; c._updateMsg = (err && err.data && err.data.message) ? err.data.message : 'Server error.'; });
    };


    // ── DELETE COMPLAINT ───────────────────────────────────────
    $scope.deleteComplaint = function(id, idx) {
        if (!confirm('Permanently delete this complaint? This cannot be undone.')) return;
        $http.delete('/api/admin/complaints/' + id)
        .then(function(res) {
            if (res.data.success) { $scope.complaints.splice(idx, 1); $scope.loadStats(); }
            else alert(res.data.message);
        });
    };


    // ── EXPORT CSV ─────────────────────────────────────────────
    $scope.exportCSV = function() {
        var p = [];
        if ($scope.filterStatus)   p.push('status='   + encodeURIComponent($scope.filterStatus));
        if ($scope.filterCategory) p.push('category=' + encodeURIComponent(String($scope.filterCategory)));
        if ($scope.filterPriority) p.push('priority=' + encodeURIComponent($scope.filterPriority));
        window.location.href = '/api/admin/export-csv' + (p.length ? '?' + p.join('&') : '');
    };


    // ── ASSIGNMENT LOGS ────────────────────────────────────────
    $scope.loadLogs = function() {
        $scope.loadingLogs = true;
        var p = [];
        if ($scope.logFilterStatus)   p.push('status='   + encodeURIComponent($scope.logFilterStatus));
        if ($scope.logFilterDateFrom) p.push('dateFrom=' + encodeURIComponent($scope.logFilterDateFrom));
        if ($scope.logFilterDateTo)   p.push('dateTo='   + encodeURIComponent($scope.logFilterDateTo));
        $http.get('/api/admin/assignment-logs' + (p.length ? '?' + p.join('&') : ''))
        .then(function(res) {
            $scope.loadingLogs = false;
            $scope.logs = res.data.logs || [];
        })
        .catch(function() { $scope.loadingLogs = false; });
    };


    // ── LOAD USERS ─────────────────────────────────────────────
    $scope.loadUsers = function() {
        $scope.loadingUsers = true;
        $http.get('/api/admin/users')
        .then(function(res) {
            $scope.loadingUsers = false;
            if (res.data.success) {
                // FIX: _pendingRole is the dropdown value (starts empty = "no change")
                // _newRole is just a display tracker for what to send
                $scope.users = res.data.users.map(function(u) {
                    u._pendingRole = '';   // empty = no selection yet
                    u._roleMsg     = '';
                    u._roleErr     = false;
                    return u;
                });
            }
        })
        .catch(function() { $scope.loadingUsers = false; });
    };

    // AngularJS: use $watch instead of function-in-template to avoid infinite $digest
    $scope.filteredUsersList = [];

    function rebuildFilteredUsers() {
        $scope.filteredUsersList = $scope.users.filter(function(u) {
            var kw = ($scope.userSearch || '').trim().toLowerCase();
            var sm = !kw ||
                     u.name.toLowerCase().indexOf(kw)  !== -1 ||
                     u.email.toLowerCase().indexOf(kw) !== -1;
            var rm = !$scope.userRoleFilter || u.role === $scope.userRoleFilter;
            return sm && rm;
        });
    }

    $scope.$watchGroup(['userSearch', 'userRoleFilter', 'users.length'], function() {
        rebuildFilteredUsers();
    });


    // ── CHANGE USER ROLE ───────────────────────────────────────
    // FIX: Use u._pendingRole (the dropdown selection) not u._newRole
    // Save is only active when _pendingRole is set AND different from current role
    $scope.changeRole = function(u) {
        if (!u._pendingRole || u._pendingRole === u.role) {
            u._roleErr = false;
            u._roleMsg = 'Please select a different role first.';
            setTimeout(function() { $scope.$apply(function() { u._roleMsg = ''; }); }, 3000);
            return;
        }
        var targetRole = u._pendingRole;
        $http.put('/api/admin/users/' + u._id + '/role', { role: targetRole })
        .then(function(res) {
            u._roleErr = !res.data.success;
            u._roleMsg = res.data.success ? res.data.message : res.data.message;
            if (res.data.success) {
                // Update the displayed role badge immediately
                u.role = targetRole;
                // Reset the pending dropdown to empty so Save is disabled again
                u._pendingRole = '';
                // Refresh staff list so newly promoted staff appear in assign dropdown
                $scope.loadStaff();
                $scope.loadStats();
            }
            setTimeout(function() { $scope.$apply(function() { u._roleMsg = ''; }); }, 5000);
        })
        .catch(function() { u._roleErr = true; u._roleMsg = 'Server error. Please try again.'; });
    };


    // ── CATEGORY MANAGEMENT ────────────────────────────────────
    $scope.addCategory = function() {
        $scope.catMsg = '';
        $scope.catErr = '';
        if (!$scope.newCatName || $scope.newCatName.trim().length < 2) {
            $scope.catErr = 'Category name must be at least 2 characters.'; return;
        }
        $http.post('/api/admin/categories', { name: $scope.newCatName.trim(), description: $scope.newCatDesc || '' })
        .then(function(res) {
            if (res.data.success) {
                $scope.catMsg    = '"' + res.data.category.name + '" added.';
                $scope.newCatName = '';
                $scope.newCatDesc = '';
                $scope.loadCategories();
            } else {
                $scope.catErr = res.data.message;
            }
        })
        .catch(function() { $scope.catErr = 'Server error.'; });
    };

    $scope.deleteCategory = function(cat) {
        if (!confirm('Delete category "' + cat.name + '"?\nComplaints using this category will be affected.')) return;
        $http.delete('/api/admin/categories/' + cat._id)
        .then(function(res) {
            if (res.data.success) { $scope.catMsg = 'Category deleted.'; $scope.loadCategories(); }
            else $scope.catErr = res.data.message;
        })
        .catch(function() { $scope.catErr = 'Server error.'; });
    };


    // ── LOGOUT ─────────────────────────────────────────────────
    $scope.logout = function() {
        $http.post('/api/auth/logout').then(function() { window.location.href = '/login'; });
    };


    // ── BADGE CSS HELPERS ──────────────────────────────────────
    // Whether the Assign button should be shown for this complaint
    $scope.canAssign = function(c) {
        // Only allow assigning if complaint is not yet closed/resolved/rejected
        var blocked = ['Closed', 'Resolved', 'Rejected'];
        return blocked.indexOf(c.status) === -1;
    };

    // Whether the Confirm & Close button should be shown
    $scope.canConfirm = function(c) {
        return c.status === 'Resolved' && !c.completionConfirmed;
    };
    $scope.getStatusClass = function(s) {
        var m = {
            'Submitted':    'badge-status-pending',
            'Under Review': 'badge-status-assigned',
            'Assigned':     'badge-status-assigned',
            'In Progress':  'badge-status-inprogress',
            'Resolved':     'badge-status-resolved',
            'Closed':       'badge-status-resolved',
            'Rejected':     'badge-status-rejected'
        };
        return m[s] || '';
    };
    $scope.getPriorityClass = function(p) {
        var m = { 'High':'badge-priority-high', 'Medium':'badge-priority-medium', 'Low':'badge-priority-low' };
        return m[p] || '';
    };
    $scope.getRoleBadge = function(r) {
        var m = { 'admin':'badge-status-assigned', 'staff':'badge-status-inprogress', 'user':'badge-priority-low' };
        return m[r] || '';
    };
    $scope.getLogStatusClass = function(s) {
        var m = { 'Assigned':'badge-status-assigned', 'In Progress':'badge-status-inprogress',
                  'Resolved':'badge-status-resolved', 'Closed':'badge-status-resolved' };
        return m[s] || '';
    };

});
