import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { buildSignInRedirectUrl, isProtectedWebPath } from './lib/routeProtection.js';

const FALLBACK_SECRET = 'test-station-web-development-secret';

export async function middleware(req) {
  if (!isProtectedWebPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || FALLBACK_SECRET,
  });

  if (token) {
    return NextResponse.next();
  }

  const redirectUrl = req.nextUrl.clone();
  const signInPath = buildSignInRedirectUrl(req.url);
  redirectUrl.pathname = signInPath.split('?')[0];
  redirectUrl.search = signInPath.includes('?') ? signInPath.slice(signInPath.indexOf('?')) : '';
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
