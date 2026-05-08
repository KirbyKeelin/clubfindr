document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('pending-list');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('admin-error');

    let currentUser = null;
    try {
        currentUser = await window.ClubFinderAuth.getCurrentUser();
    } catch(e) {}

    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    async function loadPending() {
        try {
            const { data: pending, error } = await window.sbClient
                .from('clubs')
                .select('*, profiles!clubs_created_by_fkey(display_name, email)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === 'PGRST301') { // Generic unauthorized/forbidden error
                    loading.style.display = 'none';
                    errorState.style.display = 'block';
                    return;
                }
                throw error;
            }
            
            loading.style.display = 'none';

            if (pending.length === 0) {
                listContainer.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }

            listContainer.style.display = 'flex';
            emptyState.style.display = 'none';

            listContainer.innerHTML = pending.map(club => `
                <div class="settings-card" style="border-left: 4px solid #f59e0b; padding: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin-top:0;">${club.name}</h3>
                            <p style="margin: 5px 0;"><strong>Description:</strong> ${club.description}</p>
                            <p style="margin: 5px 0;"><strong>Tags:</strong> ${club.tags.join(', ') || 'None'}</p>
                            <p style="margin: 5px 0;"><strong>Faculty:</strong> ${club.faculty_moderator || 'None Listed'}</p>
                            <p style="margin: 5px 0; color:#555; background:#f9fafb; padding:10px; border-radius:4px;"><strong>Extra Info:</strong><br/>${club.additional_info || 'N/A'}</p>
                            <p style="margin: 10px 0 0 0; font-size:12px; color:#9ca3af;">Requested by: ${club.profiles?.display_name || 'Unknown'} (${club.profiles?.email || 'N/A'})</p>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:10px; min-width:120px;">
                            <button onclick="handleDecision('${club.id}', 'approve')" class="btn-primary" style="background:#10b981; border:none;">Approve</button>
                            <button onclick="handleDecision('${club.id}', 'reject')" class="btn-primary" style="background:#ef4444; border:none;">Reject</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error(e);
            loading.style.display = 'none';
            alert('An error occurred trying to load pending clubs.');
        }
    }

    window.handleDecision = async (id, action) => {
        if (!confirm(`Are you sure you want to ${action} this club?`)) return;

        try {
            const status = action === 'approve' ? 'approved' : 'rejected';
            const { error } = await window.sbClient
                .from('clubs')
                .update({ status })
                .eq('id', id);

            if (!error) {
                // Reload list
                listContainer.innerHTML = '';
                loading.style.display = 'block';
                await loadPending();
            } else {
                alert(`Failed to ${action} club.`);
            }
        } catch (e) {
            alert('Error applying decision.');
            console.error(e);
        }
    }

    loadPending();
});
