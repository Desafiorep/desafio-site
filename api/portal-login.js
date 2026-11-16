/**
 * Login do portal do cliente: senha do cliente -> cookie assinado com o slug.
 *
 * Mesmo desenho do api/login.js da equipe, com duas diferenças:
 * - a senha de cada cliente fica como hash PBKDF2 em clientes/_acesso.json
 *   (gerado por portal_senha.py no painel-desafio; nunca senha em texto);
 * - o token carrega o slug, e o middleware só abre /clientes/<slug> para o
 *   cookie daquele slug. Cliente A com sessão válida não abre o portal de B.
 *
 * O segredo do HMAC é PORTAL_SECRET, variável de ambiente da Vercel.
 * DELETE apaga o cookie (sair).
 */
const crypto = require('node:crypto');
const ACESSO = require('../clientes/_acesso.json');

const COOKIE = 'portal_sessao';
const DIAS_DE_SESSAO = 30;

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function comparaSeguro(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) { crypto.timingSafeEqual(ba, ba); return false; }
  return crypto.timingSafeEqual(ba, bb);
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  if (!pedacos.length) return {};
  try { return JSON.parse(Buffer.concat(pedacos).toString('utf8')); } catch { return {}; }
}

function cookieDeSaida() {
  return `${COOKIE}=; Path=/clientes; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = async function handler(req, res) {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieDeSaida());
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  const segredo = (process.env.PORTAL_SECRET || '').trim();
  if (!segredo) {
    return res.status(500).json({ erro: 'Configuração ausente na Vercel: falta PORTAL_SECRET. Marque a variável para Production e Preview e refaça o deploy.' });
  }

  const corpo = await lerCorpo(req).catch(() => ({}));
  const slug = String(corpo.slug || '').replace(/[^a-z0-9-]/g, '');
  const senha = String(corpo.senha || '');
  const reg = ACESSO[slug];

  // sem cadastro ou sem senha: mesma resposta e mesmo tempo que senha errada
  const salt = reg ? reg.salt : 'sem-cadastro-0000000000000000';
  const iter = reg ? reg.iter : 100000;
  const esperado = reg ? reg.hash : '0'.repeat(64);
  const calculado = crypto.pbkdf2Sync(senha, Buffer.from(salt, 'hex'), iter, 32, 'sha256').toString('hex');
  if (!reg || !senha || !comparaSeguro(calculado, esperado)) {
    await new Promise((r) => setTimeout(r, 400));
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }

  const exp = Date.now() + DIAS_DE_SESSAO * 24 * 60 * 60 * 1000;
  const carga = `${slug}.${exp}`;
  const assinatura = base64url(crypto.createHmac('sha256', segredo).update(carga).digest());
  res.setHeader('Set-Cookie',
    `${COOKIE}=${carga}.${assinatura}; Path=/clientes; Max-Age=${DIAS_DE_SESSAO * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`);
  return res.status(200).json({ ok: true, slug });
};
