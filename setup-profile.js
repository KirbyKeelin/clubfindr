document.addEventListener('DOMContentLoaded', () => {
    const setupForm = document.getElementById('setupProfileForm');
    const setupBtn = document.getElementById('setupBtn');
    const setupMessage = document.getElementById('setupMessage');

    function showMessage(text, type) {
        setupMessage.textContent = text;
        setupMessage.className = 'auth-message ' + type;
    }

    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('setupName').value.trim();
            const notifyEmail = document.getElementById('notifyEmail').checked;
            const notifyWeb = document.getElementById('notifyWeb').checked;

            if (!name) {
                showMessage('Please enter a display name.', 'error');
                return;
            }

            setupBtn.textContent = 'Saving...';
            setupBtn.disabled = true;

            try {
                const { data: { session } } = await window.sbClient.auth.getSession();
                if (!session) throw new Error('Not authenticated');

                const { error } = await window.sbClient
                    .from('profiles')
                    .upsert({ 
                        id: session.user.id,
                        email: session.user.email,
                        display_name: name,
                        notify_email: notifyEmail,
                        notify_web: notifyWeb
                    });

                if (error) throw error;

                showMessage('Profile saved! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);

            } catch (err) {
                console.error('Setup error:', err);
                showMessage(err.message || 'Failed to save profile.', 'error');
                setupBtn.textContent = 'Finish Setup';
                setupBtn.disabled = false;
            }
        });
    }
});
