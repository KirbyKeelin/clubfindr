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
    let pendingAvatarFile = null;

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
    });

    // Save Profile
    saveProfileBtn.addEventListener('click', async () => {
        saveProfileBtn.textContent = 'Saving...';
        saveProfileBtn.disabled = true;

        const newName = editName.value.trim();
        const newBio = editBio.value.trim();
        let newAvatarUrl = currentProfile.avatar_url;

        try {
            if (pendingAvatarFile) {
                saveProfileBtn.textContent = 'Uploading Image...';
                const fileExt = pendingAvatarFile.name ? pendingAvatarFile.name.split('.').pop() : 'jpg';
                const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await window.sbClient.storage
                    .from('avatars')
                    .upload(fileName, pendingAvatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data } = window.sbClient.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                newAvatarUrl = data.publicUrl;
            }

            saveProfileBtn.textContent = 'Saving Profile...';
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
            pendingAvatarFile = null;

        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile: ' + error.message);
        } finally {
            saveProfileBtn.textContent = 'Save Changes';
            saveProfileBtn.disabled = false;
        }
    });

    const cropModal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const saveCropBtn = document.getElementById('saveCropBtn');
    let cropper = null;

    // Update avatar preview dynamically as user selects file
    avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, etc.).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image must be less than 5MB in size.');
            return;
        }

        cropImage.src = URL.createObjectURL(file);
        cropModal.style.display = 'flex';
        
        if (cropper) cropper.destroy();
        
        // Timeout to allow modal to display before cropper initializes
        setTimeout(() => {
            cropper = new Cropper(cropImage, {
                aspectRatio: 1,
                viewMode: 1
            });
        }, 100);
        
        e.target.value = '';
    });

    cancelCropBtn.addEventListener('click', () => {
        cropModal.style.display = 'none';
        if (cropper) cropper.destroy();
    });

    saveCropBtn.addEventListener('click', () => {
        if (!cropper) return;
        cropper.getCroppedCanvas({
            width: 300,
            height: 300
        }).toBlob((blob) => {
            if (!blob) {
                alert('Crop failed.');
                return;
            }
            pendingAvatarFile = blob;
            profileImage.src = URL.createObjectURL(blob);
            cropModal.style.display = 'none';
            cropper.destroy();
        }, 'image/jpeg', 0.9);
    });

    loadProfile();
});
