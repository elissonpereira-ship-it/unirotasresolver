/* UniRotas – Supabase Data & Auth Driver V2.4 (Ultra - Realtime & Full Mapping) */
(function () {
    console.log("UniRotas Shim V2.4: Initializing...");
    const _SUPA_URL = 'https://ajconwarkeunpixqngnq.supabase.co';
    const _SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqY29ud2Fya2V1bnBpeHFuZ25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTQ2MDksImV4cCI6MjA5MDQ3MDYwOX0.HFHmApPMYKT_GZLJwDAY8IZSaM38CjVUN1amAah4wZM';

    if (!window.supabase || !window.supabase.createClient) return;
    const _realSB = window.supabase.createClient(_SUPA_URL, _SUPA_KEY);
    let _cachedUser = null;

    function _toMap(arr, key, fn = null) {
        if (!arr || !arr.length) return {};
        const r = {}; arr.forEach(row => { r[row[key]] = fn ? fn(row) : row; }); return r;
    }

    // De-Para Estrutura Real -> BD
    function _normPart(row) {
        if (!row) return null;
        return {
            uid: row.vendor_uid, name: row.name, role: row.role, embarkStatus: row.embark_status,
            joinedAt: row.joined_at ? new Date(row.joined_at).getTime() : null, locationId: row.location_id,
            locationName: row.location_name, locationAddress: row.location_address, region: row.region,
            lat: row.lat, lng: row.lng, embarkLat: row.embark_lat, embarkLng: row.embark_lng, phase: row.phase,
            presenceConfirmed: row.presence_confirmed, driverUid: row.driver_uid, driverName: row.driver_name,
            status: row.status, passengers: row.passengers
        };
    }
    function _denormPart(d) {
        const r = {};
        if (d.uid !== undefined) r.vendor_uid = d.uid;
        if (d.name !== undefined) r.name = d.name;
        if (d.role !== undefined) r.role = d.role;
        if (d.embarkStatus !== undefined) r.embark_status = d.embarkStatus;
        if (d.locationId !== undefined) r.location_id = d.locationId;
        if (d.locationName !== undefined) r.location_name = d.locationName;
        if (d.locationAddress !== undefined) r.location_address = d.locationAddress;
        if (d.region !== undefined) r.region = d.region;
        if (d.lat !== undefined) r.lat = d.lat;
        if (d.lng !== undefined) r.lng = d.lng;
        if (d.phase !== undefined) r.phase = d.phase;
        if (d.presenceConfirmed !== undefined) r.presence_confirmed = d.presenceConfirmed;
        if (d.driverUid !== undefined) r.driver_uid = d.driverUid;
        if (d.driverName !== undefined) r.driver_name = d.driverName;
        if (d.status !== undefined) r.status = d.status;
        if (d.passengers !== undefined) r.passengers = d.passengers;
        if (d.embarkLat !== undefined) r.embark_lat = d.embarkLat;
        if (d.embarkLng !== undefined) r.embark_lng = d.embarkLng;
        return r;
    }

    async function _readPath(path) {
        const p = path.split('/').filter(Boolean);
        const q = (t) => _realSB.from(t);
        try {
            if (path === 'usuarios') {
                const { data } = await q('usuarios').select('*');
                return _toMap(data, 'uid');
            }
            if (p[0] === 'usuarios' && p.length === 2) {
                const { data } = await q('usuarios').select('*').eq('uid', p[1]).limit(1);
                return data && data.length ? data[0] : null;
            }
            if (p[0] === 'vendedores' && p.length === 2) {
                const { data } = await q('vendedores').select('*').eq('uid', p[1]).limit(1);
                return data && data.length ? data[0] : null;
            }
            if (path === 'meeting/locations') {
                const { data } = await q('meeting_locations').select('*');
                return _toMap(data, 'id');
            }
            if (p[0] === 'meeting' && p[1] === 'participants' && p.length === 3) {
                const { data } = await q('meeting_participants').select('*').eq('vendor_uid', p[2]).limit(1);
                return data && data.length ? _normPart(data[0]) : null;
            }
            if (path === 'meeting/participants') {
                const { data } = await q('meeting_participants').select('*');
                return _toMap(data, 'vendor_uid', _normPart);
            }
            if (p[0] === 'meeting' && p[1] === 'driverPickups' && p.length === 3) {
                const { data } = await q('meeting_driver_pickups').select('*').eq('driver_uid', p[2]);
                return _toMap(data, 'passenger_uid', r => ({ uid: r.passenger_uid, name: r.passenger_name, status: r.status, dropoffStatus: r.dropoff_status }));
            }
            if (path === 'meeting/history') {
                const { data, error } = await q('meeting_history').select('date');
                if (error) {
                    console.error('[Shim-V2] Erro ao ler datas:', error.message);
                    return {};
                }
                const dates = {}; 
                (data || []).forEach(r => { if (r.date) dates[r.date] = true; });
                return dates;
            }
            if (p[0] === 'meeting' && p[1] === 'history' && p.length === 3) {
                const { data, error } = await q('meeting_history').select('*').eq('date', p[2]);
                if (error) {
                    console.error('[Shim-V2] Erro ao ler histórico:', error.message);
                    return {};
                }
                return _toMap(data, 'driver_uid', r => ({
                    driverName: r.driver_name, 
                    driverUid: r.driver_uid, 
                    passengers: r.passengers || {},
                    vehicleType: r.vehicle_type || 'carro',
                    totalKm: r.total_km || 0,
                    reimbursement: r.reimbursement || 0,
                    status: r.status,
                    arrivalRoute: r.arrival_route || [],
                    returnRoute: r.return_route || [],
                    predictedRoute: r.predicted_route || [],
                    completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null
                }));
            }
            if (p[0] === 'meeting' && p[1] === 'history' && p.length === 4) {
                const { data, error } = await q('meeting_history').select('*').eq('date', p[2]).eq('driver_uid', p[3]).maybeSingle();
                if (error || !data) return null;
                return {
                    driverName: data.driver_name,
                    driverUid: data.driver_uid,
                    passengers: data.passengers || {},
                    vehicleType: data.vehicle_type || 'carro',
                    arrivalRoute: data.arrival_route || [],
                    returnRoute: data.return_route || [],
                    predictedRoute: data.predicted_route || [],
                    totalKm: data.total_km || 0,
                    reimbursement: data.reimbursement || 0,
                    status: data.status,
                    completedAt: data.completed_at ? new Date(data.completed_at).getTime() : null
                };
            }
            return null;
        } catch (e) { 
            console.error('[Shim-V2] Erro fatal em _readPath:', e);
            return null; 
        }
    }

    const _activeSubs = {};
    function _subscribe(path, cb) {
        const p = path.split('/').filter(Boolean);
        let table = 'meeting_participants';
        if (p[0] === 'vendedores') table = 'vendedores';
        else if (p[0] === 'mensagens') table = 'mensagens';
        else if (p[0] === 'meeting') {
            if (p[1] === 'notifications') table = 'meeting_notifications';
            else if (p[1] === 'driverPickups') table = 'meeting_driver_pickups';
        }

        _readPath(path).then(data => cb({ val: () => data }));
        const id = 'shim_' + Math.random().toString(36).substring(7);
        const channel = _realSB.channel(id).on('postgres_changes', { event: '*', schema: 'public', table: table }, async () => {
            const data = await _readPath(path);
            cb({ val: () => data });
            if (window.lucide) window.lucide.createIcons(); // Garante icones nas telas em tempo real
        }).subscribe();
        _activeSubs[path] = channel;
    }

    const _auth = {
        get currentUser() { return _cachedUser; },
        onAuthStateChanged(cb) {
            _realSB.auth.getSession().then(({ data: { session } }) => {
                _cachedUser = session?.user ? { uid: session.user.id } : null;
                cb(_cachedUser);
            });
            _realSB.auth.onAuthStateChange((_, session) => {
                _cachedUser = session?.user ? { uid: session.user.id } : null;
                cb(_cachedUser);
            });
        },
        async signInWithEmailAndPassword(email, password) {
            const { data, error } = await _realSB.auth.signInWithPassword({ email, password });
            if (error) throw error;
            _cachedUser = { uid: data.user.id };
            return { user: _cachedUser };
        },
        async createUserWithEmailAndPassword(email, password) {
            const { data, error } = await _realSB.auth.signUp({ email, password });
            if (error) throw error;
            _cachedUser = data.user ? { uid: data.user.id } : null;
            return { user: _cachedUser };
        },
        async sendPasswordResetEmail(email, options) {
            const { error } = await _realSB.auth.resetPasswordForEmail(email, { 
                redirectTo: options?.redirectTo || window.location.href 
            });
            if (error) throw error;
            return true;
        },
        async updateUser(attributes) {
            const { data, error } = await _realSB.auth.updateUser(attributes);
            if (error) throw error;
            return { user: data.user };
        },
        async signOut() { _cachedUser = null; return await _realSB.auth.signOut(); }
    };

    class _Ref {
        constructor(path) { this.path = path; this._filters = []; }
        orderByChild(prop) { return this; }
        orderByKey() { return this; }
        equalTo(val) { this._filters.push(val); return this; }
        limitToLast(n) { return this; }

        async once() { 
            const d = await _readPath(this.path); 
            return { val: () => d }; 
        }

        on(ev, cb) { 
            if (ev === 'value') {
                const wrappedCb = (snap) => {
                    let val = snap.val();
                    if (this._filters.length > 0 && val && typeof val === 'object') {
                        const filterVal = this._filters[0];
                        const filtered = {};
                        Object.entries(val).forEach(([k, v]) => {
                            if (v.status === filterVal || v.phase === filterVal || v.handled === filterVal) 
                                filtered[k] = v;
                        });
                        cb({ val: () => filtered });
                    } else {
                        cb(snap);
                    }
                };
                cb._wrapped = wrappedCb;
                _subscribe(this.path, wrappedCb); 
            }
            return cb; 
        }

        off(ev, cb) { 
            const target = cb?._wrapped || cb;
            if (target && _activeSubs[this.path]) { 
                _realSB.removeChannel(_activeSubs[this.path]); 
                delete _activeSubs[this.path]; 
            } 
        }

        async set(d) {
            const p = this.path.split('/').filter(Boolean);
            if (p[0] === 'usuarios' && p.length === 2) {
                const row = {
                    uid: p[1],
                    name: d.name || null,
                    email: d.email || null,
                    cpf: d.cpf || null,
                    role: d.role || 'vendedor',
                    cc: d.cc || null,
                    address: d.address || null,
                    city: d.city || null,
                    cep: d.cep || null,
                    registered_at: d.registeredAt ? new Date(d.registeredAt).toISOString() : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                const { error } = await _realSB.from('usuarios').upsert(row);
                if (error) console.error('[Shim-V2] Erro ao salvar usuario:', error.message);
            }
            else if (p[0] === 'meeting' && p[1] === 'participants' && p.length === 3) {
                await _realSB.from('meeting_participants').upsert({ ..._denormPart({ uid: p[2], ...d }), joined_at: new Date().toISOString() });
            }
            else if (p[0] === 'meeting' && p[1] === 'driverPickups' && p.length === 4) {
                await _realSB.from('meeting_driver_pickups').upsert({ driver_uid: p[2], passenger_uid: p[3], passenger_name: d.name || 'Desconhecido', status: d.status || 'accepted', dropoff_status: d.dropoffStatus || 'pending' });
            }
            else if (p[0] === 'meeting' && p[1] === 'notifications' && p.length === 3) {
                await _realSB.from('meeting_notifications').insert({ vendor_uid: p[2], type: d.type, handled: d.handled || false, data: d });
            }
            else if (p[0] === 'meeting' && p[1] === 'history' && p.length === 4) {
                // UPSERT: Cria ou Atualiza a linha do motorista no dia
                const row = {
                    date: p[2], 
                    driver_uid: p[3], 
                    status: d.status || 'in_progress',
                    driver_name: d.driverName || d.driver_name || 'Motorista',
                    vehicle_type: d.vehicleType || d.vehicle_type || 'carro',
                    passengers: d.passengers || {},
                    predicted_route: d.predictedRoute || d.predicted_route || [],
                    arrival_route: d.arrivalRoute || d.arrival_route || [],
                    return_route: d.returnRoute || d.return_route || [],
                    total_km: d.totalKm || d.total_km || 0,
                    reimbursement: d.reimbursement || d.reimbursement || 0,
                    completed_at: d.completedAt ? new Date(d.completedAt).toISOString() : (d.completed_at || null),
                    updated_at: new Date().toISOString() 
                };
                const { error } = await _realSB.from('meeting_history').upsert(row, { onConflict: 'date,driver_uid' });
                if (error) console.error('[Shim-V2] Erro no Upsert Histórico:', error.message);
            }
        }

        async update(d) {
            const p = this.path.split('/').filter(Boolean);
            if (p[0] === 'usuarios' && p.length === 2) {
                const u = { updated_at: new Date().toISOString() };
                const fields = ['name','email','cpf','role','cc','address','city','cep','lat','lng'];
                fields.forEach(f => { if (d[f] !== undefined) u[f] = d[f]; });
                const { error } = await _realSB.from('usuarios').update(u).eq('uid', p[1]);
                if (error) console.error('[Shim-V2] Erro ao atualizar usuario:', error.message);
            }
            else if (p[0] === 'meeting' && p[1] === 'participants' && p.length === 3) {
                await _realSB.from('meeting_participants').update(_denormPart(d)).eq('vendor_uid', p[2]);
            }
            else if (p[0] === 'meeting' && p[1] === 'driverPickups' && p.length === 4) {
                let up = {};
                if (d.status) up.status = d.status;
                if (d.dropoffStatus) up.dropoff_status = d.dropoffStatus;
                if (Object.keys(up).length > 0) await _realSB.from('meeting_driver_pickups').update(up).eq('driver_uid', p[2]).eq('passenger_uid', p[3]);
            }
            else if (p[0] === 'vendedores' && p.length === 2) {
                await _realSB.from('vendedores').update({ lat: d.lat, lon: d.lon, status: d.status }).eq('uid', p[1]);
            }
            else if (p[0] === 'meeting' && p[1] === 'history' && p.length === 4) {
                // UPDATE inteligente: só altera o que foi enviado
                const u = { updated_at: new Date().toISOString() };
                if (d.status !== undefined) u.status = d.status;
                if (d.driverName || d.driver_name) u.driver_name = d.driverName || d.driver_name;
                if (d.vehicleType || d.vehicle_type) u.vehicle_type = d.vehicleType || d.vehicle_type;
                if (d.passengers !== undefined) u.passengers = d.passengers;
                if (d.predictedRoute || d.predicted_route) u.predicted_route = d.predictedRoute || d.predicted_route;
                if (d.arrivalRoute || d.arrival_route) u.arrival_route = d.arrivalRoute || d.arrival_route;
                if (d.returnRoute || d.return_route) u.return_route = d.returnRoute || d.return_route;
                if (d.totalKm !== undefined) u.total_km = d.totalKm;
                if (d.reimbursement !== undefined) u.reimbursement = d.reimbursement;
                if (d.completedAt || d.completed_at) u.completed_at = d.completedAt ? new Date(d.completedAt).toISOString() : d.completed_at;
                
                const { error } = await _realSB.from('meeting_history').update(u).eq('date', p[2]).eq('driver_uid', p[3]);
                if (error) {
                    // Se o update falhou porque a linha não existe, tentamos um upsert fallback
                    console.warn('[Shim-V2] Update falhou (linha inexistente?), tentando Upsert...');
                    await this.set({ ...d });
                }
            }
        }

        async push(d) {
            const p = this.path.split('/').filter(Boolean);
            if (p[0] === 'mensagens' && p.length === 2) {
                await _realSB.from('mensagens').insert({ vendor_uid: p[1], sender: d.sender, content: d.text, ts: new Date().toISOString() });
            }
        }

        async remove() {
            const p = this.path.split('/').filter(Boolean);
            if (p[0] === 'usuarios' && p.length === 2) {
                await _realSB.from('usuarios').delete().eq('uid', p[1]);
                return;
            }
            if (p[0] === 'vendedores' && p.length === 2) {
                await _realSB.from('vendedores').delete().eq('uid', p[1]);
                return;
            }
            if (p[0] === 'mensagens' && p.length === 2) {
                await _realSB.from('mensagens').delete().eq('vendor_uid', p[1]);
                return;
            }
            if (p[0] === 'meeting' && p[1] === 'participants' && p.length === 3) {
                await _realSB.from('meeting_participants').delete().eq('vendor_uid', p[2]);
                return;
            }
            if (p[0] === 'meeting' && p[1] === 'driverPickups' && p.length === 3) {
                await _realSB.from('meeting_driver_pickups').delete().eq('driver_uid', p[2]);
                return;
            }
            if (p[0] === 'meeting' && p[1] === 'history' && p.length === 4) {
                await _realSB.from('meeting_history').delete().eq('date', p[2]).eq('driver_uid', p[3]);
            }
        }

        onDisconnect() { return { update: async () => { } }; }
    }

    window.firebase = { database: () => ({ ref: (p) => new _Ref(p) }), auth: () => _auth };
    window.supabase.database = window.firebase.database;
    window.supabase.auth = () => _auth;
    console.log("UniRotas Shim V2.4: Ultra Ready.");
})();
