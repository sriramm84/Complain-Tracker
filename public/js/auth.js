// auth.js — Login and Register pages

var app = angular.module('complainApp', []);

app.controller('AuthCtrl', ['$scope', '$http', '$window', function($scope, $http, $window) {

    $scope.formData   = {};
    $scope.loading    = false;
    $scope.successMsg = '';
    $scope.errorMsg   = '';

    // Redirect if already logged in
    $http.get('/api/auth/session').then(function(res) {
        if (res.data.success) {
            var r = res.data.user.role;
            if (r === 'admin') $window.location.href = '/admin';
            else if (r === 'staff') $window.location.href = '/staff';
            else $window.location.href = '/dashboard';
        }
    });

    function getErrMsg(err) {
        return (err && err.data && err.data.message) ? err.data.message : 'Something went wrong.';
    }
    function markInvalid(id, msg) { $('#'+id).removeClass('is-valid').addClass('is-invalid'); $('#'+id).siblings('.invalid-feedback').text(msg); }
    function markValid(id)        { $('#'+id).removeClass('is-invalid').addClass('is-valid'); $('#'+id).siblings('.invalid-feedback').text(''); }
    function clearMark(id)        { $('#'+id).removeClass('is-invalid is-valid'); }


    // ── LOGIN ─────────────────────────────────────────────────
    $scope.login = function() {
        $scope.errorMsg = $scope.successMsg = '';
        var ok = true;
        if (!$scope.formData.email || !/^\S+@\S+\.\S+$/.test($scope.formData.email)) { markInvalid('emailInput', 'Enter a valid email.'); ok = false; } else markValid('emailInput');
        if (!$scope.formData.password) { markInvalid('passwordInput', 'Password is required.'); ok = false; } else markValid('passwordInput');
        if (!ok) return;
        $scope.loading = true;

        $http.post('/api/auth/login', { email: $scope.formData.email.trim(), password: $scope.formData.password })
        .then(function(res) {
            var role = res.data.user.role;
            var params = new URLSearchParams($window.location.search);
            var next   = params.get('next');

            var dest;
            if (role === 'admin')  dest = '/admin';
            else if (role === 'staff') dest = '/staff';
            else dest = '/dashboard';

            // Only honour ?next= if it matches the user's own dashboard
            if (next && next === dest) dest = next;

            $scope.successMsg = 'Login successful! Redirecting...';
            setTimeout(function() { $window.location.href = dest; }, 500);
        })
        .catch(function(err) { $scope.errorMsg = getErrMsg(err); $scope.loading = false; clearMark('emailInput'); clearMark('passwordInput'); });
    };


    // ── REGISTER ──────────────────────────────────────────────
    $scope.register = function() {
        $scope.errorMsg = $scope.successMsg = '';
        var ok = true;

        if (!$scope.formData.name || $scope.formData.name.trim().length < 2) { markInvalid('nameInput', 'Name must be at least 2 characters.'); ok = false; }
        else if (!/^[a-zA-Z\s]+$/.test($scope.formData.name))                { markInvalid('nameInput', 'Name must contain only letters.'); ok = false; }
        else markValid('nameInput');

        if (!$scope.formData.email || !/^\S+@\S+\.\S+$/.test($scope.formData.email)) { markInvalid('emailInput', 'Enter a valid email.'); ok = false; } else markValid('emailInput');

        if (!$scope.formData.phone || !/^\d{10}$/.test($scope.formData.phone)) { markInvalid('phoneInput', 'Phone must be exactly 10 digits.'); ok = false; } else markValid('phoneInput');

        if (!$scope.formData.password || $scope.formData.password.length < 6) { markInvalid('passwordInput', 'At least 6 characters required.'); ok = false; } else markValid('passwordInput');

        if (!$scope.formData.confirmPassword)                                        { markInvalid('confirmInput', 'Confirm your password.'); ok = false; }
        else if ($scope.formData.password !== $scope.formData.confirmPassword)       { markInvalid('confirmInput', 'Passwords do not match.'); ok = false; }
        else markValid('confirmInput');

        if (!ok) return;
        $scope.loading = true;

        $http.post('/api/auth/register', {
            name:            $scope.formData.name.trim(),
            email:           $scope.formData.email.trim(),
            phone:           $scope.formData.phone.trim(),
            password:        $scope.formData.password,
            confirmPassword: $scope.formData.confirmPassword
        })
        .then(function() { $scope.successMsg = 'Account created! Redirecting...'; setTimeout(function() { $window.location.href = '/dashboard'; }, 1000); })
        .catch(function(err) { $scope.errorMsg = getErrMsg(err); $scope.loading = false; });
    };


    // ── Live field validation with jQuery ─────────────────────
    setTimeout(function() {

        $(document).on('input', '#nameInput', function() {
            var v = $(this).val();
            if (!v) { clearMark('nameInput'); return; }
            if (!/^[a-zA-Z\s]*$/.test(v)) { $(this).removeClass('is-valid').addClass('is-invalid'); $(this).siblings('.invalid-feedback').text('No numbers or special characters.'); }
            else if (v.trim().length < 2)  { clearMark('nameInput'); }
            else                           { $(this).removeClass('is-invalid').addClass('is-valid'); $(this).siblings('.invalid-feedback').text(''); }
        });

        $(document).on('input', '#emailInput', function() {
            var v = $(this).val().trim();
            if (!v) { clearMark('emailInput'); return; }
            if (/^\S+@\S+\.\S+$/.test(v)) { $(this).removeClass('is-invalid').addClass('is-valid'); $(this).siblings('.invalid-feedback').text(''); }
            else                           { $(this).removeClass('is-valid').addClass('is-invalid'); $(this).siblings('.invalid-feedback').text('Enter a valid email.'); }
        });

        $(document).on('input', '#phoneInput', function() {
            var v = $(this).val().trim();
            if (!v) { clearMark('phoneInput'); return; }
            if (/^\d{10}$/.test(v)) { $(this).removeClass('is-invalid').addClass('is-valid'); $(this).siblings('.invalid-feedback').text(''); }
            else                    { $(this).removeClass('is-valid').addClass('is-invalid'); $(this).siblings('.invalid-feedback').text('Phone must be exactly 10 digits.'); }
        });

        $(document).on('input', '#passwordInput', function() {
            var v = $(this).val();
            if (!v) { clearMark('passwordInput'); return; }
            if (v.length >= 6) { $(this).removeClass('is-invalid').addClass('is-valid'); $(this).siblings('.invalid-feedback').text(''); }
            else               { $(this).removeClass('is-valid').addClass('is-invalid'); $(this).siblings('.invalid-feedback').text('At least 6 characters required.'); }
            var cv = $('#confirmInput').val();
            if (cv) { if (v === cv) { $('#confirmInput').removeClass('is-invalid').addClass('is-valid').siblings('.invalid-feedback').text(''); } else { $('#confirmInput').removeClass('is-valid').addClass('is-invalid').siblings('.invalid-feedback').text('Passwords do not match.'); } }
        });

        $(document).on('input', '#confirmInput', function() {
            var v = $(this).val(), pv = $('#passwordInput').val();
            if (!v) { clearMark('confirmInput'); return; }
            if (v === pv) { $(this).removeClass('is-invalid').addClass('is-valid'); $(this).siblings('.invalid-feedback').text(''); }
            else          { $(this).removeClass('is-valid').addClass('is-invalid'); $(this).siblings('.invalid-feedback').text('Passwords do not match.'); }
        });

    }, 300);

}]);
