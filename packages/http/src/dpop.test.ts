import { exportJWK, generateKeyPair } from 'jose'
import { describe, expect, it } from 'vitest'
import { createDpopProof } from './dpop.js'

function decodePart(token: string, index: number): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[index], 'base64url').toString()) as Record<string, unknown>
}

describe('createDpopProof', () => {
  it('creates an ES256 proof with canonical parameters and required claims', async () => {
    const keyPair = await generateKeyPair('ES256', { extractable: true })
    const proof = await createDpopProof({
      url: 'https://api.example.test/items', method: 'post', params: { b: 2, a: 1 }, data: { ok: true }, applicationCode: 'member', jti: 'test-jti',
      client: { clientId: 'client-1', publicKey: await exportJWK(keyPair.publicKey), privateKey: await exportJWK(keyPair.privateKey), isAuthenticated: true },
    })
    expect(decodePart(proof, 0)).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256', ph_alg: 'SHA-256', kid: 'client-1' })
    expect(decodePart(proof, 1)).toMatchObject({ htu: 'https://api.example.test/items', htm: 'POST', acd: 'member', jti: 'test-jti' })
  })
})
