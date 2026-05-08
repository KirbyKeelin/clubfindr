document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const showSignUp = document.getElementById('showSignUp');
    const showSignIn = document.getElementById('showSignIn');
    const signInMessage = document.getElementById('signInMessage');
    const signUpMessage = document.getElementById('signUpMessage');

    // Toggle forms
    if (showSignUp) {
        showSignUp.addEventListener('click', (e) => {
            e.preventDefault();
            signInForm.classList.remove('active');
            signUpForm.classList.add('active');
            clearMessages();
        });
    }

    if (showSignIn) {
        showSignIn.addEventListener('click', (e) => {
            e.preventDefault();
            signUpForm.classList.remove('active');
            signInForm.classList.add('active');
            clearMessages();
        });
    }

    function clearMessages() {
        [signInMessage, signUpMessage].forEach(el => {
            if(el) {
                el.className = 'auth-message';
                el.textContent = '';
            }
        });
    }

    function showMessage(el, text, type) {
        if(!el) return;
        el.textContent = text;
        el.className = 'auth-message ' + type;
    }

    // Sign In
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('signInBtn');
            const email = document.getElementById('signInEmail').value;
            const password = document.getElementById('signInPassword').value;

            btn.textContent = 'Signing in...';
            btn.disabled = true;

            const result = await window.ClubFinderAuth.loginUser(email, password);

            if (result.success) {
                showMessage(signInMessage, 'Signing you in...', 'success');
                // The auth-guard in auth.js will redirect appropriately once the session is active.
                setTimeout(() => { window.location.href = 'index.html'; }, 500);
            } else {
                showMessage(signInMessage, result.message, 'error');
                btn.textContent = 'Sign In';
                btn.disabled = false;
            }
        });
    }

    // Sign Up
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('signUpBtn');
            const email = document.getElementById('signUpEmail').value;
            const password = document.getElementById('signUpPassword').value;
            const confirm = document.getElementById('signUpConfirm').value;

            if (password !== confirm) {
                showMessage(signUpMessage, 'Passwords do not match.', 'error');
                return;
            }

            btn.textContent = 'Creating account...';
            btn.disabled = true;

            // We pass a dummy display name to registerUser because we removed it from the form.
            // Setup-profile will handle the real display name.
            const result = await window.ClubFinderAuth.registerUser(email, password, 'setup-pending');

            if (result.success) {
                showMessage(signUpMessage, 'Account created! Please check your email for a confirmation link.', 'success');
                btn.textContent = 'Check your email';
                // Leave the button disabled since they must confirm email
            } else {
                showMessage(signUpMessage, result.message, 'error');
                btn.textContent = 'Create Account';
                btn.disabled = false;
            }
        });
    }
});
