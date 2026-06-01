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

    const actionModal = document.getElementById('actionModal');
    const cancelActionBtn = document.getElementById('cancelActionBtn');
    const confirmActionBtn = document.getElementById('confirmActionBtn');
    const actionReason = document.getElementById('actionReason');
    
    let pendingActionCallback = null;

    function promptForReason(actionName, callback) {
        document.getElementById('actionModalTitle').textContent = `Confirm ${actionName}`;
        actionReason.value = '';
        actionModal.style.display = 'flex';
        pendingActionCallback = callback;
    }

    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', () => {
            actionModal.style.display = 'none';
            pendingActionCallback = null;
        });
    }

    if (confirmActionBtn) {
        confirmActionBtn.addEventListener('click', () => {
            const reason = actionReason.value.trim();
            actionModal.style.display = 'none';
            if (pendingActionCallback) {
                pendingActionCallback(reason);
            }
        });
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
            window.showToast('An error occurred trying to load pending clubs.', 'error');
        }
    }

    window.handleDecision = async (id, action) => {
        promptForReason(action, async (reason) => {
            try {
                const status = action === 'approve' ? 'approved' : 'rejected';
                const { error } = await window.sbClient
                    .from('clubs')
                    .update({ status })
                    .eq('id', id);

                if (!error) {
                    const { data: club } = await window.sbClient.from('clubs').select('created_by, name').eq('id', id).single();
                    if (club && club.created_by) {
                        const title = status === 'approved' ? 'Club Approved!' : 'Club Rejected';
                        const message = `Your request to create the club "${club.name}" has been ${status}. Reason: ${reason || 'None provided.'}`;
                        await window.sbClient.from('notifications').insert({
                            user_id: club.created_by,
                            title: title,
                            message: message
                        });
                    }
                    
                    // Reload list
                    listContainer.innerHTML = '';
                    loading.style.display = 'block';
                    await loadPending();
                } else {
                    window.showToast(`Failed to ${action} club.`, 'error');
                }
            } catch (e) {
                window.showToast('Error applying decision.', 'error');
                console.error(e);
            }
        });
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
        promptForReason(action, async (reason) => {
            try {
                const status = action === 'approve' ? 'approved' : 'rejected';
                const { error } = await window.sbClient
                    .from('events')
                    .update({ status })
                    .eq('id', id);

                if (!error) {
                    const { data: members } = await window.sbClient.from('club_members').select('user_id').eq('club_id', clubId);
                    const { data: event } = await window.sbClient.from('events').select('title, clubs(name)').eq('id', id).single();
                    
                    if (members && members.length > 0 && event) {
                        const title = status === 'approved' ? 'New Event Posted!' : 'Event Request Rejected';
                        const message = status === 'approved'
                            ? `The event "${event.title}" has been approved and posted to ${event.clubs.name}'s calendar.`
                            : `Your event request for "${event.title}" in ${event.clubs.name} has been rejected. Reason: ${reason || 'None provided.'}`;
                            
                        const notifications = members.map(m => ({
                            user_id: m.user_id,
                            title: title,
                            message: message
                        }));
                        await window.sbClient.from('notifications').insert(notifications);
                    }
                    
                    eventsList.innerHTML = '';
                    eventsLoading.style.display = 'block';
                    await loadPendingEvents();
                } else {
                    window.showToast(`Failed to ${action} event.`, 'error');
                }
            } catch (e) {
                window.showToast('Error applying decision.', 'error');
                console.error(e);
            }
        });
    }

    const socialsList = document.getElementById('pending-socials-list');
    const socialsLoading = document.getElementById('loading-socials');
    const socialsEmpty = document.getElementById('empty-socials-state');

    async function loadPendingSocials() {
        try {
            const { data: pending, error } = await window.sbClient
                .from('pending_socials')
                .select('*, clubs(id, name, socials)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            socialsLoading.style.display = 'none';

            if (!pending || pending.length === 0) {
                socialsList.style.display = 'none';
                socialsEmpty.style.display = 'block';
                return;
            }

            socialsList.style.display = 'flex';
            socialsEmpty.style.display = 'none';

            socialsList.innerHTML = pending.map(soc => `
                <div class="settings-card" style="border-left: 4px solid #8b5cf6; padding: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin-top:0;">${soc.title}</h3>
                            <p style="margin: 5px 0;"><strong>Club:</strong> ${soc.clubs?.name || 'Unknown'}</p>
                            <p style="margin: 5px 0;"><strong>URL:</strong> <a href="${soc.url}" target="_blank">${soc.url}</a></p>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:10px; min-width:120px;">
                            <button onclick="handleSocialDecision('${soc.id}', 'approve', '${soc.clubs?.id}', '${soc.title}', '${soc.url}')" class="btn-primary" style="background:#10b981; border:none;">Approve</button>
                            <button onclick="handleSocialDecision('${soc.id}', 'reject')" class="btn-primary" style="background:#ef4444; border:none;">Reject</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error(e);
            socialsLoading.style.display = 'none';
        }
    }

    window.handleSocialDecision = async (id, action, clubId, title, url) => {
        promptForReason(action, async (reason) => {
            try {
                const status = action === 'approve' ? 'approved' : 'rejected';
                const { error } = await window.sbClient
                    .from('pending_socials')
                    .update({ status })
                    .eq('id', id);

                if (!error) {
                    if (status === 'approved' && clubId) {
                        const { data: clubData } = await window.sbClient.from('clubs').select('socials').eq('id', clubId).single();
                        if (clubData) {
                            const currentSocials = clubData.socials || {};
                            const platformKey = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                            currentSocials[platformKey] = url;
                            await window.sbClient.from('clubs').update({ socials: currentSocials }).eq('id', clubId);
                        }
                    }
                    
                    // Notify club members
                    const { data: members } = await window.sbClient.from('club_members').select('user_id').eq('club_id', clubId);
                    const { data: club } = await window.sbClient.from('clubs').select('name').eq('id', clubId).single();
                    if (members && members.length > 0 && club) {
                        const notifTitle = status === 'approved' ? 'Social Link Approved!' : 'Social Link Rejected';
                        const notifMessage = status === 'approved'
                            ? `The social link "${title}" has been approved and added to ${club.name}.`
                            : `Your social link request for "${title}" in ${club.name} has been rejected. Reason: ${reason || 'None provided.'}`;
                            
                        const notifications = members.map(m => ({
                            user_id: m.user_id,
                            title: notifTitle,
                            message: notifMessage
                        }));
                        await window.sbClient.from('notifications').insert(notifications);
                    }
                    
                    socialsList.innerHTML = '';
                    socialsLoading.style.display = 'block';
                    await loadPendingSocials();
                } else {
                    window.showToast(`Failed to ${action} social link.`, 'error');
                }
            } catch (e) {
                window.showToast('Error applying decision.', 'error');
                console.error(e);
            }
        });
    }

    loadPending();
    loadPendingEvents();
    loadPendingSocials();
});
