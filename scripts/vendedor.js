// ── GLOBALS ──────────────────────────────────────────────────────────────
console.log("UniRotas V2.5: Sistema de Identidade Ativado!");
let isTracking = false, watchId = null;
let lastLat = 0, lastLon = 0, lastTime = 0;
let vMap = null, vDirectionsRenderer = null, vDirectionsService = null;
let currentVendorName = '', currentVendorUid = '';
let isSignupMode = false, generatedCode = null, pendingUser = null;
let isProcessingAuth = false, chatListener = null;

// ── UI HELPERS ───────────────────────────────────────────────────────────
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = msg;
        t.className = 'show ' + type;
        setTimeout(() => { t.className = ''; }, 3500);
    }
}

function showLoading(show) {
    const loader = document.getElementById('loader-wrapper') || document.getElementById('global-loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');
}
function closeSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('show');
}

function updateNextMeetingWidget() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    function getFirstBizDay(year, month) {
        let d = new Date(year, month, 1);
        while (d.getDay() === 0 || d.getDay() === 6) { // 0=Sun, 6=Sat
            d.setDate(d.getDate() + 1);
        }
        return d;
    }

    let nextMeeting = getFirstBizDay(currentYear, currentMonth);

    // Se a reunião do mês atual já passou (ou é hoje mas queremos focar na próxima)
    // Se o dia atual for maior que o primeiro dia útil, pula para o mês que vem.
    if (now.getDate() > nextMeeting.getDate()) {
        nextMeeting = getFirstBizDay(currentYear, currentMonth + 1);
    }

    const diffTime = nextMeeting.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Formatação completa: dia de mês - dia da semana
    const dayMonth = nextMeeting.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    const weekDay = nextMeeting.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dateStr = `${dayMonth} - ${weekDay}`;

    const dateEl = document.getElementById('next-meeting-date-text');
    const daysEl = document.getElementById('next-meeting-days-count');

    if (dateEl) dateEl.textContent = `Previsão: ${dateStr}`;
    if (daysEl) {
        daysEl.textContent = diffDays;
        if (diffDays === 0) daysEl.textContent = "HOJE";
    }
    console.log("[WIDGET] Próxima reunião calculada para:", dateStr);
}

// Chamar imediatamente ao carregar o script
document.addEventListener('DOMContentLoaded', updateNextMeetingWidget);

function showScreen(id) {
    closeSidebar();
    const views = ['dashboard', 'map', 'chat', 'reuniao', 'historico'];
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) { el.classList.add('hidden'); el.style.display = ''; }
    });
    document.querySelectorAll('.bn-item').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    const target = document.getElementById('view-' + id);
    if (target) {
        target.classList.remove('hidden');
        if (id === 'map' || id === 'chat') {
            target.style.display = 'flex';
        } else {
            target.style.display = '';
        }
    }
    const mi = document.getElementById('menu-' + id);
    if (mi) mi.classList.add('active');

    const bn = document.getElementById('bn-' + id);
    if (bn) bn.classList.add('active');

    if (id === 'map' && vMap) { google.maps.event.trigger(vMap, 'resize'); }
    if (id === 'chat') loadChat();
    if (id === 'reuniao' && typeof loadMeetingScreen === 'function') loadMeetingScreen();
    if (id === 'historico' && typeof loadMyMeetingHistory === 'function') loadMyMeetingHistory();
    if (window.lucide) lucide.createIcons();
}

