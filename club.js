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
        const { data: messages } = await window.sbClient.from('messages').select('*, profiles(display_name, avatar_url)').eq('club_id', clubId).order('created_at', { ascending: true }).limit(100);

        club = {
            ...clubData,
            members: (members || []).map(m => ({
                name: m.profiles.display_name,
                email: m.profiles.email,
                avatar: m.profiles.avatar_url,
                role: m.role,
                userId: m.profiles.id
            })),
            events: events || [],
            messages: (messages || []).map(m => ({
                id: m.id,
                author: m.profiles.display_name,
                avatar: m.profiles.avatar_url,
                text: m.content,
                time: m.created_at
            }))
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

    // Realtime subscription reference
    let realtimeChannel = null;

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
        stopRealtime();
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
        stopRealtime();
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
        stopRealtime();
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

    /* ====== CHAT TAB (with Realtime) ====== */
    function renderChat() {
        stopRealtime();
        const user = currentUser;
        const initials = user ? user.displayName.split(' ').map(w => w[0]).join('') : '?';

        let msgsHtml = '';
        (club.messages || []).forEach(m => {
            msgsHtml += buildMessageHtml(m);
        });

        contentArea.innerHTML = `
            <div class="tab-chat">
                <div class="chat-composer">
                    <div class="chat-composer-avatar">${initials}</div>
                    <input type="text" class="chat-composer-input" id="chatInput" placeholder="Write something..." maxlength="500">
                    <button class="btn-primary chat-send-btn" id="chatSend">Post</button>
                </div>
                <div class="chat-stream" id="chatStream">${msgsHtml}</div>
            </div>
        `;

        const chatInput = document.getElementById('chatInput');
        const chatSend = document.getElementById('chatSend');
        const chatStream = document.getElementById('chatStream');

        async function sendMessage() {
            const text = chatInput.value.trim();
            if (!text || !user) return;
            chatInput.value = '';

            const { data: msgData, error } = await window.sbClient
                .from('messages')
                .insert({ club_id: clubId, author_id: user.id, content: text })
                .select('*, profiles(display_name, avatar_url)')
                .single();

            if (!error && msgData) {
                const msg = {
                    id: msgData.id,
                    author: msgData.profiles.display_name,
                    avatar: msgData.profiles.avatar_url,
                    text: msgData.content,
                    time: msgData.created_at
                };
                if (!document.getElementById('msg-' + msg.id)) {
                    appendMessage(chatStream, msg);
                }
            }
        }

        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
        chatStream.scrollTop = chatStream.scrollHeight;

        // Start realtime subscription
        startRealtime(chatStream);
    }

    function buildMessageHtml(m) {
        const avatarSrc = m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.author)}&background=1f2937&color=fff`;
        return `
            <div class="chat-message" id="msg-${m.id}">
                <img src="${avatarSrc}" class="chat-avatar" alt="${esc(m.author)}">
                <div class="chat-body">
                    <span class="chat-author">${esc(m.author)}</span>
                    <span class="chat-time">${formatTime(m.time)}</span>
                    <p class="chat-text">${esc(m.text)}</p>
                </div>
            </div>
        `;
    }

    function appendMessage(chatStream, msg) {
        chatStream.innerHTML += buildMessageHtml(msg);
        chatStream.scrollTop = chatStream.scrollHeight;
        club.messages.push(msg);
    }

    /* ====== SUPABASE REALTIME ====== */
    function startRealtime(chatStream) {
        realtimeChannel = window.sbClient
            .channel('club-chat-' + clubId)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: 'club_id=eq.' + clubId },
                async (payload) => {
                    const newMsg = payload.new;
                    // Skip if we already have this message
                    if (document.getElementById('msg-' + newMsg.id)) return;

                    // Fetch author info
                    const { data: profile } = await window.sbClient
                        .from('profiles')
                        .select('display_name, avatar_url')
                        .eq('id', newMsg.author_id)
                        .single();

                    const msg = {
                        id: newMsg.id,
                        author: profile?.display_name || 'Unknown',
                        avatar: profile?.avatar_url,
                        text: newMsg.content,
                        time: newMsg.created_at
                    };

                    appendMessage(chatStream, msg);
                }
            )
            .subscribe();
    }

    function stopRealtime() {
        if (realtimeChannel) {
            window.sbClient.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    }

    /* ====== CONTACT INFO TAB ====== */
    function renderContactInfo() {
        stopRealtime();
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
    const tabs = ['Main', 'Calendar', 'Members', 'Chat', 'Contact Info'];
    const renderers = [renderMain, renderCalendar, renderMembers, renderChat, renderContactInfo];

    buttons.forEach((btn, i) => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderers[i]();
        });
    });

    renderMain();
});
