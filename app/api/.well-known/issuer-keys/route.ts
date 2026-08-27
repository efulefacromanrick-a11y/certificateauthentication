import { getIssuerPublicKey } from '@/app/lib/certificates';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ keys: [{ kid: 'issuer-key-v1', alg: 'EdDSA', kty: 'OKP', crv: 'Ed25519', x: getIssuerPublicKey() }] }, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
