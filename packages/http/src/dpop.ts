import { importJWK, SignJWT } from 'jose'
import { sha256 } from 'js-sha256'
import { defaultParamsSerializer } from './params-serializer.js'
import { toRequestBodyBytes } from './request-body.js'
import type { DpopSignInput } from './types.js'

/** Creates an ES256 DPoP proof without reading browser globals or application state. */
export async function createDpopProof(input: DpopSignInput): Promise<string> {
  const query = typeof input.params === 'string' ? input.params : defaultParamsSerializer(input.params)
  const bodyHash = sha256(await toRequestBodyBytes(input.data))
  const privateKey = await importJWK(input.client.privateKey, 'ES256')
  return new SignJWT({
    htu: input.url,
    htm: input.method.toUpperCase(),
    acd: input.applicationCode,
    pha: sha256(`${query}\n${bodyHash}`),
    jti: input.jti,
  })
    .setProtectedHeader({
      typ: 'dpop+jwt',
      alg: 'ES256',
      ph_alg: 'SHA-256',
      jwk: input.client.publicKey,
      kid: input.client.clientId,
    })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}
