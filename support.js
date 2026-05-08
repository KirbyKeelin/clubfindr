document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('supportForm');
    const successMsg = document.getElementById('supportSuccess');
    const submitBtn = document.getElementById('supportSubmitBtn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const subject = document.getElementById('supportSubject').value;
            const message = document.getElementById('supportMessage').value.trim();

            if (!subject) { alert('Please select a subject.'); return; }
            if (!message) { alert('Please enter a message.'); return; }

            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            try {
                const currentUser = await window.ClubFinderAuth.getCurrentUser();
                if (!currentUser) throw new Error('Not signed in');
                
                const { error } = await window.sbClient
                    .from('support_tickets')
                    .insert({
                        user_id: currentUser.id,
                        subject,
                        message
                    });
                    
                if (error) throw error;
            } catch (e) {
                console.error('Support submit error:', e);
                submitBtn.textContent = 'Submit';
                submitBtn.disabled = false;
                alert('Failed to send message: ' + e.message);
                return;
            }

            form.style.display = 'none';
            successMsg.style.display = 'block';
        });
    }
});
