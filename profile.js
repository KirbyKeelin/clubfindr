document.addEventListener('DOMContentLoaded', async () => {
    const profileLoading = document.getElementById('profileLoading');
    const profileContent = document.getElementById('profileContent');

    const profileImage = document.getElementById('profileImage');
    const displayUsername = document.getElementById('displayUsername');
    const displayName = document.getElementById('displayName');
    const displayBio = document.getElementById('displayBio');

    const editProfileBtn = document.getElementById('editProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    
    const profileViewMode = document.getElementById('profileViewMode');
    const profileEditMode = document.getElementById('profileEditMode');
    
    const editName = document.getElementById('editName');
    const editBio = document.getElementById('editBio');
    
    const avatarOverlay = document.getElementById('avatarOverlay');
    const avatarUpload = document.getElementById('avatarUpload');

    let currentUser = null;
    let currentProfile = null;

    async function loadProfile() {
        try {
            const { data: { session } } = await window.sbClient.auth.getSession();
            if (!session) {
                window.location.href = 'signin.html';
                return;
            }
            currentUser = session.user;

            const { data: profile, error } = await window.sbClient
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            if (error) throw error;
            currentProfile = profile;

            // Update UI
            displayUsername.textContent = profile.email.split('@')[0];
            displayName.textContent = profile.display_name || 'No Display Name';
            displayBio.textContent = profile.bio || 'No bio provided.';
            
            if (profile.avatar_url) {
                profileImage.src = profile.avatar_url;
            } else {
                const encodedName = encodeURIComponent(profile.display_name || profile.email.split('@')[0]);
                profileImage.src = `https://ui-avatars.com/api/?name=${encodedName}&size=150&background=random`;
            }

            // Populate edit fields
            editName.value = profile.display_name || '';
            editBio.value = profile.bio || '';
            if (profile.avatar_url) {
                avatarUpload.value = profile.avatar_url;
            }

            profileLoading.style.display = 'none';
            profileContent.style.display = 'flex';

        } catch (error) {
            console.error('Error loading profile:', error);
            profileLoading.innerHTML = `<h3 style="color:red;">Error loading profile.</h3>`;
        }
    }

    // Toggle Edit Mode
    editProfileBtn.addEventListener('click', () => {
        profileViewMode.style.display = 'none';
        profileEditMode.style.display = 'block';
        editProfileBtn.style.display = 'none';
        saveProfileBtn.style.display = 'inline-block';
        
        avatarOverlay.style.display = 'flex';
        avatarUpload.style.display = 'block';
    });

    // Save Profile
    saveProfileBtn.addEventListener('click', async () => {
        saveProfileBtn.textContent = 'Saving...';
        saveProfileBtn.disabled = true;

        const newName = editName.value.trim();
        const newBio = editBio.value.trim();
        const newAvatarUrl = avatarUpload.value.trim();

        try {
            const { error } = await window.sbClient
                .from('profiles')
                .update({
                    display_name: newName,
                    bio: newBio,
                    avatar_url: newAvatarUrl || null
                })
                .eq('id', currentUser.id);

            if (error) throw error;

            // Update local state and UI
            currentProfile.display_name = newName;
            currentProfile.bio = newBio;
            currentProfile.avatar_url = newAvatarUrl || null;

            displayName.textContent = newName || 'No Display Name';
            displayBio.textContent = newBio || 'No bio provided.';
            
            if (newAvatarUrl) {
                profileImage.src = newAvatarUrl;
            } else {
                const encodedName = encodeURIComponent(newName || currentProfile.email.split('@')[0]);
                profileImage.src = `https://ui-avatars.com/api/?name=${encodedName}&size=150&background=random`;
            }

            // Exit edit mode
            profileEditMode.style.display = 'none';
            profileViewMode.style.display = 'block';
            saveProfileBtn.style.display = 'none';
            editProfileBtn.style.display = 'inline-block';
            
            avatarOverlay.style.display = 'none';
            avatarUpload.style.display = 'none';

        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile: ' + error.message);
        } finally {
            saveProfileBtn.textContent = 'Save Changes';
            saveProfileBtn.disabled = false;
        }
    });

    // Update avatar preview dynamically as user types URL
    avatarUpload.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            profileImage.src = url;
        } else {
            const encodedName = encodeURIComponent(currentProfile?.display_name || currentProfile?.email.split('@')[0] || 'User');
            profileImage.src = `https://ui-avatars.com/api/?name=${encodedName}&size=150&background=random`;
        }
    });

    loadProfile();
});
