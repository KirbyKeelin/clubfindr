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
                if (status === 'approved') {
                    const { data: club } = await window.sbClient.from('clubs').select('created_by, name').eq('id', id).single();
                    if (club && club.created_by) {
                        await window.sbClient.from('notifications').insert({
                            user_id: club.created_by,
                            title: 'Club Approved!',
                            message: `Your request to create the club "${club.name}" has been approved.`
                        });
                    }
                }
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

    const eventsList = document.getElementById('pending-events-list');
    const eventsLoading = document.getElementById('loading-events');
    const eventsEmpty = document.getElementById('empty-events-state');

    async function loadPendingEvents() {
        try {
            const { data: pending, error } = await window.sbClient
                .from('events')
                .select('*, clubs(name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            eventsLoading.style.display = 'none';

            if (!pending || pending.length === 0) {
                eventsList.style.display = 'none';
                eventsEmpty.style.display = 'block';
                return;
            }

            eventsList.style.display = 'flex';
            eventsEmpty.style.display = 'none';

            eventsList.innerHTML = pending.map(ev => `
                <div class="settings-card" style="border-left: 4px solid #3b82f6; padding: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin-top:0;">${ev.title}</h3>
                            <p style="margin: 5px 0;"><strong>Club:</strong> ${ev.clubs?.name || 'Unknown'}</p>
                            <p style="margin: 5px 0;"><strong>Start:</strong> ${new Date(ev.start_time).toLocaleString()}</p>
                            ${ev.end_time ? `<p style="margin: 5px 0;"><strong>End:</strong> ${new Date(ev.end_time).toLocaleString()}</p>` : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:10px; min-width:120px;">
                            <button onclick="handleEventDecision('${ev.id}', 'approve', '${ev.club_id}')" class="btn-primary" style="background:#10b981; border:none;">Approve</button>
                            <button onclick="handleEventDecision('${ev.id}', 'reject', '${ev.club_id}')" class="btn-primary" style="background:#ef4444; border:none;">Reject</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error(e);
            eventsLoading.style.display = 'none';
        }
    }

    window.handleEventDecision = async (id, action, clubId) => {
        if (!confirm(`Are you sure you want to ${action} this event?`)) return;

        try {
            const status = action === 'approve' ? 'approved' : 'rejected';
            const { error } = await window.sbClient
                .from('events')
                .update({ status })
                .eq('id', id);

            if (!error) {
                if (status === 'approved') {
                    // Send notification to all club members
                    const { data: members } = await window.sbClient.from('club_members').select('user_id').eq('club_id', clubId);
                    const { data: event } = await window.sbClient.from('events').select('title, clubs(name)').eq('id', id).single();
                    if (members && members.length > 0 && event) {
                        const notifications = members.map(m => ({
                            user_id: m.user_id,
                            title: 'New Event Posted!',
                            message: `The event "${event.title}" has been approved and posted to ${event.clubs.name}'s calendar.`
                        }));
                        await window.sbClient.from('notifications').insert(notifications);
                    }
                }
                
                eventsList.innerHTML = '';
                eventsLoading.style.display = 'block';
                await loadPendingEvents();
            } else {
                alert(`Failed to ${action} event.`);
            }
        } catch (e) {
            alert('Error applying decision.');
            console.error(e);
        }
    }

    loadPending();
    loadPendingEvents();
});
