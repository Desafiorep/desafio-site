/**
 * Recebe a senha da equipe e devolve um cookie de sessão assinado.
 *
 * CommonJS de propósito: o site não tem package.json, então arquivos .js são
 * tratados como CommonJS pelo runtime Node da Vercel.
 *
 * A senha e o segredo ficam em variáveis de ambiente da Vercel — nunca no
 * repositório. A comparação é feita em tempo constante para não vazar pistas
 * sobre a senha pelo tempo de resposta.
 */
const crypto = require('node:crypto');

const COOKIE = 'painel_sessao';
const DIAS_DE_SESSAO = 30;

function comparaSeguro(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    // ainda assim compara, para o tempo não denunciar o tamanho da senha
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

/** Lê o corpo da requisição mesmo quando o runtime não o entrega já pronto. */
async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  if (!pedacos.length) return {};
  const bruto = Buffer.concat(pedacos).toString('utf8');
  try {
    return JSON.parse(bruto);
  } catch {
    // aceita também envio de formulário (senha=xxxx)
    return Object.fromEntries(new URLSearchParams(bruto));
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  // As variáveis podem chegar com espaço ou quebra de linha quando coladas no
  // painel da Vercel — daí o trim dos dois lados.
  const senhaEsperada = (process.env.PAINEL_SENHA || '').trim();
  const segredo = (process.env.PAINEL_SECRET || '').trim();

  if (!senhaEsperada || !segredo) {
    const faltando = [
      !senhaEsperada && 'PAINEL_SENHA',
      !segredo && 'PAINEL_SECRET',
    ].filter(Boolean).join(' e ');
    return res.status(500).json({
      erro: `Configuração ausente na Vercel: falta ${faltando} neste ambiente. ` +
            `Marque a variável também para Preview, não só Production, e refaça o deploy.`,
    });
  }

  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch {
    corpo = {};
  }
  const senha = String((corpo && corpo.senha) || '').trim();

  if (!senha) {
    return res.status(400).json({ erro: 'Não recebi a senha. Digite e tente de novo.' });
  }

  if (!comparaSeguro(senha, senhaEsperada)) {
    // atraso pequeno para desestimular tentativa em massa
    await new Promise((r) => setTimeout(r, 400));
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }

  const exp = String(Date.now() + DIAS_DE_SESSAO * 24 * 60 * 60 * 1000);
  const assinatura = crypto
    .createHmac('sha256', segredo)
    .update(exp)
    .digest('base64url');

  res.setHeader('Set-Cookie', [
    `${COOKIE}=${exp}.${assinatura}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${DIAS_DE_SESSAO * 24 * 60 * 60}`,
  ].join('; '));

  return res.status(200).json({ ok: true });
};
