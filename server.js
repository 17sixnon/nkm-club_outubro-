'use strict';

const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'NKM-ADM-Andreas17';
const ADMIN_TOKEN_2 = process.env.ADMIN_TOKEN_2 || 'NKM-ADM-Gabriel18';
const ADM_PHONE = process.env.ADM_PHONE || '+55 41 99175-6327';
const PIX_KEY = process.env.PIX_KEY || '+5541995816535';
const PIX_NAME = (process.env.PIX_NAME || 'NKM EVENTS').toUpperCase().slice(0, 25);
const PIX_CITY = (process.env.PIX_CITY || 'CURITIBA').toUpperCase().slice(0, 25);
const MAX_TICKETS = process.env.MAX_TICKETS ? parseInt(process.env.MAX_TICKETS, 10) : null;

const TICKET_PRICE_MALE = process.env.TICKET_PRICE_MALE || '40.00';
const TICKET_PRICE_FEMALE = process.env.TICKET_PRICE_FEMALE || '20.00';
const PRICE_TIER2_AFTER = parseInt(process.env.PRICE_TIER2_AFTER || '100', 10);
const TICKET_PRICE_MALE_TIER2 = process.env.TICKET_PRICE_MALE_TIER2 || '50.00';
const TICKET_PRICE_FEMALE_TIER2 = process.env.TICKET_PRICE_FEMALE_TIER2 || '25.00';

const PUBLIC_URL = process.env.PUBLIC_URL || '';

const countValidTickets = (tickets) => tickets.filter((t) => t.status === 'paid').length;
const isTier2 = (tickets) => countValidTickets(tickets) >= PRICE_TIER2_AFTER;
const priceFor = (gender, tickets) => {
  const tier2 = isTier2(tickets || []);
  if (gender === 'M') return Number(tier2 ? TICKET_PRICE_MALE_TIER2 : TICKET_PRICE_MALE);
  return Number(tier2 ? TICKET_PRICE_FEMALE_TIER2 : TICKET_PRICE_FEMALE);
};

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');
const VISIT_RETENTION_DAYS = 30;

function loadTickets() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tickets, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function loadMetrics() {
  try {
    const parsed = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMetrics(metrics) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = METRICS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(metrics, null, 2));
  fs.renameSync(tmp, METRICS_FILE);
}

function pruneMetrics(metrics) {
  const cutoff = Date.now() - VISIT_RETENTION_DAYS * 86400000;
  return metrics.filter(m => new Date(m.ts).getTime() > cutoff);
}

function recordVisit(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const ua = (req.headers['user-agent'] || '').slice(0, 120);
  const path = req.path || '/';
  const metrics = pruneMetrics(loadMetrics());
  metrics.push({ ts: new Date().toISOString(), ip: String(ip).split(',')[0].trim(), path, ua });
  saveMetrics(metrics);
  return metrics;
}

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, value) {
  const v = String(value);
  if (v.length > 99) throw new Error('TLV value too long');
  return id + v.length.toString().padStart(2, '0') + v;
}

function buildPixString(ref, amount) {
  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', PIX_KEY);
  let emv =
    tlv('00', '01') +
    tlv('01', '11') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986');
  if (amount) emv += tlv('54', Number(amount).toFixed(2));
  emv +=
    tlv('58', 'BR') +
    tlv('59', PIX_NAME) +
    tlv('60', PIX_CITY) +
    tlv('62', tlv('05', ref)) +
    tlv('63', '0000');
  return emv.slice(0, -4) + crc16(emv);
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `NKM-${s.slice(0, 4)}-${s.slice(4)}`;
}

function maskName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function maskCPF(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return '---';
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

function formatCPF(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCPF(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1{11}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === Number(d[10]);
}

function findTicket(tickets, code) {
  const norm = String(code || '').trim().toUpperCase();
  return tickets.find((t) => t.code === norm);
}

function mpPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('55')) {
    return { area_code: digits.slice(2, 4), number: digits.slice(4) };
  }
  if (digits.length >= 10) {
    return { area_code: digits.slice(0, 2), number: digits.slice(2) };
  }
  return null;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/js/') && !req.path.startsWith('/api/') && !/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/.test(req.path)) {
    try { recordVisit(req); } catch (e) { /* não quebra o site */ }
  }
  next();
});

const postHits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const hits = (postHits.get(ip) || []).filter((t) => now - t < 60000);
  if (hits.length >= 10) {
    return res.status(429).json({ message: 'Muitas tentativas. Aguarde um minuto.' });
  }
  hits.push(now);
  postHits.set(ip, hits);
  next();
}

function isAdmin(req) {
  const t = req.get('x-admin-token');
  return t === ADMIN_TOKEN || t === ADMIN_TOKEN_2;
}

