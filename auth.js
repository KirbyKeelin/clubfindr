/*  ================================================
    ClubFinder — Auth (Supabase) & Global Scripts
    ================================================  */

// Global Dark Mode Persistence
if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
}

(function () {
    const ALLOWED_DOMAIN = 'scrprep.org';

    /* ---------- Public API ---------- */

    async function registerUser(email, password, displayName) {
        email = email.trim().toLowerCase();
        displayName = displayName.trim();

        if (!email || !password || !displayName) {
            return { success: false, message: 'All fields are required.' };
        }

        if (password.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters.' };
        }

        if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
            return { success: false, message: 'You must use a @' + ALLOWED_DOMAIN + ' email address.' };
        }

        const { data, error } = await window.sbClient.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName }
            }
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true };
    }

    async function loginUser(email, password) {
        email = email.trim().toLowerCase();

        if (!email || !password) {
            return { success: false, message: 'Email and password are required.' };
        }

        const { data, error } = await window.sbClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true };
    }

    async function getCurrentUser() {
        const { data: { session } } = await window.sbClient.auth.getSession();
        if (!session) return null;

        const user = session.user;

        // Fetch profile from our profiles table
        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return {
            id: user.id,
            email: user.email,
            displayName: profile?.display_name || user.email.split('@')[0],
            username: profile?.username || user.email.split('@')[0],
            bio: profile?.bio || '',
            avatarUrl: profile?.avatar_url || null
        };
    }

    async function logout() {
        await window.sbClient.auth.signOut();
        window.location.href = 'signin.html';
    }

    async function getAccessToken() {
        const { data: { session } } = await window.sbClient.auth.getSession();
        return session?.access_token || null;
    }

    async function authHeaders() {
        const token = await getAccessToken();
        return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    /* ---------- Auth Guard ---------- */

    const path = window.location.pathname.replace(/^.*[/\\]/, '').toLowerCase();
    const isSignInPage = path === 'signin.html';
    const isSetupProfilePage = path === 'setup-profile.html';

    // We use DOMContentLoaded so body/document is ready if we need it,
    // but we can start the session check immediately.
    window.sbClient.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) {
            if (!isSignInPage) {
                window.location.href = 'signin.html';
            }
        } else {
            // User is authenticated
            const { data: profile } = await window.sbClient
                .from('profiles')
                .select('display_name')
                .eq('id', session.user.id)
                .single();

            const hasDisplayName = profile && profile.display_name && profile.display_name.trim().length > 0;

            if (!hasDisplayName && !isSetupProfilePage && !isSignInPage) {
                // Needs profile setup, but isn't on setup page
                window.location.href = 'setup-profile.html';
            } else if (hasDisplayName && isSetupProfilePage) {
                // Has profile setup, shouldn't be on setup page
                window.location.href = 'index.html';
            } else if (isSignInPage) {
                // If they are on signin but already have a session, send them to the appropriate place
                window.location.href = hasDisplayName ? 'index.html' : 'setup-profile.html';
            }
        }
    });

    /* ---------- Wire up Sign Out links + Mobile Sidebar ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        // Sign out
        document.querySelectorAll('[data-action="sign-out"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        });

        // Mobile sidebar — inject hamburger on non-signin pages
        const sidebar = document.querySelector('.sidebar-left');
        if (sidebar && !isSignInPage) {
            const hamburger = document.createElement('button');
            hamburger.className = 'mobile-hamburger';
            hamburger.setAttribute('aria-label', 'Open menu');
            hamburger.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>';
            document.body.appendChild(hamburger);

            const overlay = document.createElement('div');
            overlay.className = 'mobile-overlay';
            document.body.appendChild(overlay);

            function openSidebar() {
                sidebar.classList.add('mobile-open');
                overlay.classList.add('active');
            }

            function closeSidebar() {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
            }

            hamburger.addEventListener('click', openSidebar);
            overlay.addEventListener('click', closeSidebar);

            sidebar.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', closeSidebar);
            });
        }

        // Notification Center
        if (!isSignInPage && !isSetupProfilePage) {
            const notifContainer = document.createElement('div');
            notifContainer.id = 'notif-container';
            notifContainer.innerHTML = `
                <style>
                    #notif-bell-btn {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        z-index: 1000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.2s;
                    }
                    #notif-bell-btn:hover { transform: scale(1.05); }
                    body.dark-mode #notif-bell-btn { background: #2563eb; }
                    #notif-badge {
                        position: absolute;
                        top: -2px;
                        right: -2px;
                        background: #ef4444;
                        color: white;
                        font-size: 11px;
                        font-weight: bold;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid white;
                    }
                    body.dark-mode #notif-badge { border-color: #1f2937; }
                    #notif-dropdown {
                        position: fixed;
                        bottom: 80px;
                        right: 20px;
                        width: 320px;
                        max-height: 400px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                        z-index: 1000;
                        display: none;
                        flex-direction: column;
                        overflow-y: auto;
                        border: 1px solid #ddd;
                    }
                    body.dark-mode #notif-dropdown { background: #1f2937; border-color: #374151; color: white; }
                    .notif-header {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-weight: bold;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        background: white;
                    }
                    body.dark-mode .notif-header { border-bottom-color: #374151; background: #1f2937; }
                    .notif-item {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                    }
                    body.dark-mode .notif-item { border-bottom-color: #374151; }
                    .notif-item:hover { background: #f9fafb; }
                    body.dark-mode .notif-item:hover { background: #374151; }
                    .notif-item.unread { background: #eff6ff; }
                    body.dark-mode .notif-item.unread { background: #1e3a8a; }
                    .notif-title { font-weight: bold; margin-bottom: 5px; font-size: 14px; }
                    .notif-msg { font-size: 13px; color: #555; }
                    body.dark-mode .notif-msg { color: #9ca3af; }
                    .mark-all-btn { font-size: 12px; color: #3b82f6; cursor: pointer; border:none; background:none; }
                </style>
                <button id="notif-bell-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    <div id="notif-badge">0</div>
                </button>
                <div id="notif-dropdown">
                    <div class="notif-header">
                        <span>Notifications</span>
                        <button class="mark-all-btn" id="notif-mark-read">Mark all read</button>
                    </div>
                    <div id="notif-list"></div>
                </div>
            `;
            document.body.appendChild(notifContainer);

            const bellBtn = document.getElementById('notif-bell-btn');
            const dropdown = document.getElementById('notif-dropdown');
            const badge = document.getElementById('notif-badge');
            const list = document.getElementById('notif-list');
            const markAllBtn = document.getElementById('notif-mark-read');

            let unreadIds = [];

            bellBtn.addEventListener('click', () => {
                dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
                if(dropdown.style.display === 'flex') {
                    fetchNotifications();
                }
            });

            markAllBtn.addEventListener('click', async () => {
                if(unreadIds.length === 0) return;
                await window.sbClient.from('notifications').update({is_read: true}).in('id', unreadIds);
                await fetchNotifications();
            });

            async function fetchNotifications() {
                try {
                    const user = await getCurrentUser();
                    if(!user) return;
                    
                    const { data } = await window.sbClient
                        .from('notifications')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(20);
                    
                    if(data) {
                        const unread = data.filter(n => !n.is_read);
                        unreadIds = unread.map(n => n.id);
                        
                        if(unread.length > 0) {
                            badge.style.display = 'flex';
                            badge.textContent = unread.length;
                        } else {
                            badge.style.display = 'none';
                        }

                        if(data.length === 0) {
                            list.innerHTML = '<div style="padding:15px; text-align:center; color:#777; font-size:14px;">No notifications</div>';
                        } else {
                            list.innerHTML = data.map(n => `
                                <div class="notif-item ${n.is_read ? '' : 'unread'}">
                                    <div class="notif-title">${n.title}</div>
                                    <div class="notif-msg">${n.message}</div>
                                </div>
                            `).join('');
                        }
                    }
                } catch(e) {}
            }

            fetchNotifications();
            setInterval(fetchNotifications, 30000);
        }
    });

    /* ---------- Expose globally ---------- */
    window.ClubFinderAuth = {
        registerUser,
        loginUser,
        getCurrentUser,
        logout,
        getAccessToken,
        authHeaders
    };
})();

