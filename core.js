// Booking logic shared by the app (window.GarageCore) and the /api/db server function (require).
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const shiftKey = (k, n) => { const [y, m, d] = k.split('-').map(Number); return dkey(addDays(new Date(y, m - 1, d), n)); };

  const SVC = {
    m1:[4800,60], m2:[1200,20], m3:[900,15], m4:[700,15], m5:[8400,90], m6:[3600,60],
    b1:[12000,60], b2:[9600,60], b3:[28000,120], b4:[24000,120], b5:[3200,45], b6:[6400,120],
    su1:[34000,150], su2:[30000,150], su3:[8800,180], su4:[4200,60], su5:[2800,45],
    d1:[3500,30], d2:[5500,60], d3:[4200,60], d4:[7500,90],
    e1:[14000,30], e2:[3800,30], e3:[6200,45], e4:[9800,60],
    dt1:[18000,240], dt2:[65000,480], dt3:[42000,300], dt4:[8500,180],
  };
  const SVC_DUR = Object.fromEntries(Object.entries(SVC).map(([k, v]) => [k, v[1]]));

  const DEFAULT_SETTINGS = { boxes:2, open:'09:00', close:'19:00', pin:'1234', ownerTg:null,
    ownerUsername:'', ownerPhone:'', cashbackPct:5,
    shop:{ name:'GARAGE · Москва', address:'ул. Автозаводская, 18', phone:'+7 900 123-45-67', tagline:'' } };

  // Public showcase workshop for the sales page: its PIN is published, its owner fields are locked.
  const SHOWCASE = 'showcase', SHOWCASE_PIN = '0000';
  // Every visitor of the showcase gets a private copy (sandbox) that starts from the seed data.
  const isSandbox = t => /^sbx-[a-z0-9]{12,32}$/.test(t || '');
  const isShowcase = t => t === SHOWCASE || isSandbox(t);
  const digits = s => String(s || '').replace(/\D/g, '');
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const cleanUsername = v => str(v, 60).replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
  const validUsername = v => /^[A-Za-z0-9_]{5,32}$/.test(v);
  const validPhone = v => digits(v).length >= 10 && digits(v).length <= 15;
  const samePhone = (a, b) => validPhone(a) && validPhone(b) && digits(a).slice(-10) === digits(b).slice(-10);
  const validHM = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
  const newKey = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);

  function emptyDB() {
    return { seq:100, settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), overrides:{}, closed:[], bookings:[] };
  }

  // A newly registered workshop: its own settings and owner account, default service list, no bookings.
  function newTenantDB(input) {
    const s = input || {}, svc = s.service || {}, own = s.owner || {}, sch = s.schedule || {};
    const name = str(svc.name, 60), username = cleanUsername(own.username), phone = str(own.phone, 30);
    if (name.length < 2) return { error:'name' };
    if (!validUsername(username)) return { error:'username' };
    if (!validPhone(phone)) return { error:'phone' };
    if (!/^\d{4}$/.test(own.pin || '')) return { error:'pin' };
    const open = validHM(sch.open) ? sch.open : '09:00', close = validHM(sch.close) ? sch.close : '19:00';
    if (toMin(open) >= toMin(close)) return { error:'hours' };
    const db = emptyDB();
    Object.assign(db.settings, {
      boxes:Math.min(4, Math.max(1, Number(sch.boxes) || 1)), open, close, pin:own.pin,
      ownerUsername:username, ownerPhone:phone,
      shop:{ name, address:str(svc.address, 100), phone:str(svc.phone, 30) || phone, tagline:str(svc.tagline, 140) },
    });
    return { db };
  }

  // Demo workshop: history from other clients so the dashboard and the schedule are not empty on day one.
  function seedDB(showcase) {
    const k = n => dkey(addDays(new Date(), n));
    const ago = min => Date.now() - min * 60000;
    const db = emptyDB();
    db.settings.ownerUsername = showcase ? '' : 'Sergey_ITAI';
    if (showcase) { db.settings.pin = SHOWCASE_PIN; db.settings.shop = { ...db.settings.shop, name:'GARAGE · Демо' }; }
    db.closed = [k(6)];
    db.bookings = [
      { id:96,  date:k(0), start:'10:00', dur:180, box:1, svc:['b1','b3'], total:40000, name:'Алексей М.', phone:'+7 916 555-12-40', car:{ make:'BMW', model:'X5', year:'2019', plate:'О 777 ОО 77' }, status:'confirmed', src:'app', created:ago(1500) },
      { id:97,  date:k(0), start:'13:00', dur:80,  box:2, svc:['m1','m2'], total:6000,  name:'Ирина К.',   phone:'+7 903 555-77-18', car:{ make:'Kia', model:'Rio', year:'2021', plate:'В 123 ВВ 50' }, status:'confirmed', src:'ai',  created:ago(1300) },
      { id:98,  date:k(1), start:'09:00', dur:150, box:1, svc:['su1'],     total:34000, name:'Дмитрий',    phone:'+7 925 555-03-91', car:null, status:'confirmed', src:'app', created:ago(900) },
      { id:99,  date:k(1), start:'15:00', dur:60,  box:2, svc:['d2'],      total:5500,  name:'Олег Р.',    phone:'+7 977 555-64-22', car:{ make:'Toyota', model:'Camry', year:'2018', plate:'Е 555 КХ 99' }, status:'new', src:'app', created:ago(25) },
      { id:100, date:k(2), start:'11:00', dur:240, box:1, svc:['dt1'],     total:18000, name:'Марина',     phone:'+7 915 555-48-06', car:{ make:'Mercedes', model:'C200', year:'2020', plate:'М 001 ММ 77' }, status:'new', src:'ai', created:ago(120) },
    ];
    return db;
  }

  function priceOf(db, id) {
    const base = SVC[id]; if (!base) return null;
    const o = db.overrides[id] || {};
    return { price:o.price ?? base[0], dur:o.dur ?? base[1], off:!!o.off };
  }

  // Every 30-min start in working hours; box = first box free for the whole duration, 0 = taken.
  // `now` hides slots that already started (the server passes nothing: its clock is UTC, not the client's).
  function freeSlots(db, date, dur, now) {
    if (!dur || db.closed.includes(date)) return [];
    const { boxes, open, close } = db.settings;
    const o = toMin(open), c = toMin(close);
    const busy = db.bookings.filter(b => b.date === date && b.status !== 'cancelled' && b.status !== 'done');
    const nowM = now && date === dkey(now) ? now.getHours() * 60 + now.getMinutes() + 30 : -1;
    const out = [];
    for (let t = o; t + dur <= c; t += 30) {
      if (t <= nowM) continue;
      let box = 0;
      for (let b = 1; b <= boxes && !box; b++) {
        if (!busy.some(x => x.box === b && t < toMin(x.start) + x.dur && toMin(x.start) < t + dur)) box = b;
      }
      out.push({ time:toHM(t), box });
    }
    return out;
  }

  // Owner access: the PIN, plus either the owner's phone or their Telegram account.
  // Workshops created before owner accounts existed (no owner phone) accept the PIN alone.
  function ownerAuthOk(db, auth, tgUser) {
    const S = db.settings;
    if (!auth || typeof auth.pin !== 'string' || auth.pin !== (S.pin || '1234')) return false;
    if (!S.ownerPhone) return true;
    return isOwnerUser(db, tgUser) || samePhone(auth.phone, S.ownerPhone);
  }
  function isOwnerUser(db, tgUser) {
    const u = db.settings.ownerUsername;
    return !!(tgUser && tgUser.username && u && tgUser.username.toLowerCase() === u.toLowerCase());
  }
  // The second factor alone (phone or Telegram nick), for the server, which checks the PIN against its hash itself.
  function ownerIdentityOk(db, auth, tgUser) {
    const S = db.settings;
    if (!S.ownerPhone) return true;
    return isOwnerUser(db, tgUser) || samePhone(auth && auth.phone, S.ownerPhone);
  }

  // Personal data of a booking is removed but the slot stays, so the schedule and revenue remain correct.
  function anonymize(b) {
    b.name = '-'; b.phone = ''; b.car = null; b.tgId = null; b.erased = true;
  }
  // Retention: personal data of visits older than a year is not kept.
  function expireOldData(db, today) {
    if (!today) return 0;
    const cutoff = shiftKey(today, -365);
    let n = 0;
    db.bookings.forEach(b => { if (!b.erased && b.status !== 'block' && b.date < cutoff) { anonymize(b); n++; } });
    return n;
  }
  // A client asks to delete their data: their upcoming visits are cancelled, all their bookings anonymized.
  function forgetClient(db, mine, today) {
    const own = new Set((Array.isArray(mine) ? mine : []).slice(0, 200).map(m => `${m && m.id}:${m && m.key}`));
    let n = 0;
    db.bookings.forEach(b => {
      if (!own.has(`${b.id}:${b.key}`)) return;
      if (['new', 'confirmed'].includes(b.status) && (!today || b.date >= today)) b.status = 'cancelled';
      anonymize(b); n++;
    });
    return n;
  }
  // What the owner's app receives: everything except the PIN and its hash.
  function ownerView(db) {
    const { pin, pinHash, ...settings } = db.settings;
    return { ...db, settings };
  }

  // All writes go through here, both in the local demo and on the server.
  // `op.today` (YYYY-MM-DD) bounds dates; the server passes its UTC date, so one day of slack each way.
  function applyOp(db, op) {
    const S = db.settings;
    const today = op && op.today;
    switch (op && op.type) {
      case 'book': {
        const d = op.data || {};
        const svc = [...new Set(Array.isArray(d.svc) ? d.svc : [])].filter(id => priceOf(db, id) && !priceOf(db, id).off).slice(0, 12);
        const name = str(d.name, 60), phone = str(d.phone, 30);
        if (!svc.length || name.length < 2 || !validPhone(phone)) return { error:'invalid' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || !validHM(d.start)) return { error:'invalid' };
        if (today && (d.date < shiftKey(today, -1) || d.date > shiftKey(today, 60))) return { error:'invalid' };
        if (!d.consent) return { error:'consent' };
        const dur = svc.reduce((s, id) => s + priceOf(db, id).dur, 0);
        const total = svc.reduce((s, id) => s + priceOf(db, id).price, 0);
        const slot = freeSlots(db, d.date, dur).find(s => s.time === d.start);
        if (!slot || !slot.box) return { error:'slot_taken' };
        const car = d.car && typeof d.car === 'object' && str(d.car.make, 40)
          ? { make:str(d.car.make, 40), model:str(d.car.model, 40), year:digits(d.car.year).slice(0, 4), plate:str(d.car.plate, 20) } : null;
        db.seq = (db.seq || 100) + 1;
        const booking = { id:db.seq, key:newKey(), date:d.date, start:d.start, dur, box:slot.box, svc, total, name, phone, car,
          src:d.src === 'ai' ? 'ai' : 'app', status:'new', created:Date.now(), consentAt:Date.now(), tgId:Number(d.tgId) || null };
        db.bookings.push(booking);
        return { booking };
      }
      // The owner corrects a client's details or moves the visit; a move must fit a free box.
      case 'edit': {
        const b = db.bookings.find(x => x.id === op.id && x.status !== 'block');
        if (!b) return { error:'not_found' };
        const p = op.patch || {};
        const name = p.name != null ? str(p.name, 60) : b.name, phone = p.phone != null ? str(p.phone, 30) : b.phone;
        if (name.length < 2 || !validPhone(phone)) return { error:'invalid' };
        let car = b.car;
        if ('car' in p) car = p.car && typeof p.car === 'object' && str(p.car.make, 40)
          ? { make:str(p.car.make, 40), model:str(p.car.model, 40), year:digits(p.car.year).slice(0, 4), plate:str(p.car.plate, 20) } : null;
        const date = p.date ?? b.date, start = p.start ?? b.start;
        let box = b.box;
        if (date !== b.date || start !== b.start) {
          if (!['new', 'confirmed'].includes(b.status)) return { error:'invalid' };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validHM(start)) return { error:'invalid' };
          if (today && (date < shiftKey(today, -1) || date > shiftKey(today, 60))) return { error:'invalid' };
          const slot = freeSlots({ ...db, bookings:db.bookings.filter(x => x !== b) }, date, b.dur).find(s => s.time === start);
          if (!slot || !slot.box) return { error:'slot_taken' };
          box = slot.box;
        }
        const moved = date !== b.date || start !== b.start;
        Object.assign(b, { name, phone, car, date, start, box });
        return { booking:b, moved };
      }
      // A client cancels their own upcoming visit (proved by its id + key).
      case 'clientCancel': {
        const b = db.bookings.find(x => x.id === op.id && x.key && x.key === op.key);
        if (!b) return { error:'not_found' };
        if (!['new', 'confirmed'].includes(b.status) || (today && b.date < shiftKey(today, -1))) return { error:'invalid' };
        b.status = 'cancelled';
        return { booking:b };
      }
      case 'status': {
        if (!['new', 'confirmed', 'cancelled', 'done'].includes(op.status)) return { error:'invalid' };
        const b = db.bookings.find(x => x.id === op.id && x.status !== 'block');
        if (!b) return { error:'not_found' };
        b.status = op.status;
        return { booking:b };
      }
      case 'settings': {
        const p = op.patch || {};
        if (p.boxes != null) {
          const boxes = Math.min(4, Math.max(1, Number(p.boxes) || 1));
          const used = db.bookings.filter(b => ['new', 'confirmed'].includes(b.status) && (!today || b.date >= shiftKey(today, -1)))
            .reduce((m, b) => Math.max(m, b.box || 0), 0);
          if (boxes < used) return { error:'boxes_in_use' };
          S.boxes = boxes;
          db.bookings = db.bookings.filter(b => b.status !== 'block' || b.box <= boxes);
        }
        const open = validHM(p.open) ? p.open : S.open, close = validHM(p.close) ? p.close : S.close;
        if (toMin(open) >= toMin(close)) return { error:'hours' };
        S.open = open; S.close = close;
        // Changing the PIN or the owner phone bumps pinVer, which ends every other owner session on the server.
        if (p.pin != null) { if (!/^\d{4}$/.test(p.pin)) return { error:'pin' }; S.pin = p.pin; S.pinVer = (S.pinVer || 0) + 1; }
        if (p.ownerUsername != null) { const u = cleanUsername(p.ownerUsername); if (u && !validUsername(u)) return { error:'username' }; S.ownerUsername = u; }
        if (p.ownerPhone != null) {
          const ph = str(p.ownerPhone, 30); if (ph && !validPhone(ph)) return { error:'phone' };
          if (ph !== S.ownerPhone) S.pinVer = (S.pinVer || 0) + 1;
          S.ownerPhone = ph;
        }
        if (p.cashbackPct != null) S.cashbackPct = Math.min(30, Math.max(0, Math.round(Number(p.cashbackPct) || 0)));
        if ('ownerTg' in p) S.ownerTg = p.ownerTg && Number(p.ownerTg.id) > 0
          ? { id:Number(p.ownerTg.id), name:str(p.ownerTg.name, 60), username:str(p.ownerTg.username, 40) } : null;
        if (p.shop) {
          const cur = S.shop || {};
          const name = str(p.shop.name ?? cur.name, 60);
          if (name.length < 2) return { error:'name' };
          S.shop = { name, address:str(p.shop.address ?? cur.address ?? '', 100), phone:str(p.shop.phone ?? cur.phone ?? '', 30), tagline:str(p.shop.tagline ?? cur.tagline ?? '', 140) };
        }
        return {};
      }
      case 'override': {
        if (!SVC[op.id]) return { error:'invalid' };
        const o = { ...(db.overrides[op.id] || {}) }, p = op.patch || {};
        if (p.price != null) o.price = Math.min(10000000, Math.max(0, Math.round(Number(p.price) || 0)));
        if (p.dur != null) o.dur = Math.min(600, Math.max(15, Math.round(Number(p.dur) || 15)));
        if (p.off != null) o.off = !!p.off;
        db.overrides[op.id] = o;
        return {};
      }
      case 'toggleDay':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date || '')) return { error:'invalid' };
        db.closed = db.closed.includes(op.date) ? db.closed.filter(x => x !== op.date) : [...db.closed, op.date];
        return {};
      case 'toggleBlock': {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date || '') || !(op.box >= 1 && op.box <= S.boxes)) return { error:'invalid' };
        const ex = db.bookings.find(b => b.date === op.date && b.box === op.box && b.status === 'block');
        if (ex) db.bookings = db.bookings.filter(b => b !== ex);
        else { db.seq++; db.bookings.push({ id:db.seq, date:op.date, start:S.open, dur:toMin(S.close) - toMin(S.open), box:op.box, status:'block', svc:[], total:0, created:Date.now() }); }
        return {};
      }
      case 'reset': {
        const keep = { pin:S.pin, pinHash:S.pinHash, pinVer:S.pinVer, ownerTg:S.ownerTg, ownerUsername:S.ownerUsername, ownerPhone:S.ownerPhone };
        const fresh = seedDB(!!op.showcase);
        Object.keys(db).forEach(k => delete db[k]);
        Object.assign(db, fresh);
        Object.assign(db.settings, keep);
        return {};
      }
      default:
        return { error:'bad_op' };
    }
  }

  // What a client may see: busy slots without names or phones, plus their own bookings (matched by id + key).
  function publicView(db, mine) {
    const own = new Set((Array.isArray(mine) ? mine : []).map(m => `${m && m.id}:${m && m.key}`));
    const { boxes, open, close, shop, cashbackPct } = db.settings;
    return {
      seq:db.seq, settings:{ boxes, open, close, shop, cashbackPct:cashbackPct ?? 5, ownerPhoneRequired:!!db.settings.ownerPhone },
      overrides:db.overrides, closed:db.closed,
      bookings:db.bookings
        .filter(b => own.has(`${b.id}:${b.key}`) || (b.status !== 'cancelled' && b.status !== 'done'))
        .map(b => {
          if (own.has(`${b.id}:${b.key}`)) { const { tgId, consentAt, ...rest } = b; return rest; }
          return { id:b.id, date:b.date, start:b.start, dur:b.dur, box:b.box, status:b.status === 'block' ? 'block' : 'busy' };
        }),
    };
  }

  const api = { SHOWCASE, SHOWCASE_PIN, isSandbox, isShowcase, SVC_DUR, emptyDB, seedDB, newTenantDB, freeSlots, applyOp, publicView, ownerView, priceOf, ownerAuthOk, ownerIdentityOk, isOwnerUser,
    anonymize, expireOldData, forgetClient, dkey, validUsername, validPhone, cleanUsername };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GarageCore = api;
})(typeof self !== 'undefined' ? self : this);
