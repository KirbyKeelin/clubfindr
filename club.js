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

        const { data: members } = await window.sbClient.from('club_members').select('role, joined_at, profiles(id, display_name, email, avatar_url)').eq('club_id', clubId);
        const { data: events } = await window.sbClient.from('events').select('*').eq('club_id', clubId).order('start_time', { ascending: true });
        club = {
            ...clubData,
            members: (members || []).map(m => ({
                name: m.profiles.display_name,
                email: m.profiles.email,
                avatar: m.profiles.avatar_url,
                role: m.role,
                userId: m.profiles.id
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
                evHtml += `<div class="cal-event" style="background:${ev.color || '#3b82f6'}">${esc(ev.title)}</div>`;
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
        `;
        document.getElementById('calPrev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
        document.getElementById('calNext').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    }

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

    /* ====== TAB SWITCHING ====== */
    const tabs = ['Main', 'Calendar', 'Members', 'Contact Info', 'Socials'];
    const renderers = [renderMain, renderCalendar, renderMembers, renderContactInfo, renderSocials];

    buttons.forEach((btn, i) => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderers[i]();
        });
    });

    renderMain();
});