// ── SUPPORT CHAT ─────────────────────────────────────────────────────────
function loadChat() {
    if (!currentVendorUid) return;
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Carregando mensagens...</div>';

    if (chatListener) supabase.database().ref(`mensagens/${currentVendorUid}`).off('value', chatListener);
    chatListener = supabase.database().ref(`mensagens/${currentVendorUid}`).on('value', snap => {
        const msgs = Object.values(snap.val() || {});
        container.innerHTML = msgs.map(m => {
            const isMe = m.sender !== 'admin';
            return `
                <div style="max-width:85%; padding:10px 14px; border-radius:16px; margin-bottom:10px; align-self:${isMe ? 'flex-end' : 'flex-start'}; background:${isMe ? 'var(--gold)' : 'var(--surface2)'}; color:${isMe ? 'var(--bg)' : 'var(--text)'}; font-size:0.9rem; position:relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    ${m.text}
<div style="font-size:0.6rem; opacity:0.5; margin-top:4px; text-align:right;">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
        const badge = document.getElementById('badge-support');
        if (badge) badge.classList.remove('active');
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentVendorUid) return;
    try {
        await supabase.database().ref(`mensagens/${currentVendorUid}`).push({
            sender: currentVendorName, text, timestamp: Date.now(), read: false
        });
        input.value = '';
    } catch (e) {
        showToast('Erro: ' + e.message, 'error');
    }
}

// ── AUTH HANDLERS ────────────────────────────────────────────────────────
function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const card = document.querySelector('.login-card');
    const toggleLink = document.getElementById('auth-toggle-link');

    document.getElementById('auth-title').textContent = isSignupMode ? 'Novo Cadastro' : 'Acesso Restrito';
    document.getElementById('signup-fields').classList.toggle('hidden', !isSignupMode);
    document.getElementById('btn-login-action').textContent = isSignupMode ? 'EFETUAR CADASTRO' : 'ENTRAR NO SISTEMA';

    if (toggleLink) {
        toggleLink.textContent = isSignupMode ? 'Já tenho cadastro (Login)' : 'Solicitar novo cadastro';
    }

    const loginTop = document.querySelector('.login-top');
    if (loginTop) {
        loginTop.style.display = isSignupMode ? 'none' : 'flex';
        if (card) card.classList.toggle('signup-mode', isSignupMode);
    }
    if (isSignupMode) setTimeout(initAddressAutocomplete, 100);
}

let addressAutocomplete;
function initAddressAutocomplete() {
    const input = document.getElementById('addr-rua');
    if (!input || addressAutocomplete) return;
    addressAutocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'], componentRestrictions: { country: 'br' }, fields: ['address_components', 'geometry']
    });
    addressAutocomplete.addListener('place_changed', () => {
        const place = addressAutocomplete.getPlace();
        if (!place.address_components) return;
        let street = '', number = '', neighborhood = '', city = '', state = '', cep = '';
        for (const component of place.address_components) {
            const types = component.types;
            if (types.includes('route')) street = component.long_name;
            if (types.includes('street_number')) number = component.long_name;
            if (types.includes('sublocality_level_1')) neighborhood = component.long_name;
            if (types.includes('locality')) city = component.long_name;
            if (types.includes('administrative_area_level_1')) state = component.short_name;
            if (types.includes('postal_code')) cep = component.long_name;
        }
        if (street) input.value = street;
        document.getElementById('addr-num').value = number;
        document.getElementById('addr-bairro').value = neighborhood;
        document.getElementById('addr-cidade').value = city;
        document.getElementById('addr-cep').value = cep;
    });
}

async function handleAuth() {
    if (isProcessingAuth) return;
    const cpfOrEmail = document.getElementById('user-cpf-input').value.trim();
    const pass = document.getElementById('user-pass-input').value;
    const btn = document.getElementById('btn-login-action');

    if (!cpfOrEmail || pass.length < 6) {
        showToast(isSignupMode ? 'Preencha todos os campos do cadastro!' : 'E-mail ou Senha incorretos! Digite novamente!', 'error');
        return;
    }

    isProcessingAuth = true;
    const orig = btn.textContent; btn.textContent = 'Aguarde...'; btn.disabled = true;

    try {
        if (isSignupMode) {
            const name = document.getElementById('user-name-input').value.trim();
            const realEmail = document.getElementById('user-email-input').value.trim();
            const signupCpfInput = document.getElementById('signup-cpf-input');
            const cc = document.getElementById('user-cc-input').value.trim();
            const rua = document.getElementById('addr-rua').value.trim();
            const num = document.getElementById('addr-num').value.trim();
            const bairro = document.getElementById('addr-bairro').value.trim();
            const cidade = document.getElementById('addr-cidade').value.trim();
            const cep = document.getElementById('addr-cep').value.trim();

            if (!name || !realEmail || !signupCpfInput.value || !cc) { 
                showToast('Preencha os campos obrigatórios!', 'warning'); 
                throw new Error('Dados incompletos'); 
            }

            const cpf = signupCpfInput.value.replace(/\D/g, '');
            if (cpf.length < 11) {
                showToast('Informe um CPF válido (11 dígitos)!', 'warning');
                throw new Error('CPF Inválido');
            }

            // Cadastro REAL no Supabase
            const res = await firebase.auth().createUserWithEmailAndPassword(realEmail, pass);
            const uid = res.user.uid;

            const userData = {
                name, cpf, email: realEmail, uid, cc,
                address: rua + (num ? ', ' + num : '') + (bairro ? ' - ' + bairro : ''),
                city: cidade, cep: cep, registeredAt: Date.now()
            };

            // Salva no Banco de Dados
            await supabase.database().ref('usuarios/' + uid).set(userData);

            // Persistência Tripla: Garante que o nome apareça mesmo sem busca no banco
            localStorage.setItem('unirotas_last_user_name', name);
            console.log("[AUTH] Cadastro blindado para:", name);

            showToast('Cadastro realizado! Verifique o e-mail para confirmar.', 'success');
            setTimeout(() => { toggleAuthMode(); }, 2000);
        } else {
            // Login: Suporta E-mail direto ou CPF sintético (retrocompatível)
            const identifyingEmail = cpfOrEmail.includes('@') ? cpfOrEmail : `${cpfOrEmail.replace(/\D/g, '')}@unirotas.app`;
            const res = await firebase.auth().signInWithEmailAndPassword(identifyingEmail, pass);
            enterApp(res.user.uid);
        }
    } catch (e) {
        console.error("Auth Error:", e);
        let msg = e.message || 'Falha na autenticação';

        // 🟢 SAÍDA DE MESTRE: Caso o e-mail já exista no Firebase mas foi deletado do banco por engano
        if (msg.includes('email-already-in-use')) {
            console.log("[AUTH] E-mail já no Firebase. Verificando se foi removido das tabelas do banco...");
            const emailResgatado = document.getElementById('user-email-input').value.trim();
            const passResgatado = document.getElementById('user-pass-input').value;

            try {
                // Tenta Logar com este e-mail para ver se ele está órfão
                const resSignin = await firebase.auth().signInWithEmailAndPassword(emailResgatado, passResgatado);
                const uidSignin = resSignin.user.uid;
                
                // Tenta buscar o perfil no banco
                const { data: dbUser } = await supabase.from('usuarios').select('uid').eq('uid', uidSignin).maybeSingle();
                
                if (!dbUser) {
                    console.log("[AUTH] Usuário órfão detectado! Re-criando perfil no banco...");
                    // Se não tem perfil no banco, re-criamos as informações (RE-CADASTRO AUTOMÁTICO)
                    const name = document.getElementById('user-name-input').value.trim();
                    const signupCpfInput = document.getElementById('signup-cpf-input');
                    const cc = document.getElementById('user-cc-input').value.trim();
                    const cpf = signupCpfInput.value.replace(/\D/g, '');

                    const userData = {
                        name, cpf, email: emailResgatado, uid: uidSignin, cc,
                        registeredAt: Date.now()
                    };
                    await supabase.database().ref('usuarios/' + uidSignin).set(userData);
                    showToast('Cadastro restaurado com sucesso!', 'success');
                    enterApp(uidSignin);
                    return;
                }
            } catch (e2) {
                console.error("Erro no resgate:", e2);
            }
            msg = 'Este e-mail já possui um cadastro ativo.';
        }

        showToast('Erro: ' + msg, 'error');
    } finally {
        isProcessingAuth = false; btn.textContent = orig; btn.disabled = false;
    }
}

async function handleLogout() {
    try {
        const user = firebase.auth().currentUser;
        if (user) {
            await firebase.database().ref('vendedores/' + user.uid).update({ status: 'Offline', lastActive: Date.now() });
            try { await firebase.database().ref(`meeting/participants/${user.uid}`).remove(); } catch (_) { }
        }
        if (isTracking) stopTracking();
        await firebase.auth().signOut();
    } catch (e) {
        console.error(e);
    } finally {
        window.location.reload();
    }
}

window.openForgotPasswordModal = function () {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
        console.log("Modal de recuperação aberto.");
    } else {
        console.error("Modal forgot-password-modal não encontrado no HTML!");
    }
};
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.setProperty('display', 'none', 'important');
        console.log(`[UI] Modal ${id} fechado.`);
    }
}

async function handleSendResetEmail() {
    const email = document.getElementById('reset-email-input').value.trim();
    if (!email) { showToast('Informe o seu e-mail.', 'error'); return; }
    try {
        await firebase.auth().sendPasswordResetEmail(email, { redirectTo: window.location.href });
        showToast('Link enviado!', 'success');
        closeModal('forgot-password-modal');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

window.handleUpdatePassword = async function () {
    const newPass = document.getElementById('new-pass-input').value;
    if (newPass.length < 6) {
        showToast('Senha deve ter no mínimo 6 caracteres.', 'error');
        return;
    }

    const btn = document.getElementById('btn-update-pass');
    if (!btn) return;

    const orig = btn.textContent; btn.textContent = 'Salvando...'; btn.disabled = true;

    try {
        console.log("[AUTH] Tentando atualizar senha globalmente...");
        await firebase.auth().updateUser({ password: newPass });

        showToast('Senha atualizada com sucesso! Redirecionando...', 'success');

        // Finaliza o fluxo limpando a URL e voltando ao Login puro
        setTimeout(() => {
            window.location.href = 'vendedor.html';
        }, 1500);

        if (typeof closeModal === 'function') closeModal('new-password-modal');
        showToast('Senha atualizada com sucesso!', 'success');
        console.log("[AUTH] Sucesso na atualização.");
        closeModal('new-password-modal');
        setTimeout(() => { window.location.hash = ''; window.location.reload(); }, 2000);
    } catch (e) {
        console.error("[AUTH] Erro:", e);
        showToast('Erro: ' + e.message, 'error');
        btn.textContent = orig; btn.disabled = false;
    }
};

// ── GPS TRACKING ─────────────────────────────────────────────────────────
function toggleTracking() { if (isTracking) stopTracking(); else startTracking(); }
function startTracking() {
    if (!navigator.geolocation) return showToast('Sem GPS', 'error');
    isTracking = true;
    const btn = document.getElementById('btn-tracking');
    const card = document.getElementById('gps-status-card');
    const ring = document.getElementById('status-ring');
    const statusTxt = document.getElementById('status-text');

    if (btn) {
        btn.textContent = 'PARAR RASTREAMENTO';
        btn.style.background = 'var(--danger)';
        btn.style.boxShadow = '0 10px 20px rgba(255, 71, 87, 0.3)';
    }

    if (card) {
        card.classList.add('active-gps');
    }

    if (ring) {
        ring.classList.add('active');
        ring.innerHTML = '<i data-lucide="navigation" style="color:#2ed573; width:28px; height:28px; animation: pulse 1.5s infinite"></i>';
        if (window.lucide) lucide.createIcons();
    }

    if (statusTxt) {
        statusTxt.textContent = 'Rastreamento Ativo';
        statusTxt.style.color = '#2ed573';
    }
    watchId = navigator.geolocation.watchPosition(pos => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        lastLat = lat; lastLon = lon;
        const cText = document.getElementById('coords-text'), aWarn = document.getElementById('accuracy-warning');
        if (cText) cText.textContent = `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        if (aWarn) aWarn.classList.toggle('hidden', accuracy < 50);
        if (currentVendorUid) firebase.database().ref('vendedores/' + currentVendorUid).update({ lat, lon, lastActive: Date.now() });
        updateQuickCards();
        if (typeof updateUniversalPresence === 'function') updateUniversalPresence();
    }, e => {
        let msg = e.message;
        if (e.code === 1) msg = "O GPS foi recusado! Clique no cadeado (\ud83d\udd12) na barra do navegador e clique em PERMITIR para rastrear.";
        else if (e.code === 2) msg = "Posição do GPS indisponível no momento.";
        else if (e.code === 3) msg = "Tempo esgotado para obter o GPS.";
        showToast('Erro GPS: ' + msg, 'error');
    }, { enableHighAccuracy: true });
}
function stopTracking() {
    isTracking = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);

    const btn = document.getElementById('btn-tracking');
    const card = document.getElementById('gps-status-card');
    const ring = document.getElementById('status-ring');
    const statusTxt = document.getElementById('status-text');

    if (btn) {
        btn.textContent = 'INICIAR RASTREAMENTO';
        btn.style.background = 'linear-gradient(135deg, var(--gold) 0%, #d4af37 100%)';
        btn.style.boxShadow = '0 10px 25px rgba(191, 154, 86, 0.25)';
    }

    if (card) {
        card.classList.remove('active-gps');
        card.style.background = '';
        card.style.border = '';
    }

    if (ring) {
        ring.classList.remove('active');
        ring.style.background = '';
        ring.style.borderColor = '';
        ring.innerHTML = '<i data-lucide="navigation" style="color:var(--gold); width:28px; height:28px"></i>';
        if (window.lucide) lucide.createIcons();
    }

    if (statusTxt) {
        statusTxt.textContent = 'Expediente Inativo';
        statusTxt.style.color = '';
    }

    updateQuickCards();
}

// ── HEADER & CARDS ───────────────────────────────────────────────────────
function updateHeaderName(name) {
    const el = document.getElementById('header-first-name');
    if (!el) return;

    const u = firebase.auth().currentUser;
    const localName = localStorage.getItem('unirotas_last_user_name');
    let displayName = 'Vendedor';

    if (name && name !== 'Vendedor') {
        displayName = name.split(' ')[0];
    } else if (localName) {
        displayName = localName.split(' ')[0];
    } else if (u && u.email) {
        const emailPart = u.email.split('@')[0];
        displayName = emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
    }

    el.textContent = displayName;
    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = displayName;
}
function updateGreeting() {
    const el = document.getElementById('header-greeting');
    if (!el) return;
    const hr = new Date().getHours();
    let g = 'Boa noite \ud83c\udf19'; // 🌙
    if (hr < 12) g = 'Bom dia \u2600\ufe0f'; // ☀️
    else if (hr < 18) g = 'Boa tarde \u26c5'; // ⛅
    el.textContent = g;
}
function updateQuickCards() {
    const el = document.getElementById('status-summary');
    if (el) el.textContent = isTracking ? 'Operando no momento' : 'Aguardando início';
}

function logAudit(action) {
    console.log(`[Audit] ${action} at ${new Date().toISOString()}`);
}

function initVendedorMap() {
    const el = document.getElementById('map-canvas');
    if (!el || typeof google === 'undefined') return;
    vMap = new google.maps.Map(el, {
        center: { lat: -20.31, lng: -40.31 }, zoom: 15,
        styles: [{ "featureType": "all", "elementType": "all", "stylers": [{ "invert_lightness": true }, { "saturation": 10 }, { "lightness": 30 }, { "gamma": 0.5 }, { "hue": "#435158" }] }]
    });
}

function initSupportMessageListener(uid) {
    firebase.database().ref(`mensagens/${uid}`).on('child_added', snap => {
        const m = snap.val();
        if (m.sender === 'admin' && !m.read) {
            document.getElementById('badge-support')?.classList.add('active');
            if (typeof showGlobalNotification === 'function') {
                showGlobalNotification('Suporte UniRotas', m.text, 'support');
            }
        }
    });
}

// ── ENTER APP ────────────────────────────────────────────────────────────
async function enterApp(uid) {
    currentVendorUid = uid;
    const screenLogin = document.getElementById('screen-login'), screenApp = document.getElementById('screen-app');
    const bottomNav = document.querySelector('.bottom-nav');
    if (screenLogin) { screenLogin.classList.add('hidden'); screenLogin.style.display = 'none'; }
    if (screenApp) { screenApp.classList.remove('hidden'); screenApp.style.display = 'flex'; }
    if (bottomNav) { bottomNav.style.display = 'flex'; }

    try {
        console.log("[AUTH] Carregando perfil para UID:", uid);
        const userAuth = firebase.auth().currentUser;
        let snap = await firebase.database().ref('usuarios/' + uid).once('value');
        let data = snap.val();

        // FALLBACK: Se não achar pelo UID, tenta achar pelo e-mail ou CPF
        if (!data && userAuth) {
            const refUsers = firebase.database().ref('usuarios');

            // 1. Tenta pelo e-mail
            if (userAuth.email) {
                console.log("[AUTH] Buscando perfil pelo e-mail:", userAuth.email);
                const snapByEmail = await refUsers.orderByChild('email').equalTo(userAuth.email).once('value');
                if (snapByEmail.exists()) {
                    data = Object.values(snapByEmail.val())[0];
                }
            }

            // 2. Tenta pelo CPF (se não achou por e-mail e temos o CPF limpo no banco)
            if (!data) {
                console.log("[AUTH] Buscando perfil por CPFs...");
                const allUsersSnap = await refUsers.once('value');
                const allUsers = allUsersSnap.val() || {};
                // Como não temos o CPF na sessão, vamos cruzar o que existir no banco 
                // para tentar achar se esse e-mail novo pertence a alguém antigo
            }

            if (data) {
                console.log("[AUTH] Perfil recuperado! Vinculando ao novo UID...");
                data.uid = uid;
                await firebase.database().ref('usuarios/' + uid).set(data);
            }
        }

        if (data) {
            currentVendorName = data.name || 'Vendedor';
            updateHeaderName(currentVendorName);
            updateGreeting();
            updateQuickCards();
            document.getElementById('sidebar-user-name').textContent = currentVendorName;
            document.getElementById('sidebar-user-cpf').textContent = data.cpf ? `CPF: ${data.cpf}` : 'ID Ativo';
        } else {
            console.log("[AUTH] Cadastro completo pendente. Usando identidade via e-mail.");
            updateHeaderName(null); // Força o uso do E-mail no topo
            updateGreeting();
        }

        firebase.database().ref('vendedores/' + uid).onDisconnect().update({ status: 'Offline' });
        firebase.database().ref('vendedores/' + uid).update({ status: 'Online', name: currentVendorName, lastActive: Date.now() });

        initVendedorMap();
        if (typeof listenForMeetingNotifications === 'function') listenForMeetingNotifications(uid);

        initSupportMessageListener(uid);
        
        // 👉 ANTES DA TELA: Ícones síncronos
        if (window.lucide) lucide.createIcons();

        showScreen('dashboard');

        // 👉 DEPOIS DA TELA: Ícones de elementos renderizados via JS (sidebar/header)
        setTimeout(() => { 
            if (window.lucide) lucide.createIcons();
            console.log("[UI] Ícones Lucide atualizados.");
        }, 200);

        startTracking();

        // 👉 Módulos isolados para que um erro não trave o resto do app
        try { if (typeof updateNextMeetingWidget === 'function') updateNextMeetingWidget(); } catch (e) { console.error("Erro Widget Reunião", e); }
        try { if (typeof loadMeetingScreen === 'function') loadMeetingScreen(); } catch (e) { console.error("Erro Reunião", e); }
        try { if (typeof loadEconomyStats === 'function') loadEconomyStats(); } catch (e) { console.error("Erro Economia", e); }

    } catch (e) {
        console.error("EnterApp Error:", e);
    }
}

// ── INITIALIZATION ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    console.log("UniRotas: DOMContentLoaded");

    // 👉 Ícones iniciais (Login/Splash)
    if (window.lucide) lucide.createIcons();

    const authSplash = document.getElementById('auth-splash');
    const safetyTimeout = setTimeout(() => {
        if (authSplash && authSplash.style.display !== 'none') {
            authSplash.style.display = 'none';
            const sl = document.getElementById('screen-login');
            if (sl) { sl.classList.remove('hidden'); sl.style.display = 'flex'; }
            if (window.lucide) lucide.createIcons(); // Ícones da tela de login
        }
    }, 8000);

    if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            clearTimeout(safetyTimeout);
            if (authSplash) authSplash.style.display = 'none';

            if (user) enterApp(user.uid);
            else {
                const sl = document.getElementById('screen-login');
                const bottomNav = document.querySelector('.bottom-nav');
                if (sl) { sl.classList.remove('hidden'); sl.style.display = 'flex'; }
                if (bottomNav) { bottomNav.style.display = 'none'; }
            }
        });
    }

    // Campo de login agora aceita E-mail ou CPF (sem máscara travando letras)
    const cpfInput = document.getElementById('user-cpf-input');
    if (cpfInput) {
        // Removemos a máscara para permitir o Gmail direto
        console.log("[UI] Campo de login liberado para E-mail ou CPF.");
    }

    // Hash detection for reset password (melhorado para aceitar ## ou #)
    let currentHash = window.location.hash;

    // CORREÇÃO CRÍTICA: Se a URL tiver ## (comum no VS Code Live Server), troca por #
    if (currentHash.startsWith('##')) {
        console.log("[AUTH] Corrigindo hash duplicado ##...");
        currentHash = '#' + currentHash.substring(2);
        window.location.hash = currentHash; // Normaliza a barra de endereços
    }

    if (currentHash.includes('type=recovery') || currentHash.includes('access_token=')) {
        console.log("[AUTH] Link de recuperação detectado. Normalizando sessão...");

        // Abre o modal o mais rápido possível
        setTimeout(async () => {
            try {
                const modal = document.getElementById('new-password-modal');
                if (modal) {
                    modal.style.setProperty('display', 'flex', 'important');
                    console.log("[AUTH] Painel de nova senha aberto via link.");
                }

                // Tenta forçar a sessão a se consolidar
                const { data } = await firebase.auth()._realSB.auth.getSession();
                if (data && data.session) {
                    console.log("[AUTH] Sessão consolidada para:", data.session.user.email);
                }
            } catch (e) {
                console.warn("[AUTH] Aguardando estabilização da sessão...");
            }
        }, 500);
    }

    // Particles effect
    (function particles() {
        const top = document.querySelector('.login-top');
        if (!top) return;
        const wrap = document.createElement('div');
        wrap.className = 'login-particles';
        for (let i = 0; i < 15; i++) {
            const p = document.createElement('div');
            p.className = 'login-particle';
            p.style.cssText = `left:${Math.random() * 100}%;bottom:${Math.random() * 20}%;animation-delay:${Math.random() * 5}s;`;
            wrap.appendChild(p);
        }
        top.prepend(wrap);
    })();
});
