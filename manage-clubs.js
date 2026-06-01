document.addEventListener('DOMContentLoaded', async () => {
    const managedArea = document.getElementById('managed-clubs-area');
    const createBtn = document.getElementById('createClubBtn');

    let currentUser = null;
    try { currentUser = await window.ClubFinderAuth.getCurrentUser(); } catch (e) { }

    async function renderManagedClubs() {
        if (!currentUser) {
            managedArea.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-contact"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"/><rect width="18" height="18" x="3" y="4" rx="2"/><circle cx="12" cy="10" r="2"/><line x1="8" x2="8" y1="2" y2="4"/><line x1="16" x2="16" y1="2" y2="4"/></svg></div><h3>Sign in to manage clubs</h3></div>';
            return;
        }

        let managed = [];
        try {
            const { data, error } = await window.sbClient
                .from('club_members')
                .select('role, clubs(*)')
                .eq('user_id', currentUser.id)
                .in('role', ['owner', 'faculty', 'leader']);
                
            if (!error && data) {
                managed = data.map(d => d.clubs).filter(c => c !== null);
            }
        } catch (err) { console.error(err); }

        if (managed.length === 0) {
            managedArea.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-contact"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"/><rect width="18" height="18" x="3" y="4" rx="2"/><circle cx="12" cy="10" r="2"/><line x1="8" x2="8" y1="2" y2="4"/><line x1="16" x2="16" y1="2" y2="4"/></svg></div><h3>You do not currently manage any clubs</h3><p>Create one below to get started!</p></div>';
            return;
        }

        let html = '<div class="managed-clubs-list">';
        managed.forEach(club => {
            html += `
                <div class="settings-card managed-club-card" onclick="window.location.href='club.html?id=${club.id}'" style="cursor: pointer;">
                    <div class="managed-club-info">
                        <h3>${club.name}</h3>
                        <p>${club.description || ''}</p>
                        ${club.tags && club.tags.length ? `<div class="managed-club-tags">${club.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}</div>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        managedArea.innerHTML = html;
    }

    await renderManagedClubs();

    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const name = document.getElementById('newClubName').value.trim();
            const desc = document.getElementById('newClubDesc').value.trim();
            const tagsRaw = document.getElementById('newClubTags').value.trim();
            const faculty = document.getElementById('newClubFaculty').value.trim();
            const info = document.getElementById('newClubInfo').value.trim();

            if (!name) { window.showToast('Please enter a club name.', 'error'); return; }
            if (!currentUser) { window.showToast('You must be signed in to create a club.', 'error'); return; }

            const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

            createBtn.textContent = 'Creating...';
            createBtn.disabled = true;

            try {
                // 1. Create the club
                const { data: newClub, error: clubErr } = await window.sbClient
                    .from('clubs')
                    .insert({
                        name,
                        description: desc,
                        tags,
                        faculty_moderator: faculty,
                        additional_info: info,
                        status: 'pending',
                        created_by: currentUser.id
                    })
                    .select()
                    .single();

                if (clubErr) throw clubErr;

                // 2. Add creator as owner
                const { error: memberErr } = await window.sbClient
                    .from('club_members')
                    .insert({
                        club_id: newClub.id,
                        user_id: currentUser.id,
                        role: 'owner'
                    });
                
                // If the trigger handle_new_club exists, the above might fail or be redundant, 
                // but we do it here just in case, catching the error if it violates unique constraint.
                if (memberErr && memberErr.code !== '23505') {
                    console.error('Failed to add owner role:', memberErr);
                }

                document.getElementById('newClubName').value = '';
                document.getElementById('newClubDesc').value = '';
                document.getElementById('newClubTags').value = '';
                document.getElementById('newClubFaculty').value = '';
                document.getElementById('newClubInfo').value = '';
                createBtn.textContent = 'Club Created!';
                createBtn.style.background = '#4CAF50';
                setTimeout(() => { createBtn.textContent = 'Create Club'; createBtn.style.background = '#1f2937'; createBtn.disabled = false; }, 2000);
                await renderManagedClubs();
            } catch (e) {
                console.error(e);
                window.showToast('Failed to create club: ' + (e.message || 'Unknown error', 'error'));
                createBtn.textContent = 'Create Club';
                createBtn.disabled = false;
            }
        });
    }
});
