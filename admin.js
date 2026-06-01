document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('pending-list');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('admin-error');

    let currentUser = null;
    try {
        currentUser = await window.ClubFinderAuth.getCurrentUser();
    } catch(e) {}

    if (!currentUser || !currentUser.isAdmin) {
        window.location.href = 'index.html';
        return;
    }

    const actionModal = document.getElementById('actionModal');
    const cancelActionBtn = document.getElementById('cancelActionBtn');
    const confirmActionBtn = document.getElementById('confirmActionBtn');
    const actionReason = document.getElementById('actionReason');
    
    // Tab Switching
    const navApprovals = document.getElementById('nav-approvals');
    const navCalendar = document.getElementById('nav-calendar');
    const approvalsTab = document.getElementById('approvalsTab');
    const calendarTab = document.getElementById('calendarTab');

    if (navApprovals && navCalendar) {
        navApprovals.addEventListener('click', (e) => {
            e.preventDefault();
            navApprovals.classList.add('active');
            navCalendar.classList.remove('active');
            approvalsTab.style.display = 'block';
            calendarTab.style.display = 'none';
        });

        navCalendar.addEventListener('click', (e) => {
            e.preventDefault();
            navCalendar.classList.add('active');
            navApprovals.classList.remove('active');
            approvalsTab.style.display = 'none';
            calendarTab.style.display = 'block';
            loadMasterCalendar();
        });
    }
    
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
        const processDecision = async (reason = '') => {
            try {
                const status = action === 'approve' ? 'approved' : 'rejected';
                const { error } = await window.sbClient
                    .from('clubs')
                    .update({ status })
                    .eq('id', id);

                if (!error) {
                    const { data: club } = await window.sbClient.from('clubs').select('created_by, name, profiles!clubs_created_by_fkey(email)').eq('id', id).single();
                    if (club && club.created_by) {
                        const title = status === 'approved' ? 'Club Approved!' : 'Club Rejected';
                        const message = status === 'approved' 
                            ? `Your request to create the club "${club.name}" has been approved.` 
                            : `Your request to create the club "${club.name}" has been rejected. Reason: ${reason || 'None provided.'}`;
                        await window.sbClient.from('notifications').insert({
                            user_id: club.created_by,
                            title: title,
                            message: message,
                            club_name: club.name
                        });
                        
                        if (status === 'rejected' && club.profiles?.email) {
                            try {
                                await window.sbClient.functions.invoke('send-event-review', {
                                    body: { type: 'rejection', email: club.profiles.email, title: `Club Creation: ${club.name}`, reason }
                                });
                            } catch(e) {}
                        }
                    }
                    
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
        };

        if (action === 'reject') {
            promptForReason(action, processDecision);
        } else {
            processDecision();
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
                            <button data-title="${ev.title.replace(/"/g, '&quot;')}" data-club="${(ev.clubs?.name || 'Unknown').replace(/"/g, '&quot;')}" onclick="handleEventDecision('${ev.id}', 'approve', '${ev.club_id}', this)" class="btn-primary" style="background:#10b981; border:none;">Approve</button>
                            <button data-title="${ev.title.replace(/"/g, '&quot;')}" data-club="${(ev.clubs?.name || 'Unknown').replace(/"/g, '&quot;')}" onclick="handleEventDecision('${ev.id}', 'reject', '${ev.club_id}', this)" class="btn-primary" style="background:#ef4444; border:none;">Reject</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error(e);
            eventsLoading.style.display = 'none';
        }
    }

    window.handleEventDecision = async (id, action, clubId, btn) => {
        const titleText = btn.getAttribute('data-title');
        const clubNameText = btn.getAttribute('data-club');

        const processDecision = async (reason = '') => {
            try {
                const status = action === 'approve' ? 'approved' : 'rejected';
                const { error } = await window.sbClient
                    .from('events')
                    .update({ status })
                    .eq('id', id);

                if (!error) {
                    const { data: members } = await window.sbClient.from('club_members').select('user_id, profiles(email)')
                        .eq('club_id', clubId)
                        .in('role', ['owner', 'leader']);
                    
                    if (members && members.length > 0) {
                        const title = status === 'approved' ? 'New Event Posted!' : 'Event Request Rejected';
                        const message = status === 'approved'
                            ? `The event "${titleText}" has been approved and posted to ${clubNameText}'s calendar.`
                            : `Your event request for "${titleText}" in ${clubNameText} has been rejected. Reason: ${reason || 'None provided.'}`;
                            
                        const notifications = members.map(m => ({
                            user_id: m.user_id,
                            title: title,
                            message: message,
                            club_name: clubNameText,
                            link: 'club.html?id=' + clubId + '&event=' + id
                        }));
                        await window.sbClient.from('notifications').insert(notifications);
                        
                        try {
                            const emails = members.map(m => m.profiles?.email).filter(Boolean);
                            if (emails.length > 0) {
                                if (status === 'rejected') {
                                    await window.sbClient.functions.invoke('send-event-review', {
                                        body: { type: 'rejection', email: emails, title: `Event Request: ${titleText} (${clubNameText})`, reason }
                                    });
                                } else if (status === 'approved') {
                                    await window.sbClient.functions.invoke('send-event-review', {
                                        body: { type: 'approval', email: emails, title: `Event Request: ${titleText} (${clubNameText})` }
                                    });
                                }
                            }
                        } catch(e) {
                            console.error('Failed to send event decision email', e);
                        }
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
        };

        if (action === 'reject') {
            promptForReason(action, processDecision);
        } else {
            processDecision();
        }
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
                            <button data-title="${soc.title.replace(/"/g, '&quot;')}" data-club="${(soc.clubs?.name || 'Unknown').replace(/"/g, '&quot;')}" data-url="${soc.url.replace(/"/g, '&quot;')}" onclick="handleSocialDecision('${soc.id}', 'approve', '${soc.clubs?.id}', this)" class="btn-primary" style="background:#10b981; border:none;">Approve</button>
                            <button data-title="${soc.title.replace(/"/g, '&quot;')}" data-club="${(soc.clubs?.name || 'Unknown').replace(/"/g, '&quot;')}" data-url="${soc.url.replace(/"/g, '&quot;')}" onclick="handleSocialDecision('${soc.id}', 'reject', '${soc.clubs?.id}', this)" class="btn-primary" style="background:#ef4444; border:none;">Reject</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error(e);
            socialsLoading.style.display = 'none';
        }
    }

    window.handleSocialDecision = async (id, action, clubId, btn) => {
        const titleText = btn.getAttribute('data-title');
        const clubNameText = btn.getAttribute('data-club');
        const urlText = btn.getAttribute('data-url');

        const processDecision = async (reason = '') => {
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
                            const platformKey = titleText.toLowerCase().replace(/[^a-z0-9]/g, '');
                            currentSocials[platformKey] = urlText;
                            await window.sbClient.from('clubs').update({ socials: currentSocials }).eq('id', clubId);
                        }
                    }
                    
                    // Notify club members
                    const { data: members } = await window.sbClient.from('club_members').select('user_id, profiles(email)')
                        .eq('club_id', clubId)
                        .in('role', ['owner', 'leader']);
                    if (members && members.length > 0) {
                        const notifTitle = status === 'approved' ? 'Social Link Approved!' : 'Social Link Rejected';
                        const notifMessage = status === 'approved'
                            ? `The social link "${titleText}" has been approved and added to ${clubNameText}.`
                            : `Your social link request for "${titleText}" in ${clubNameText} has been rejected. Reason: ${reason || 'None provided.'}`;
                            
                        const notifications = members.map(m => ({
                            user_id: m.user_id,
                            title: notifTitle,
                            message: notifMessage,
                            club_name: clubNameText
                        }));
                        await window.sbClient.from('notifications').insert(notifications);
                        
                        try {
                            const emails = members.map(m => m.profiles?.email).filter(Boolean);
                            if (emails.length > 0) {
                                if (status === 'rejected') {
                                    await window.sbClient.functions.invoke('send-event-review', {
                                        body: { type: 'rejection', email: emails, title: `Social Link: ${titleText} (${clubNameText})`, reason }
                                    });
                                } else if (status === 'approved') {
                                    await window.sbClient.functions.invoke('send-event-review', {
                                        body: { type: 'approval', email: emails, title: `Social Link: ${titleText} (${clubNameText})` }
                                    });
                                }
                            }
                        } catch(e) {}
                        }
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
        };

        if (action === 'reject') {
            promptForReason(action, processDecision);
        } else {
            processDecision();
        }
    }

    let masterCalendarDate = new Date();

    async function loadMasterCalendar() {
        const year = masterCalendarDate.getFullYear();
        const month = masterCalendarDate.getMonth();
        const monthName = masterCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        try {
            const { data: events, error } = await window.sbClient
                .from('events')
                .select('*, clubs(name)')
                .eq('status', 'approved')
                .order('start_time', { ascending: true });

            if (error) throw error;

            const monthEvents = events.filter(ev => {
                const d = new Date(ev.start_time);
                return d.getFullYear() === year && d.getMonth() === month;
            });

            let cells = '';
            for (let i = 0; i < firstDay; i++) cells += '<div class="cal-cell empty"></div>';

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayEvents = monthEvents.filter(ev => {
                    const ed = new Date(ev.start_time);
                    return ed.getDate() === d;
                });
                let evHtml = '';
                dayEvents.forEach(ev => {
                    const evJson = JSON.stringify(ev).replace(/"/g, '&quot;');
                    evHtml += `<div class="cal-event" style="background:${ev.color || '#3b82f6'}; cursor:pointer;" onclick="showAdminEventModal(${evJson})">${esc(ev.title)} <small style="opacity:0.8">(${esc(ev.clubs?.name || '')})</small></div>`;
                });
                cells += `<div class="cal-cell"><span class="cal-date">${d}</span>${evHtml}</div>`;
            }

            const contentArea = document.getElementById('masterCalendarContent');
            contentArea.innerHTML = `
                <div class="tab-calendar">
                    <div class="cal-header">
                        <button class="cal-nav" id="mCalPrev">◀</button>
                        <h3>${monthName}</h3>
                        <button class="cal-nav" id="mCalNext">▶</button>
                    </div>
                    <div class="cal-grid">
                        <div class="cal-day-label">Sun</div><div class="cal-day-label">Mon</div>
                        <div class="cal-day-label">Tue</div><div class="cal-day-label">Wed</div>
                        <div class="cal-day-label">Thu</div><div class="cal-day-label">Fri</div>
                        <div class="cal-day-label">Sat</div>
                        ${cells}
                    </div>
                </div>
            `;

            document.getElementById('mCalPrev').addEventListener('click', () => { masterCalendarDate.setMonth(masterCalendarDate.getMonth() - 1); loadMasterCalendar(); });
            document.getElementById('mCalNext').addEventListener('click', () => { masterCalendarDate.setMonth(masterCalendarDate.getMonth() + 1); loadMasterCalendar(); });

        } catch (e) {
            console.error(e);
            window.showToast('Failed to load master calendar.', 'error');
        }
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    window.showAdminEventModal = function(ev) {
        document.getElementById('adminModalEvTitle').textContent = ev.title;
        document.getElementById('adminModalEvClub').textContent = ev.clubs?.name || 'Unknown';
        
        const dStart = new Date(ev.start_time);
        document.getElementById('adminModalEvStart').textContent = dStart.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        
        if (ev.end_time) {
            document.getElementById('adminModalEvEndContainer').style.display = 'block';
            const dEnd = new Date(ev.end_time);
            document.getElementById('adminModalEvEnd').textContent = dEnd.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        } else {
            document.getElementById('adminModalEvEndContainer').style.display = 'none';
        }
        
        document.getElementById('adminModalEvDesc').textContent = ev.description || 'No description provided.';
        document.getElementById('adminModalEvEditForm').style.display = 'none';
        
        const editBtn = document.getElementById('adminModalEditBtn');
        const deleteBtn = document.getElementById('adminModalDeleteBtn');
        
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this event? This cannot be undone.')) {
                const { error } = await window.sbClient.from('events').delete().eq('id', ev.id);
                if (error) {
                    window.showToast('Failed to delete event.', 'error');
                } else {
                    window.showToast('Event deleted successfully.', 'success');
                    document.getElementById('adminEventModal').style.display = 'none';
                    loadMasterCalendar();
                }
            }
        });
        
        newEditBtn.addEventListener('click', () => {
            document.getElementById('adminModalEvEditForm').style.display = 'block';
            document.getElementById('adminEditEvTitle').value = ev.title;
            document.getElementById('adminEditEvDesc').value = ev.description || '';
            document.getElementById('adminEditEvStart').value = ev.start_time ? ev.start_time.slice(0, 16) : '';
            document.getElementById('adminEditEvEnd').value = ev.end_time ? ev.end_time.slice(0, 16) : '';
        });
        
        const saveEditBtn = document.getElementById('adminSaveEditEvBtn');
        const newSaveEditBtn = saveEditBtn.cloneNode(true);
        saveEditBtn.parentNode.replaceChild(newSaveEditBtn, saveEditBtn);
        
        newSaveEditBtn.addEventListener('click', async () => {
            const title = document.getElementById('adminEditEvTitle').value;
            const desc = document.getElementById('adminEditEvDesc').value;
            const start = document.getElementById('adminEditEvStart').value;
            const end = document.getElementById('adminEditEvEnd').value;
            
            if(!title || !start) return window.showToast('Title and Start Time required.', 'error');
            
            // Edit forces re-approval
            const { error } = await window.sbClient.from('events').update({
                title, description: desc, start_time: start, end_time: end || null, status: 'pending'
            }).eq('id', ev.id);
            
            if (error) {
                window.showToast('Failed to edit event.', 'error');
            } else {
                window.showToast('Event updated. It is now pending re-approval.', 'success');
                document.getElementById('adminEventModal').style.display = 'none';
                loadMasterCalendar();
                loadPendingEvents();
            }
        });
        
        document.getElementById('adminCancelEditEvBtn').onclick = () => {
            document.getElementById('adminModalEvEditForm').style.display = 'none';
        };

        document.getElementById('adminEventModal').style.display = 'flex';
    };

    loadPending();
    loadPendingEvents();
    loadPendingSocials();
});
