import NextAuth from 'next-auth';
import { createAuthOptions } from '../../../lib/auth.js';

export function resolveNextAuthHandler() {
  if (typeof NextAuth === 'function') {
    return NextAuth;
  }

  if (NextAuth && typeof NextAuth.default === 'function') {
    return NextAuth.default;
  }

  if (NextAuth?.default && typeof NextAuth.default.default === 'function') {
    return NextAuth.default.default;
  }

  throw new TypeError('Invalid NextAuth export shape.');
}

export default function webAuth(req, res) {
  return resolveNextAuthHandler()(req, res, createAuthOptions());
}
