document.addEventListener('DOMContentLoaded', async () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    const saveNotifyBtn = document.getElementById('saveNotifyBtn');
    const passwordMessage = document.getElementById('passwordMessage');
    const notifyMessage = document.getElementById('notifyMessage');

    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');

    const notifyEmailToggle = document.getElementById('notifyEmailToggle');
    const notifyWebToggle = document.getElementById('notifyWebToggle');

    let currentUser = null;

    // Load initial data
    async function loadSettings() {
        const { data: { session } } = await window.sbClient.auth.getSession();
        if (!session) return;
        currentUser = session.user;

        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('notify_email, notify_web')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            if (notifyEmailToggle) notifyEmailToggle.checked = profile.notify_email;
            if (notifyWebToggle) notifyWebToggle.checked = profile.notify_web;
        }
    }

    loadSettings();

    // Check if dark mode was previously enabled
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        if (darkModeToggle) darkModeToggle.checked = true;
    }

    // Handle Dark Mode Toggle
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    function showMessage(el, text, isError = false) {
        if (!el) return;
        el.textContent = text;
        el.style.color = isError ? 'red' : 'green';
        setTimeout(() => el.textContent = '', 4000);
    }

    // Handle Update Password Button
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const current = currentPassword.value;
            const newPass = newPassword.value;
            const confirmPass = confirmPassword.value;

            if (!current || !newPass || !confirmPass) {
                showMessage(passwordMessage, "Please fill out all password fields.", true);
                return;
            }

            if (newPass !== confirmPass) {
                showMessage(passwordMessage, "New passwords do not match!", true);
                return;
            }

            if (!currentUser || !currentUser.email) return;

            updatePasswordBtn.textContent = 'Updating...';
            updatePasswordBtn.disabled = true;

            try {
                // 1. Verify current password by signing in
                const { error: signInError } = await window.sbClient.auth.signInWithPassword({
                    email: currentUser.email,
                    password: current
                });

                if (signInError) {
                    throw new Error("Incorrect current password.");
                }

                // 2. Update to new password
                const { error: updateError } = await window.sbClient.auth.updateUser({
                    password: newPass
                });

                if (updateError) throw updateError;

                showMessage(passwordMessage, "Password updated successfully!", false);
                
                // Clear inputs
                currentPassword.value = "";
                newPassword.value = "";
                confirmPassword.value = "";

            } catch (err) {
                showMessage(passwordMessage, err.message, true);
            } finally {
                updatePasswordBtn.textContent = 'Update Password';
                updatePasswordBtn.disabled = false;
            }
        });
    }

    // Handle Save Notifications
    if (saveNotifyBtn) {
        saveNotifyBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            saveNotifyBtn.textContent = 'Saving...';
            saveNotifyBtn.disabled = true;

            try {
                const { error } = await window.sbClient
                    .from('profiles')
                    .update({
                        notify_email: notifyEmailToggle.checked,
                        notify_web: notifyWebToggle.checked
                    })
                    .eq('id', currentUser.id);

                if (error) throw error;
                showMessage(notifyMessage, "Preferences saved!", false);

            } catch (err) {
                showMessage(notifyMessage, err.message, true);
            } finally {
                saveNotifyBtn.textContent = 'Save Preferences';
                saveNotifyBtn.disabled = false;
            }
        });
    }
});
