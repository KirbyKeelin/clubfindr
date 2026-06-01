document.addEventListener('DOMContentLoaded', async () => {
    const buttons = document.querySelectorAll('.club-top-nav button');
    const contentArea = document.getElementById('clubContent');

    const urlParams = new URLSearchParams(window.location.search);
    const clubId = urlParams.get('id');

    if (!clubId) {
        contentArea.innerHTML = '<p>No club selected.</p>';
        return;
    }

    // Show loading
    contentArea.innerHTML = '<p class="loading-text">Loading club...</p>';

    // Fetch club data
    let club = null;
    try {
        const { data: clubData, error: clubErr } = await window.sbClient.from('clubs').select('*').eq('id', clubId).single();
        if (clubErr) throw clubErr;

        const { data: members } = await window.sbClient.from('club_members').select('user_id, role, joined_at, profiles(id, display_name, email, avatar_url)').eq('club_id', clubId);
        const { data: events } = await window.sbClient.from('events').select('*').eq('club_id', clubId).eq('status', 'approved').order('start_time', { ascending: true });
        club = {
            ...clubData,
            members: (members || []).map(m => ({
                name: m.profiles.display_name,
                email: m.profiles.email,
                avatar: m.profiles?.avatar_url,
                role: m.role,
                userId: m.user_id
            })),
            events: events || []
        };
    } catch (err) {
        console.error(err);
        contentArea.innerHTML = '<p class="error-text">Failed to load club data.</p>';
        return;
    }

    document.getElementById('clubTitle').textContent = club.name;
    const bannerImg = document.querySelector('.club-banner img');
    if (bannerImg) bannerImg.src = club.banner_url || 'https://picsum.photos/1200/400?random=10';

    let currentUser = null;
    try { currentUser = await window.ClubFinderAuth.getCurrentUser(); } catch (e) {}

    const manageBtn = document.getElementById('manageTabBtn');
    if (currentUser && club.members) {
        const myMember = club.members.find(m => m.userId === currentUser.id);
        if (myMember && myMember.role && ['owner', 'leader', 'faculty'].includes(myMember.role.toLowerCase())) {
            if (manageBtn) manageBtn.style.display = 'inline-block';
        }
    }

    let calendarDate = new Date();


    function isJoined() {
        if (!currentUser || !club.members) return false;
        return club.members.some(m => m.userId === currentUser.id);
    }

    async function toggleJoin() {
        if (!currentUser) return;

        if (isJoined()) {
            await window.sbClient.from('club_members').delete().eq('club_id', clubId).eq('user_id', currentUser.id);
            club.members = club.members.filter(m => m.userId !== currentUser.id);
        } else {
            await window.sbClient.from('club_members').insert({ club_id: clubId, user_id: currentUser.id, role: 'club_member' });
            club.members.push({
                name: currentUser.displayName,
                email: currentUser.email,
                avatar: currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=1f2937&color=fff`,
                role: 'club_member',
                userId: currentUser.id
            });
        }
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatTime(isoStr) {
        const d = new Date(isoStr);
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    /* ====== MAIN TAB ====== */
    function renderMain() {
        const joined = isJoined();
        contentArea.innerHTML = `
            <div class="tab-main">
                <div class="tab-main-header">
                    <h2>${club.name}</h2>
                    <button class="join-btn ${joined ? 'joined' : ''}" id="joinLeaveBtn">
                        ${joined ? 'Leave Club' : 'Join Club'}
                    </button>
                </div>
                <p class="tab-main-desc">${club.description}</p>
                <div class="tab-main-stats">
                    <div class="stat-card">
                        <span class="stat-number">${club.members.length}</span>
                        <span class="stat-label">Members</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${club.events.length}</span>
                        <span class="stat-label">Events</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${club.members.filter(m => m.role === 'leader').length}</span>
                        <span class="stat-label">Leaders</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('joinLeaveBtn').addEventListener('click', async () => {
            await toggleJoin();
            renderMain();
        });
    }

    /* ====== CALENDAR TAB ====== */
    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const monthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const monthEvents = (club.events || []).filter(ev => {
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
                evHtml += `<div class="cal-event" style="background:${ev.color || '#3b82f6'}; cursor:pointer;" onclick="showEventModal(${evJson})">${esc(ev.title)}</div>`;
            });
            cells += `<div class="cal-cell"><span class="cal-date">${d}</span>${evHtml}</div>`;
        }

        contentArea.innerHTML = `
            <div class="tab-calendar">
                <div class="cal-header">
                    <button class="cal-nav" id="calPrev">◀</button>
                    <h3>${monthName}</h3>
                    <button class="cal-nav" id="calNext">▶</button>
                </div>
                <div class="cal-grid">
                    <div class="cal-day-label">Sun</div><div class="cal-day-label">Mon</div>
                    <div class="cal-day-label">Tue</div><div class="cal-day-label">Wed</div>
                    <div class="cal-day-label">Thu</div><div class="cal-day-label">Fri</div>
                    <div class="cal-day-label">Sat</div>
                    ${cells}
                </div>
            </div>
            
            <!-- Event Modal Container -->
            <div id="eventModal" class="event-modal-overlay">
                <div class="event-modal-content">
                    <div class="event-modal-header">
                        <h2 id="modalEvTitle"></h2>
                        <button onclick="document.getElementById('eventModal').style.display='none'" class="event-modal-close">&times;</button>
                    </div>
                    <p style="margin: 5px 0;"><strong>Start:</strong> <span id="modalEvStart"></span></p>
                    <p id="modalEvEndContainer" style="display:none; margin: 5px 0;"><strong>End:</strong> <span id="modalEvEnd"></span></p>
                    <p style="margin: 15px 0 5px 0;"><strong>Description:</strong></p>
                    <div id="modalEvDesc" class="event-modal-desc"></div>
                    
                    <div id="modalEvManageContainer" class="event-modal-manage" style="display:none;">
                        <h4 style="margin-top:0;">Manage Event</h4>
                        <div class="event-modal-btn-row">
                            <button id="modalEditBtn" class="btn-primary" style="background:#f59e0b; border:none; padding:8px 15px; color:white;">Edit Event</button>
                            <button id="modalDeleteBtn" class="btn-primary" style="background:#ef4444; border:none; padding:8px 15px; color:white;">Delete Event</button>
                        </div>
                    </div>
                    
                    <!-- Edit Form -->
                    <div id="modalEvEditForm" class="event-modal-manage" style="display:none;">
                        <h4 style="margin-top:0;">Edit Event (Requires Re-Approval)</h4>
                        <div class="event-modal-form-group"><label>Title</label><input type="text" id="editEvTitle"></div>
                        <div class="event-modal-form-group"><label>Description</label><textarea id="editEvDesc" rows="3"></textarea></div>
                        <div class="event-modal-form-group"><label>Start</label><input type="datetime-local" id="editEvStart"></div>
                        <div class="event-modal-form-group"><label>End</label><input type="datetime-local" id="editEvEnd"></div>
                        <div class="event-modal-btn-row">
                            <button id="saveEditEvBtn" class="btn-primary" style="background:#10b981; border:none; color:white;">Submit Changes</button>
                            <button id="cancelEditEvBtn" class="btn-primary" style="background:#6b7280; border:none; color:white;">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('calPrev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
        document.getElementById('calNext').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    }

    window.showEventModal = function(ev) {
        document.getElementById('modalEvTitle').textContent = ev.title;
        document.getElementById('modalEvStart').textContent = formatTime(ev.start_time);
        
        if (ev.end_time) {
            document.getElementById('modalEvEndContainer').style.display = 'block';
            document.getElementById('modalEvEnd').textContent = formatTime(ev.end_time);
        } else {
            document.getElementById('modalEvEndContainer').style.display = 'none';
        }
        
        document.getElementById('modalEvDesc').textContent = ev.description || 'No description provided.';
        
        // Check permissions
        let canManage = false;
        if (currentUser) {
            if (currentUser.isAdmin) canManage = true;
            if (club.members) {
                const myMember = club.members.find(m => m.userId === currentUser.id);
                if (myMember && ['owner', 'leader', 'faculty'].includes(myMember.role?.toLowerCase())) {
                    canManage = true;
                }
            }
        }
        
        document.getElementById('modalEvManageContainer').style.display = canManage ? 'block' : 'none';
        document.getElementById('modalEvEditForm').style.display = 'none';
        
        // Setup buttons
        const editBtn = document.getElementById('modalEditBtn');
        const deleteBtn = document.getElementById('modalDeleteBtn');
        
        // Clone to remove old listeners
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this event? This cannot be undone.')) {
                const { error } = await window.sbClient.from('events').delete().eq('id', ev.id);
                if (error) {
                    window.showToast('Failed to delete event: ' + error.message, 'error');
                } else {
                    window.showToast('Event deleted successfully.', 'success');
                    club.events = club.events.filter(e => e.id !== ev.id);
                    document.getElementById('eventModal').style.display = 'none';
                    renderCalendar(); // Re-render
                }
            }
        });
        
        newEditBtn.addEventListener('click', () => {
            document.getElementById('modalEvManageContainer').style.display = 'none';
            document.getElementById('modalEvEditForm').style.display = 'block';
            
            document.getElementById('editEvTitle').value = ev.title;
            document.getElementById('editEvDesc').value = ev.description || '';
            document.getElementById('editEvStart').value = ev.start_time ? ev.start_time.slice(0, 16) : '';
            document.getElementById('editEvEnd').value = ev.end_time ? ev.end_time.slice(0, 16) : '';
        });
        
        const saveEditBtn = document.getElementById('saveEditEvBtn');
        const newSaveEditBtn = saveEditBtn.cloneNode(true);
        saveEditBtn.parentNode.replaceChild(newSaveEditBtn, saveEditBtn);
        
        newSaveEditBtn.addEventListener('click', async () => {
            const title = document.getElementById('editEvTitle').value;
            const desc = document.getElementById('editEvDesc').value;
            const start = document.getElementById('editEvStart').value;
            const end = document.getElementById('editEvEnd').value;
            
            if(!title || !start) return window.showToast('Title and Start Time required.', 'error');
            
            const { error } = await window.sbClient.from('events').update({
                title, description: desc, start_time: start, end_time: end || null, status: 'pending'
            }).eq('id', ev.id);
            
            if (error) {
                window.showToast('Failed to edit event.', 'error');
            } else {
                window.showToast('Event updated and sent for re-approval.', 'success');
                club.events = club.events.filter(e => e.id !== ev.id); // Remove from calendar until approved
                document.getElementById('eventModal').style.display = 'none';
                renderCalendar();
                
                try {
                    await window.sbClient.functions.invoke('send-event-review', {
                        body: { clubId: club.id, title, description: desc, start, end }
                    });
                } catch(e) {}
            }
        });
        
        document.getElementById('cancelEditEvBtn').onclick = () => {
            document.getElementById('modalEvManageContainer').style.display = 'block';
            document.getElementById('modalEvEditForm').style.display = 'none';
        };

        document.getElementById('eventModal').style.display = 'flex';
    };

    /* ====== MEMBERS TAB ====== */
    function renderMembers() {
        const leaders = club.members.filter(m => m.role === 'owner' || m.role === 'leader' || m.role === 'faculty');
        const members = club.members.filter(m => m.role === 'club_member');

        function memberCards(arr) {
            return arr.map(m => `
                <div class="member-card">
                    <img src="${m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1f2937&color=fff`}" alt="${esc(m.name)}">
                    <span class="member-name">${esc(m.name)}</span>
                </div>
            `).join('');
        }

        contentArea.innerHTML = `
            <div class="tab-members">
                ${leaders.length ? `<div class="members-section"><h3>Leadership & Faculty</h3><div class="members-row">${memberCards(leaders)}</div></div>` : ''}
                ${members.length ? `<div class="members-section"><h3>Members</h3><div class="members-row">${memberCards(members)}</div></div>` : ''}
                ${club.members.length === 0 ? '<p style="padding:30px;">No members yet. Be the first to join!</p>' : ''}
            </div>
        `;
    }

    /* ====== SOCIALS TAB ====== */
    function renderSocials() {
        const socials = club.socials || {};
        let html = '<div class="tab-socials" style="padding: 30px;">';
        if (Object.keys(socials).length === 0) {
            html += '<p>No social links provided.</p>';
        } else {
            html += '<ul style="list-style: none; padding: 0;">';
            if (socials.instagram) html += `<li style="margin-bottom:15px;"><a href="${esc(socials.instagram)}" target="_blank" style="color:#1f2937; font-size:18px; font-weight:bold; text-decoration:none;">📷 Instagram</a></li>`;
            if (socials.twitter) html += `<li style="margin-bottom:15px;"><a href="${esc(socials.twitter)}" target="_blank" style="color:#1f2937; font-size:18px; font-weight:bold; text-decoration:none;">🐦 Twitter</a></li>`;
            if (socials.website) html += `<li style="margin-bottom:15px;"><a href="${esc(socials.website)}" target="_blank" style="color:#1f2937; font-size:18px; font-weight:bold; text-decoration:none;">🌐 Website</a></li>`;
            html += '</ul>';
        }
        html += '</div>';
        contentArea.innerHTML = html;
    }

    /* ====== CONTACT INFO TAB ====== */
    function renderContactInfo() {
        const contacts = club.members.filter(m => m.role === 'leader' || m.role === 'moderator');
        let html = '<div class="tab-contact">';
        if (contacts.length === 0) {
            html += '<p style="padding:30px;">No contact information available.</p>';
        } else {
            contacts.forEach(c => {
                html += `
                    <div class="contact-card">
                        <img src="${c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1f2937&color=fff`}" alt="${esc(c.name)}">
                        <div>
                            <h4>${esc(c.name)}</h4>
                            <span class="contact-role">${c.role}</span>
                            ${c.email ? `<p class="contact-email">${esc(c.email)}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        html += '</div>';
        contentArea.innerHTML = html;
    }

    /* ====== MANAGE TAB ====== */
    function renderManage() {
        contentArea.innerHTML = `
            <div class="tab-manage" style="padding: 30px;">
                <h3>Manage Club</h3>
                
                <div class="settings-card" style="margin-bottom: 20px;">
                    <h4>Edit Club Info</h4>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="editDesc" rows="3" style="width:100%; border:1px solid #ddd; padding:8px;">${esc(club.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Banner Image</label>
                        <input type="file" id="editBannerFile" accept="image/*" style="width:100%; border:1px solid #ddd; padding:8px;">
                        <input type="hidden" id="editBannerUrl" value="${esc(club.banner_url || '')}">
                    </div>
                    <button class="btn-primary" id="saveInfoBtn">Save Info</button>
                </div>

                <div class="settings-card" style="margin-bottom: 20px;">
                    <h4>Request to Add Social Link</h4>
                    <p style="font-size:14px; color:#555;">Links must be approved by an Admin.</p>
                    <div class="form-group">
                        <label>Platform/Title (e.g. Instagram, Discord)</label>
                        <input type="text" id="socialTitle" placeholder="Instagram" style="width:100%; border:1px solid #ddd; padding:8px;">
                    </div>
                    <div class="form-group">
                        <label>URL</label>
                        <input type="url" id="socialUrl" placeholder="https://..." style="width:100%; border:1px solid #ddd; padding:8px;">
                    </div>
                    <button class="btn-primary" id="reqSocialBtn">Submit Link for Approval</button>
                </div>

                <div class="settings-card">
                    <h4>Request to Post Event</h4>
                    <p style="font-size:14px; color:#555;">Events require faculty/admin approval before they go live on the calendar.</p>
                    <div class="form-group">
                        <label>Event Title</label>
                        <input type="text" id="evTitle" placeholder="e.g. First Meeting" style="width:100%; border:1px solid #ddd; padding:8px;">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="evDesc" rows="3" placeholder="What is this event about?" style="width:100%; border:1px solid #ddd; padding:8px;"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Start Time</label>
                        <input type="datetime-local" id="evStart" style="width:100%; border:1px solid #ddd; padding:8px;">
                    </div>
                    <div class="form-group">
                        <label>End Time</label>
                        <input type="datetime-local" id="evEnd" style="width:100%; border:1px solid #ddd; padding:8px;">
                    </div>
                    <button class="btn-primary" id="reqEventBtn">Submit Event for Review</button>
                </div>
            </div>
        `;

        setTimeout(() => {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const minDateTime = now.toISOString().slice(0, 16);
            document.getElementById('evStart').min = minDateTime;
            document.getElementById('evEnd').min = minDateTime;
            
            let cropper = null;
            const bannerInput = document.getElementById('editBannerFile');
            const cropperModal = document.getElementById('cropperModal');
            const cropperImage = document.getElementById('cropperImage');
            const applyCropBtn = document.getElementById('applyCropBtn');
            const cancelCropBtn = document.getElementById('cancelCropBtn');
            const bannerUrlInput = document.getElementById('editBannerUrl');

            bannerInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    cropperImage.src = event.target.result;
                    cropperModal.style.display = 'flex';
                    if (cropper) cropper.destroy();
                    cropper = new Cropper(cropperImage, {
                        aspectRatio: 3 / 1,
                        viewMode: 1
                    });
                };
                reader.readAsDataURL(file);
            });

            cancelCropBtn.addEventListener('click', () => {
                cropperModal.style.display = 'none';
                bannerInput.value = '';
                if (cropper) cropper.destroy();
            });

            applyCropBtn.addEventListener('click', async () => {
                if (!cropper) return;
                applyCropBtn.disabled = true;
                applyCropBtn.textContent = 'Uploading...';
                
                cropper.getCroppedCanvas({ width: 1200, height: 400 }).toBlob(async (blob) => {
                    if (!blob) {
                        window.showToast('Crop failed', 'error');
                        applyCropBtn.disabled = false;
                        applyCropBtn.textContent = 'Apply & Upload';
                        return;
                    }
                    const fileName = `banner-${clubId}-${Date.now()}.jpg`;
                    const { data, error } = await window.sbClient.storage
                        .from('banners')
                        .upload(fileName, blob, { contentType: 'image/jpeg' });
                        
                    if (error) {
                        window.showToast('Upload failed: ' + error.message, 'error');
                    } else {
                        const { data: publicData } = window.sbClient.storage.from('banners').getPublicUrl(fileName);
                        bannerUrlInput.value = publicData.publicUrl;
                        window.showToast('Image uploaded! Click "Save Info" to confirm.', 'success');
                        cropperModal.style.display = 'none';
                    }
                    applyCropBtn.disabled = false;
                    applyCropBtn.textContent = 'Apply & Upload';
                }, 'image/jpeg', 0.8);
            });

            document.getElementById('saveInfoBtn').addEventListener('click', async () => {
                const desc = document.getElementById('editDesc').value;
                const banner = document.getElementById('editBannerUrl').value;
                await window.sbClient.from('clubs').update({ description: desc, banner_url: banner }).eq('id', clubId);
                club.description = desc;
                club.banner_url = banner;
                document.getElementById('clubTitle').textContent = club.name;
                const bannerImg = document.querySelector('.club-banner img');
                if (bannerImg) bannerImg.src = club.banner_url || 'https://picsum.photos/1200/400?random=10';
                window.showToast('Club info updated!', 'success');
            });

            document.getElementById('reqSocialBtn').addEventListener('click', async () => {
                const title = document.getElementById('socialTitle').value.trim();
                const url = document.getElementById('socialUrl').value.trim();
                if (!title || !url) return window.showToast('Please enter both title and URL.', 'error');
                
                const { error } = await window.sbClient.from('pending_socials').insert({
                    club_id: clubId,
                    title: title,
                    url: url,
                    status: 'pending',
                    created_by: currentUser.id
                });
                
                if (error) window.showToast('Error submitting request: ' + error.message, 'error');
                else {
                    window.showToast('Social link request submitted to admin for approval!', 'success');
                    document.getElementById('socialTitle').value = '';
                    document.getElementById('socialUrl').value = '';
                }
            });

            document.getElementById('reqEventBtn').addEventListener('click', async () => {
                const title = document.getElementById('evTitle').value;
                const desc = document.getElementById('evDesc').value;
                const start = document.getElementById('evStart').value;
                const end = document.getElementById('evEnd').value;
                if(!title || !start) { window.showToast('Title and Start Time required.', 'error'); return; }
                if(end && new Date(end) <= new Date(start)) { window.showToast('End time must be after start time.', 'error'); return; }
                
                const { error } = await window.sbClient.from('events').insert({
                    club_id: clubId,
                    title: title,
                    description: desc,
                    start_time: start,
                    end_time: end || null,
                    status: 'pending'
                });
                
                if(error) {
                    window.showToast('Failed to request event: ' + error.message, 'error');
                } else {
                    window.showToast('Event requested! Awaiting approval.', 'success');
                    document.getElementById('evTitle').value = '';
                    document.getElementById('evDesc').value = '';
                    document.getElementById('evStart').value = '';
                    document.getElementById('evEnd').value = '';
                    
                    try {
                        await window.sbClient.functions.invoke('send-event-review', {
                            body: { clubId, title, description: desc, start, end }
                        });
                    } catch(e) { console.error('Email notification error:', e); }
                }
            });
        }, 0);
    }

    /* ====== TAB SWITCHING ====== */
    const allButtons = document.querySelectorAll('.club-top-nav button');
    const tabs = ['Main', 'Calendar', 'Members', 'Contact Info', 'Socials', 'Manage'];
    const renderers = [renderMain, renderCalendar, renderMembers, renderContactInfo, renderSocials, renderManage];

    allButtons.forEach((btn, i) => {
        btn.addEventListener('click', () => {
            allButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderers[i]();
        });
    });

    const targetEventId = urlParams.get('event');
    if (targetEventId) {
        allButtons.forEach(b => b.classList.remove('active'));
        if (allButtons[1]) allButtons[1].classList.add('active'); // Calendar tab
        renderCalendar();
        setTimeout(() => {
            const ev = club.events.find(e => e.id === targetEventId);
            if (ev) window.showEventModal(ev);
        }, 100);
    } else {
        renderMain();
    }
});
