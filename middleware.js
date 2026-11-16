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
export const config = { matcher: ['/painel', '/painel/:path*', '/clientes/:path*'] };

const COOKIE = 'painel_sessao';
const COOKIE_PORTAL = 'portal_sessao';

/** Deixa a requisição seguir para o arquivo estático (o mesmo que @vercel/edge faz). */
function seguir() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

function base64urlParaBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** HMAC-SHA256 do texto `carga` confere com `assinatura` (base64url)? */
async function assinaturaConfere(carga, assinatura, segredo) {
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
      new TextEncoder().encode(carga)
    );
  } catch {
    return false;
  }
}

/** Token da equipe: `exp.assinatura`. Devolve true só se validade e assinatura batem. */
async function tokenValido(token, segredo) {
  if (!token || !segredo) return false;
  const [expStr, assinatura] = token.split('.');
  if (!expStr || !assinatura) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return assinaturaConfere(expStr, assinatura, segredo);
}

/**
 * Token do portal: `slug.exp.assinatura`, assinado sobre `slug.exp`.
 * Devolve o slug do cookie quando ele é válido, senão null. Quem compara com
 * o slug do caminho é o chamador — é essa comparação que separa um cliente
 * do outro.
 */
async function slugDoToken(token, segredo) {
  if (!token || !segredo) return null;
  const [slug, expStr, assinatura] = token.split('.');
  if (!slug || !expStr || !assinatura) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return (await assinaturaConfere(`${slug}.${expStr}`, assinatura, segredo)) ? slug : null;
}

export default async function middleware(request) {
  const cookies = Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((p) => p.trim().split('='))
      .filter((p) => p[0])
      .map(([k, ...v]) => [k, v.join('=')])
  );
  const url = new URL(request.url);

  // ---- portal do cliente: /clientes/<slug>/... -------------------------------
  if (url.pathname.startsWith('/clientes/')) {
    const seg = url.pathname.split('/')[2] || '';
    // a tela de entrar é pública; arquivos de controle (_acesso.json) nunca saem
    if (seg === 'entrar' || seg === 'entrar.html') return seguir();
    if (seg.startsWith('_') || !seg) return new Response('Não encontrado', { status: 404 });
    const slugCookie = await slugDoToken(cookies[COOKIE_PORTAL], process.env.PORTAL_SECRET);
    if (slugCookie && slugCookie === seg) return seguir();
    const destino = new URL('/clientes/entrar', url.origin);
    destino.searchParams.set('c', seg);
    destino.searchParams.set('de', url.pathname);
    return Response.redirect(destino, 302);
  }

  // ---- painel da equipe --------------------------------------------------------
  if (await tokenValido(cookies[COOKIE], process.env.PAINEL_SECRET)) {
    return seguir();
  }
  const destino = new URL('/login', url.origin);
  destino.searchParams.set('de', url.pathname + url.search);
  return Response.redirect(destino, 302);
}
