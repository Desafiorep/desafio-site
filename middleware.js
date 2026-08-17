/**
 * Protege /painel na borda da Vercel.
 *
 * Roda ANTES de qualquer arquivo estático ser servido, então o HTML do painel
 * nunca chega a quem não tem sessão válida. Sem cookie assinado, o visitante é
 * mandado para /login.
 *
 * Sem dependências de pacote de propósito: o site é estático e não tem etapa de
 * build, então nada aqui pode depender de `npm install` ter rodado.
 */
export const config = { matcher: ['/painel', '/painel/:path*'] };

const COOKIE = 'painel_sessao';

/** Deixa a requisição seguir para o arquivo estático (o mesmo que @vercel/edge faz). */
function seguir() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

function base64urlParaBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Confere assinatura e validade do token. Devolve true só se ambos batem. */
async function tokenValido(token, segredo) {
  if (!token || !segredo) return false;
  const [expStr, assinatura] = token.split('.');
  if (!expStr || !assinatura) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  try {
    return await crypto.subtle.verify(
      'HMAC',
      chave,
      base64urlParaBytes(assinatura),
      new TextEncoder().encode(expStr)
    );
  } catch {
    return false;
  }
}

export default async function middleware(request) {
  const cookies = Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((p) => p.trim().split('='))
      .filter((p) => p[0])
      .map(([k, ...v]) => [k, v.join('=')])
  );

  if (await tokenValido(cookies[COOKIE], process.env.PAINEL_SECRET)) {
    return seguir();
  }

  const url = new URL(request.url);
  const destino = new URL('/login', url.origin);
  destino.searchParams.set('de', url.pathname + url.search);
  return Response.redirect(destino, 302);
}
