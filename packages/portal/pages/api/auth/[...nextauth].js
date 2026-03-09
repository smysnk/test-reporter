import NextAuth from 'next-auth';
import { createAuthOptions } from '../../../lib/auth.js';

export default function portalAuth(req, res) {
  return NextAuth(req, res, createAuthOptions());
}
