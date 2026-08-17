/** Encerra a sessão do painel, apagando o cookie. */
module.exports = function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'painel_sessao=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; '));
  res.writeHead(302, { Location: '/' });
  res.end();
};
