// user.js — AngularJS controller for User Dashboard

angular.module('complainApp', [])
.controller('UserCtrl', function($scope, $http) {

    $scope.activeTab  = 'submit';
    $scope.userName   = '';
    $scope.complaints = [];
    $scope.categories = [];
    $scope.fetchingComplaints = false;
    $scope.loading        = false;
    $scope.successMsg     = '';
    $scope.errorMsg       = '';
    $scope.profileMsg     = '';
    $scope.profileErr     = '';
    $scope.passwordMsg    = '';
    $scope.passwordErr    = '';
    $scope.savingProfile  = false;
    $scope.savingPassword = false;

    $scope.formData     = { title: '', category: '', description: '' };
    $scope.profileData  = { name: '', email: '', phone: '' };
    $scope.passwordData = { currentPassword: '', newPassword: '', confirmNew: '' };

    $scope.searchKeyword  = '';
    $scope.filterStatus   = '';
    $scope.filterPriority = '';
    $scope.filterDateFrom = '';
    $scope.filterDateTo   = '';

    $scope.statusOptions = ['Submitted','Under Review','Assigned','In Progress','Resolved','Closed','Rejected'];


    // ── SESSION CHECK ──────────────────────────────────────────
    $http.get('/api/auth/session')
    .then(function(res) {
        if (res.data.success) {
            $scope.userName = res.data.user.name;
            var role = res.data.user.role;
            if (role === 'admin') { window.location.href = '/admin'; return; }
            if (role === 'staff') { window.location.href = '/staff'; return; }
            $scope.loadCategories();
        } else {
            window.location.href = '/login';
        }
    })
    .catch(function() { window.location.href = '/login'; });


    // ── LOAD CATEGORIES ────────────────────────────────────────
    $scope.loadCategories = function() {
        $http.get('/api/auth/categories')
        .then(function(res) {
            if (res.data.success) $scope.categories = res.data.categories;
        });
    };


    // ── TAB SWITCH ─────────────────────────────────────────────
    $scope.showTab = function(tab) {
        $scope.activeTab  = tab;
        $scope.successMsg = '';
        $scope.errorMsg   = '';
        if (tab === 'complaints') $scope.loadComplaints();
        if (tab === 'profile')    $scope.loadProfile();
    };


    // ── SUBMIT COMPLAINT ───────────────────────────────────────
    $scope.submitComplaint = function() {
        $scope.successMsg = '';
        $scope.errorMsg   = '';

        if (!$scope.formData.title || $scope.formData.title.trim().length < 5) {
            $scope.errorMsg = 'Title must be at least 5 characters.'; return;
        }
        if (!$scope.formData.category) {
            $scope.errorMsg = 'Please select a category.'; return;
        }
        if (!$scope.formData.description || $scope.formData.description.trim().length < 10) {
            $scope.errorMsg = 'Description must be at least 10 characters.'; return;
        }

        var fd = new FormData();
        fd.append('title',       $scope.formData.title.trim());
        fd.append('category',    $scope.formData.category);
        fd.append('description', $scope.formData.description);

        var fileInput = document.getElementById('attachmentFile');
        if (fileInput && fileInput.files.length > 0) {
            fd.append('attachment', fileInput.files[0]);
        }

        $scope.loading = true;
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/complaints');
        xhr.onload = function() {
            $scope.$apply(function() {
                $scope.loading = false;
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    $scope.successMsg = data.message + ' — Priority auto-detected: ' + data.complaint.priority;
                    $scope.formData   = { title: '', category: '', description: '' };
                    if (fileInput) fileInput.value = '';
                } else {
                    $scope.errorMsg = data.message;
                }
            });
        };
        xhr.onerror = function() {
            $scope.$apply(function() { $scope.loading = false; $scope.errorMsg = 'Server error. Please try again.'; });
        };
        xhr.send(fd);
    };


    // ── LOAD MY COMPLAINTS ─────────────────────────────────────
    $scope.loadComplaints = function() {
        $scope.fetchingComplaints = true;
        var params = [];
        if ($scope.searchKeyword.trim()) params.push('search='   + encodeURIComponent($scope.searchKeyword.trim()));
        if ($scope.filterStatus)         params.push('status='   + encodeURIComponent($scope.filterStatus));
        if ($scope.filterPriority)       params.push('priority=' + encodeURIComponent($scope.filterPriority));
        if ($scope.filterDateFrom)       params.push('dateFrom=' + encodeURIComponent($scope.filterDateFrom));
        if ($scope.filterDateTo)         params.push('dateTo='   + encodeURIComponent($scope.filterDateTo));
        var qs = params.length > 0 ? '?' + params.join('&') : '';

        $http.get('/api/complaints/my' + qs)
        .then(function(res) {
            $scope.fetchingComplaints = false;
            $scope.complaints = res.data.complaints || [];
        })
        .catch(function() { $scope.fetchingComplaints = false; });
    };

    $scope.searchComplaints = function() { $scope.loadComplaints(); };

    $scope.clearSearch = function() {
        $scope.searchKeyword = $scope.filterStatus = $scope.filterPriority = '';
        $scope.filterDateFrom = $scope.filterDateTo = '';
        $scope.loadComplaints();
    };


    // ── DELETE COMPLAINT ───────────────────────────────────────
    $scope.deleteComplaint = function(id) {
        if (!confirm('Delete this complaint? This cannot be undone.')) return;
        $http.delete('/api/complaints/' + id)
        .then(function(res) {
            if (res.data.success) {
                $('#card-' + id).fadeOut(300, function() {
                    $scope.$apply(function() {
                        $scope.complaints = $scope.complaints.filter(function(c) { return c._id !== id; });
                    });
                });
            } else {
                alert(res.data.message);
            }
        });
    };


    // ── OPEN OTP EDIT MODAL ────────────────────────────────────
    $scope.openEditModal = function(complaint) {
        window._editComplaintId = complaint._id;
        document.getElementById('editTitle').value = complaint.title;
        document.getElementById('editDesc').value  = complaint.description;
        document.getElementById('otpInput').value  = '';
        document.getElementById('otpSentMsg').style.display = 'none';
        document.getElementById('otpErrMsg').style.display  = 'none';
        document.getElementById('otpTimerDisplay').textContent = '';
        var btn = document.getElementById('requestOtpBtn');
        btn.disabled    = false;
        btn.textContent = 'Send OTP to Email';
        new bootstrap.Modal(document.getElementById('editModal')).show();
    };


    // ── LOAD PROFILE ───────────────────────────────────────────
    $scope.loadProfile = function() {
        $http.get('/api/auth/profile').then(function(res) {
            if (res.data.success) {
                $scope.profileData = {
                    name:  res.data.user.name,
                    email: res.data.user.email,
                    phone: res.data.user.phone || ''
                };
            }
        });
    };


    // ── UPDATE PROFILE (name + phone only, no email) ───────────
    $scope.updateProfile = function() {
        $scope.profileMsg = '';
        $scope.profileErr = '';
        if (!$scope.profileData.name || $scope.profileData.name.trim().length < 2) {
            $scope.profileErr = 'Name must be at least 2 characters.'; return;
        }
        if (!/^[a-zA-Z\s]+$/.test($scope.profileData.name)) {
            $scope.profileErr = 'Name must contain only letters.'; return;
        }
        if (!$scope.profileData.phone || !/^\d{10}$/.test($scope.profileData.phone)) {
            $scope.profileErr = 'Phone number must be exactly 10 digits.'; return;
        }
        $scope.savingProfile = true;
        // Only send name and phone — never email
        $http.put('/api/auth/profile', { name: $scope.profileData.name.trim(), phone: $scope.profileData.phone.trim() })
        .then(function(res) {
            $scope.savingProfile = false;
            if (res.data.success) {
                $scope.profileMsg = 'Profile updated successfully.';
                $scope.userName   = res.data.user.name;
            } else {
                $scope.profileErr = res.data.message;
            }
        })
        .catch(function() { $scope.savingProfile = false; $scope.profileErr = 'Server error.'; });
    };


    // ── CHANGE PASSWORD ────────────────────────────────────────
    $scope.changePassword = function() {
        $scope.passwordMsg = '';
        $scope.passwordErr = '';
        var d = $scope.passwordData;
        if (!d.currentPassword || !d.newPassword || !d.confirmNew) {
            $scope.passwordErr = 'All fields are required.'; return;
        }
        if (d.newPassword.length < 6) {
            $scope.passwordErr = 'New password must be at least 6 characters.'; return;
        }
        if (d.newPassword !== d.confirmNew) {
            $scope.passwordErr = 'New passwords do not match.'; return;
        }
        $scope.savingPassword = true;
        $http.put('/api/auth/change-password', d)
        .then(function(res) {
            $scope.savingPassword = false;
            if (res.data.success) {
                $scope.passwordMsg  = 'Password changed successfully.';
                $scope.passwordData = { currentPassword: '', newPassword: '', confirmNew: '' };
            } else {
                $scope.passwordErr = res.data.message;
            }
        })
        .catch(function() { $scope.savingPassword = false; $scope.passwordErr = 'Server error.'; });
    };


    // ── LOGOUT ─────────────────────────────────────────────────
    $scope.logout = function() {
        $http.post('/api/auth/logout').then(function() { window.location.href = '/login'; });
    };


    // ── BADGE HELPERS ──────────────────────────────────────────
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

});


