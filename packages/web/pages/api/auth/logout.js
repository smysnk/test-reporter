import { buildSignedOutRedirectUrl } from '../../../lib/authRoutes.js';

const EXPIRED_COOKIE_TIMESTAMP = 'Thu, 01 Jan 1970 00:00:00 GMT';
const LOGOUT_COOKIE_NAMES = [
  { name: 'next-auth.session-token', secure: false },
  { name: '__Secure-next-auth.session-token', secure: true },
  { name: '__Host-next-auth.csrf-token', secure: true },
  { name: 'next-auth.csrf-token', secure: false },
  { name: '__Secure-next-auth.callback-url', secure: true },
  { name: 'next-auth.callback-url', secure: false },
  { name: '__Secure-next-auth.state', secure: true },
  { name: 'next-auth.state', secure: false },
  { name: '__Secure-next-auth.pkce.code_verifier', secure: true },
  { name: 'next-auth.pkce.code_verifier', secure: false },
];

export default function logoutHandler(req, res) {
  const callbackUrl = typeof req?.query?.callbackUrl === 'string' && req.query.callbackUrl.trim()
    ? req.query.callbackUrl.trim()
    : buildSignedOutRedirectUrl();

  res.statusCode = 302;
  res.setHeader('Location', callbackUrl);
  res.setHeader('Set-Cookie', LOGOUT_COOKIE_NAMES.map(buildExpiredCookie));
  res.end();
}

function buildExpiredCookie({ name, secure }) {
  return `${name}=; Path=/; Expires=${EXPIRED_COOKIE_TIMESTAMP}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
