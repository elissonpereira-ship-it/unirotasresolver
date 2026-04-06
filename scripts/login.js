// UniRotas - Login Logic (Refined for Image Match)
// Handles authentication simulation and UI state management

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('toggle-password');

    // Toggle Password Visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            // Overwrite innerHTML with a fresh <i> tag so Lucide renders it
            // isPassword is true -> switching to "text" -> show "eye" (open). 
            // isPassword is false -> switching to "password" -> show "eye-off" (closed).
            togglePassword.innerHTML = `<i data-lucide="${isPassword ? 'eye' : 'eye-off'}"></i>`;
            lucide.createIcons();
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawUsername = usernameInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (!rawUsername || !password) return;

        // Converte CPF ou 'admin' em e-mail virtual para o Supabase Auth
        let email = rawUsername.includes('@') 
            ? rawUsername 
            : `${rawUsername.replace(/\D/g, '')}@unirotas.com`;
        
        // Caso especial para o usuário mestre
        if (rawUsername === 'admin') email = 'admin@unirotas.com';

        // Activate loading state
        btnLogin.classList.add('loading');
        btnLogin.disabled = true;

        try {
            // 1. Tenta autenticar no Supabase via Shim
            let authResult;
            try {
                authResult = await supabase.auth().signInWithEmailAndPassword(email, password);
            } catch (signInErr) {
                // Se falhar e for o admin mestre, tenta criar o usuário (Auto-Provisioning)
                if (email === 'admin@unirotas.com' && (signInErr.message.toLowerCase().includes('invalid') || signInErr.status === 400)) {
                    console.log('Master Admin not found, auto-provisioning...');
                    try {
                        authResult = await supabase.auth().createUserWithEmailAndPassword(email, password);
                    } catch (signUpErr) {
                        // Se já existir no Auth mas deu erro de senha no login, mantém o erro original
                        throw signInErr;
                    }
                } else {
                    throw signInErr;
                }
            }
            
            const uid = authResult.user.uid;

            // 2. Busca o papel do usuário na tabela usuarios
            let userSnap = await supabase.database().ref(`usuarios/${uid}`).once('value');
            let profile = userSnap.val();

            // 3. Fallback/Auto-criação para o Master Admin + Limpeza de antigos
            if (email === 'admin@unirotas.com') {
                console.log('Initializing Master Admin profile & Cleaning old admins...');
                // Garante que o perfil master exista
                profile = { name: 'Master Admin', role: 'admin', uid: uid, cpf: 'admin' };
                await supabase.database().ref(`usuarios/${uid}`).set(profile);
                
                // Remove outros admins do banco para manter apenas o login único (exceto o próprio UID)
                const allUsersSnap = await supabase.database().ref('usuarios').once('value');
                const allUsers = allUsersSnap.val() || {};
                for (const uId in allUsers) {
                    if (allUsers[uId].role === 'admin' && uId !== uid) {
                        await supabase.database().ref(`usuarios/${uId}`).remove();
                    }
                }
            }

            if (profile) {
                console.log('Login successful, role:', profile.role);
                
                // Persistência local necessária para script.js antigo
                localStorage.setItem('uniRotas_isLoggedIn', 'true');
                localStorage.setItem('uniRotas_user', profile.name || email);
                localStorage.setItem('uniRotas_uid', uid);

                const btnText = btnLogin.querySelector('.btn-text');
                if (btnText) btnText.textContent = 'Sucesso!';
                btnLogin.style.background = '#10b981'; 
                
                // Redirecionamento baseado em papel
                setTimeout(() => {
                    if (profile.role === 'admin') {
                        window.location.href = 'index.html';
                    } else {
                        window.location.href = 'vendedor.html';
                    }
                }, 800);
            } else {
                throw new Error('Perfil de usuário não encontrado no banco.');
            }
        } catch (err) {
            console.error('Login error:', err);
            showError(err.message || 'Erro ao realizar login.');
            resetLoginButton();
        }
    });

    function showError(customMsg) {
        const modalError = document.getElementById('modal-error');
        if (modalError) {
            if (customMsg) modalError.querySelector('p').textContent = customMsg;
            modalError.classList.remove('hidden');
        } else {
            alert(customMsg || 'Acesso negado. Verifique suas credenciais.');
        }
    }

    function resetLoginButton() {
        btnLogin.classList.remove('loading');
        btnLogin.disabled = false;
        const btnText = btnLogin.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Entrar no Sistema';
        btnLogin.style.background = ''; // Reset to CSS default
    }
});

/**
 * Global function to close the error modal
 */
function closeErrorModal() {
    const modalError = document.getElementById('modal-error');
    if (modalError) {
        modalError.classList.add('hidden');
    }
}

// Ensure global availability
window.closeErrorModal = closeErrorModal;