// ── OTP functions ─────────────────────────────────────────────
var _otpTimer = null;

function requestOtp() {
    var id     = window._editComplaintId;
    var btn    = document.getElementById('requestOtpBtn');
    var sentEl = document.getElementById('otpSentMsg');
    var errEl  = document.getElementById('otpErrMsg');
    sentEl.style.display = 'none';
    errEl.style.display  = 'none';
    btn.disabled    = true;
    btn.textContent = 'Sending...';

    fetch('/api/complaints/' + id + '/request-otp', { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        btn.textContent = 'Send OTP to Email';
        if (data.success) {
            sentEl.textContent   = 'OTP sent to your email. Valid for 2 minutes.';
            sentEl.style.display = 'block';
            var timeLeft = 120;
            var timerEl  = document.getElementById('otpTimerDisplay');
            if (_otpTimer) clearInterval(_otpTimer);
            _otpTimer = setInterval(function() {
                timeLeft--;
                timerEl.textContent = timeLeft + 's remaining';
                if (timeLeft <= 0) {
                    clearInterval(_otpTimer);
                    timerEl.textContent = 'OTP expired. Request a new one.';
                    btn.disabled = false;
                }
            }, 1000);
        } else {
            errEl.textContent   = data.message;
            errEl.style.display = 'block';
            btn.disabled = false;
        }
    })
    .catch(function() {
        btn.textContent     = 'Send OTP to Email';
        btn.disabled        = false;
        errEl.textContent   = 'Server error. Please try again.';
        errEl.style.display = 'block';
    });
}

function submitEdit() {
    var id    = window._editComplaintId;
    var otp   = document.getElementById('otpInput').value.trim();
    var title = document.getElementById('editTitle').value.trim();
    var desc  = document.getElementById('editDesc').value.trim();
    var errEl = document.getElementById('otpErrMsg');
    errEl.style.display = 'none';

    if (!otp) {
        errEl.textContent   = 'Please enter the OTP sent to your email.';
        errEl.style.display = 'block';
        return;
    }
    fetch('/api/complaints/' + id, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ otp: otp, title: title, description: desc })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            location.reload();
        } else {
            errEl.textContent   = data.message;
            errEl.style.display = 'block';
        }
    })
    .catch(function() {
        errEl.textContent   = 'Server error. Please try again.';
        errEl.style.display = 'block';
    });
}
