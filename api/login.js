/**
 * Recebe a senha da equipe e devolve um cookie de sessão assinado.
 *
 * A senha e o segredo ficam em variáveis de ambiente da Vercel — nunca no
 * repositório. A comparação é feita em tempo constante para não vazar pistas
 * sobre a senha pelo tempo de resposta.
 */
import crypto from 'node:crypto';

const COOKIE = 'painel_sessao';
const DIAS_DE_SESSAO = 30;

function comparaSeguro(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // ainda assim compara, para o tempo não denunciar o tamanho da senha
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  const senhaEsperada = process.env.PAINEL_SENHA;
  const segredo = process.env.PAINEL_SECRET;
  if (!senhaEsperada || !segredo) {
    return res.status(500).json({
      erro: 'Painel sem configuração de acesso. Defina PAINEL_SENHA e PAINEL_SECRET na Vercel.',
    });
  }

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch { corpo = {}; }
  }
  const senha = (corpo && corpo.senha) || '';

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
}