function adminOnly(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ message: 'Token de administrador inválido.' });
  next();
}

function ticketOrigin(req) {
  return PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

app.get('/api/config', (req, res) => {
  const tickets = loadTickets();
  const valid = countValidTickets(tickets);
  const tier2 = isTier2(tickets);
  res.json({
    priceMale: tier2 ? TICKET_PRICE_MALE_TIER2 : TICKET_PRICE_MALE,
    priceFemale: tier2 ? TICKET_PRICE_FEMALE_TIER2 : TICKET_PRICE_FEMALE,
    priceTier2: tier2,
    lot: tier2 ? 2 : 1,
    validTickets: valid,
    tier2After: PRICE_TIER2_AFTER,
    maxTickets: MAX_TICKETS,
    soldOut: MAX_TICKETS ? tickets.length >= MAX_TICKETS : false,
    pixKey: PIX_KEY,
  });
});

app.post('/api/tickets', rateLimit, async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    const phone = String((req.body && req.body.phone) || '').trim();
    const gender = String((req.body && req.body.gender) || '').trim().toUpperCase();
    const cpf = String((req.body && req.body.cpf) || '').replace(/\D/g, '');

    if (name.length < 5) {
      return res.status(400).json({ message: 'Informe seu nome completo.' });
    }
    if (!['M', 'F'].includes(gender)) {
      return res.status(400).json({ message: 'Selecione o gênero do ingresso: Homem ou Mulher.' });
    }
    if (!isValidCPF(cpf)) {
      return res.status(400).json({ message: 'CPF inválido. Verifique os 11 dígitos.' });
    }
    if (phone && !/^\+?\d{10,15}$/.test(phone.replace(/[\s()-]/g, ''))) {
      return res.status(400).json({ message: 'WhatsApp inválido.' });
    }

    const tickets = loadTickets();
    if (MAX_TICKETS && tickets.length >= MAX_TICKETS) {
      return res.status(409).json({ message: 'Capacidade esgotada. Ingressos não disponíveis.' });
    }
    const existing = tickets.find((t) => t.cpf === cpf);
    if (existing) {
      return res.status(409).json({
        message: `Este CPF já possui o ingresso ${existing.code} (${existing.status}). Um ingresso por CPF.`,
      });
    }

    let code = genCode();
    while (findTicket(tickets, code)) code = genCode();

    const price = priceFor(gender, tickets);

    const pixString = buildPixString(code, price);
    const pixQr = await QRCode.toDataURL(pixString, {
      width: 380,
      margin: 1,
      color: { dark: '#150b24', light: '#ffffff' },
    });
    const pix = { key: PIX_KEY, string: pixString, qr: pixQr };

    const ticket = {
      code,
      name,
      phone,
      cpf,
      gender,
      pricePaid: price,
      status: 'pending',
      mode: 'manual',
      pixString,
      createdAt: new Date().toISOString(),
      paidAt: null,
      usedAt: null,
      rgNumber: null,
      entryPhoto: null,
      documentVerified: false,
    };
    tickets.unshift(ticket);
    saveTickets(tickets);

    res.json({
      ok: true,
      mode: 'manual',
      price,
      ticket: { code, name, status: ticket.status, gender, pricePaid: price },
      pix,
      admin: { phone: ADM_PHONE },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Falha ao gerar ingresso. Tente novamente.' });
  }
});

app.get('/api/tickets/:code', async (req, res) => {
  try {
    const tickets = loadTickets();
    const ticket = findTicket(tickets, req.params.code);
    if (!ticket) return res.status(404).json({ message: 'Ingresso não encontrado.' });

    const admin = isAdmin(req);
    const data = {
      code: ticket.code,
      name: ticket.name,
      gender: ticket.gender,
      pricePaid: ticket.pricePaid,
      cpf: admin ? ticket.cpf : maskCPF(ticket.cpf),
      status: ticket.status,
      mode: ticket.mode || 'manual',
      createdAt: ticket.createdAt,
      paidAt: ticket.paidAt,
      usedAt: ticket.usedAt,
    };
    if (ticket.status === 'paid' || ticket.status === 'used') {
      data.qr = await QRCode.toDataURL(`${ticketOrigin(req)}/t/${ticket.code}`, {
        width: 420,
        margin: 1,
        color: { dark: '#150b24', light: '#ffffff' },
      });
    }
    if (ticket.status === 'pending') {
      const pixStr = ticket.brCode || ticket.pixString;
      if (pixStr) {
        data.pixQr = await QRCode.toDataURL(pixStr, {
          width: 380,
          margin: 1,
          color: { dark: '#150b24', light: '#ffffff' },
        });
        data.pixString = pixStr;
        data.pixKey = PIX_KEY;
      }
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao consultar ingresso.' });
  }
});

app.delete('/api/tickets', adminOnly, (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
    console.log('[adm] Base de clientes limpada.');
    res.json({ ok: true, message: 'Base de clientes limpa.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao limpar a base.' });
  }
});

app.get('/api/tickets', adminOnly, (req, res) => {
  const tickets = loadTickets();
  const summary = {
    total: tickets.length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    paid: tickets.filter((t) => t.status === 'paid').length,
    used: tickets.filter((t) => t.status === 'used').length,
    male: tickets.filter((t) => t.gender === 'M').length,
    female: tickets.filter((t) => t.gender === 'F').length,
  };
  res.json({ summary, tickets: tickets.slice(0, 500) });
});

app.get('/api/metrics', adminOnly, (req, res) => {
  try {
    const metrics = pruneMetrics(loadMetrics());
    const uniqueIps = new Set(metrics.map(m => m.ip)).size;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = metrics.filter(m => m.ts.slice(0, 10) === today).length;
    const last7 = metrics.filter(m => new Date(m.ts).getTime() > Date.now() - 7 * 86400000).length;
    const byPath = {};
    metrics.forEach(m => { byPath[m.path] = (byPath[m.path] || 0) + 1; });
    const recent = metrics.slice().reverse().slice(0, 50).map(m => ({ ts: m.ts, ip: m.ip, path: m.path }));
    res.json({
      total: metrics.length,
      uniqueIps,
      today: todayCount,
      last7Days: last7,
      byPath,
      recent,
      retentionDays: VISIT_RETENTION_DAYS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao carregar métricas.' });
  }
});

app.delete('/api/metrics', adminOnly, (req, res) => {
  try {
    if (fs.existsSync(METRICS_FILE)) fs.unlinkSync(METRICS_FILE);
    res.json({ ok: true, message: 'Métricas de visitas apagadas.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao apagar métricas.' });
  }
});

app.get('/api/metrics/live', (req, res) => {
  const token = req.get('x-admin-token');
  if (!isAdmin({ get: (k) => req.get(k) })) {
    return res.status(401).json({ message: 'Token de administrador inválido.' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = () => {
    try {
      const metrics = pruneMetrics(loadMetrics());
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = metrics.filter(m => m.ts.slice(0, 10) === today).length;
      const last7 = metrics.filter(m => new Date(m.ts).getTime() > Date.now() - 7 * 86400000).length;
      const uniqueIps = new Set(metrics.map(m => m.ip)).size;
      const byPath = {};
      const byDay = {};
      metrics.forEach(m => {
        const day = m.ts.slice(0, 10);
        byPath[m.path] = (byPath[m.path] || 0) + 1;
        byDay[day] = (byDay[day] || 0) + 1;
      });
      const payload = JSON.stringify({
        total: metrics.length,
        uniqueIps,
        today: todayCount,
        last7Days: last7,
        byPath,
        byDay,
        ts: new Date().toISOString(),
      });
      res.write(`data: ${payload}\n\n`);
    } catch (e) {}
  };
  send();
  const iv = setInterval(send, 3000);
  req.on('close', () => { clearInterval(iv); });
});

app.get('/api/metrics/series', adminOnly, (req, res) => {
  try {
    const metrics = pruneMetrics(loadMetrics());
    const days = Math.max(1, Math.min(30, parseInt(req.query.days, 10) || 7));
    const buckets = {};
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      buckets[d] = { visits: 0, unique: new Set() };
    }
    metrics.forEach(m => {
      const day = m.ts.slice(0, 10);
      if (buckets[day]) {
        buckets[day].visits++;
        buckets[day].unique.add(m.ip);
      }
    });
    const series = Object.entries(buckets).map(([day, b]) => ({
      day,
      visits: b.visits,
      unique: b.unique.size,
    }));
    res.json({ days, series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao carregar série temporal.' });
  }
});

app.post('/api/tickets/:code/confirm', adminOnly, (req, res) => {
  const tickets = loadTickets();
  const ticket = findTicket(tickets, req.params.code);
  if (!ticket) return res.status(404).json({ message: 'Ingresso não encontrado.' });
  if (ticket.status === 'used') {
    return res.status(409).json({ message: 'Ingresso já utilizado. Não é possível confirmar pagamento.' });
  }
  if (ticket.status === 'paid') {
    return res.json({ ok: true, ticket, message: 'Ingresso já estava confirmado.' });
  }
  ticket.status = 'paid';
  ticket.paidAt = new Date().toISOString();
  ticket.confirmedBy = 'manual';
  saveTickets(tickets);
  res.json({ ok: true, ticket, message: 'Pagamento confirmado. Ingresso liberado.' });
});

app.post('/api/tickets/:code/redeem', adminOnly, (req, res) => {
  const tickets = loadTickets();
  const ticket = findTicket(tickets, req.params.code);
  if (!ticket) return res.status(404).json({ message: 'Ingresso não encontrado.' });
  if (ticket.status === 'used') {
    return res.status(409).json({
      message: `Ingresso já utilizado em ${new Date(ticket.usedAt).toLocaleTimeString('pt-BR')}.`,
    });
  }
  if (ticket.status === 'pending') {
    return res.status(400).json({ message: 'Pagamento não confirmado. Confirme o PIX antes da entrada.' });
  }

  const docCpf = String((req.body && req.body.cpf) || '').replace(/\D/g, '');
  if (!isValidCPF(docCpf)) {
    return res.status(400).json({ message: 'CPF do documento inválido. Verifique os 11 dígitos.' });
  }
  if (ticket.cpf && docCpf !== ticket.cpf) {
    return res.status(400).json({ message: 'CPF não confere com o ingresso. Verifique o documento do cliente.' });
  }

  const entryPhoto = String((req.body && req.body.entryPhoto) || '');
  ticket.rgNumber = String((req.body && req.body.rg) || '').trim() || null;
  ticket.entryPhoto = entryPhoto && entryPhoto.length <= 700000 ? entryPhoto : null;
  ticket.documentVerified = true;
  ticket.status = 'used';
  ticket.usedAt = new Date().toISOString();
  saveTickets(tickets);
  res.json({ ok: true, ticket, message: `Entrada liberada para ${ticket.name}.` });
});

app.get('/t/:code', (req, res) => {
  const ticket = findTicket(loadTickets(), req.params.code);
  const statusMap = {
    pending: { label: 'AGUARDANDO PAGAMENTO', color: '#ffa04d', bg: 'rgba(255,117,24,.15)' },
    paid: { label: 'INGRESSO VÁLIDO', color: '#39ff8e', bg: 'rgba(57,255,142,.15)' },
    used: { label: 'INGRESSO JÁ UTILIZADO', color: '#ff5b5b', bg: 'rgba(255,91,91,.15)' },
  };
  const st = ticket ? statusMap[ticket.status] : { label: 'INGRESSO NÃO ENCONTRADO', color: '#ff5b5b', bg: 'rgba(255,91,91,.15)' };
  const autoReload = ticket && ticket.status === 'pending';
  const genderLabel = ticket ? (ticket.gender === 'M' ? '👨 Homem' : '👩 Mulher') : '';
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HALLOWEEN NKM — Verificação de Ingresso</title>
${autoReload ? '<meta http-equiv="refresh" content="15">' : ''}
<style>
  body{font-family:'Montserrat',sans-serif;background:#0a0612;color:#f3eefc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
  .card{background:#150b24;border:1px solid ${st.color};border-radius:24px;padding:40px;max-width:420px;width:100%;text-align:center;box-shadow:0 0 40px ${st.bg}}
  .logo{font-family:'Creepster',cursive;font-size:1.6rem;color:#ff7518;letter-spacing:2px}
  .badge{display:inline-block;margin:24px 0 10px;padding:10px 24px;border-radius:100px;font-weight:800;letter-spacing:2px;color:${st.color};background:${st.bg};border:1px solid ${st.color}}
  .code{font-size:1.5rem;font-weight:900;letter-spacing:3px;margin:8px 0}
  .who{color:#b9a8d6;font-size:.9rem}
  .foot{margin-top:28px;color:#b9a8d6;font-size:.75rem;letter-spacing:1px}
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🎃 HALLOWEEN NKM</div>
    <div class="badge">${st.label}</div>
    ${ticket ? `<div class="code">${ticket.code}</div><div class="who">${maskName(ticket.name)} · ${genderLabel} · R$ ${Number(ticket.pricePaid || 0).toFixed(2).replace('.', ',')}</div>` : '<div class="who">Este código não existe no sistema.</div>'}
    <div class="foot">30 DE OUTUBRO · 21H · PROF. BRANDÃO Nº 51 — ALTO DA VX</div>
  </div>
</body>
</html>`);
});

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Halloween NKM rodando em http://localhost:${PORT}`);
  console.log(`Painel do ADM: http://localhost:${PORT}/admin.html`);
  console.log(`Pagamento: Pix estático + confirmação manual`);
  console.log(`Preços: Homem R$ ${Number(TICKET_PRICE_MALE).toFixed(2)} / Mulher R$ ${Number(TICKET_PRICE_FEMALE).toFixed(2)}`);
});
