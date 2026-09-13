# QuietPatch API

The API stores encrypted report bundles. It does not generate proofs, hold wallet keys, or decide whether a report is valid.

The current local service keeps bundles in memory. A hosted version should use durable encrypted object storage behind the same interface.

## Authentication

The production browser signs each request with the active wallet or uses a short-lived session issued after wallet verification. The API must not accept a maintainer or researcher role from a form field alone.

The current demo uses `X-Demo-Role: researcher` for uploads and `X-Demo-Role: maintainer` for reads. This header is only a local demo boundary and must be replaced before preprod. A signed-session flow must check the wallet address, message, expiry, and nonce.

## Endpoints

### `POST /v1/bounties`

Creates the off-chain metadata record for a bounty before or alongside `createBounty`.

Request:

```json
{
  "bountyId": "contract-id",
  "title": "string",
  "description": "string",
  "maintainerAddress": "wallet-address"
}
```

The API should reject a record whose maintainer address does not match the signed request.

### `POST /v1/reports`

Accepts an encrypted report bundle.

Request headers:

```text
Content-Type: application/octet-stream
X-Bounty-Id: contract-id
X-Report-Commitment: commitment
X-Demo-Role: researcher
```

The service returns an opaque internal report ID. It must not return a public storage URL.

### `GET /v1/reports/:reportId`

Returns ciphertext only to the authorised maintainer. The service checks the maintainer session, bounty ID, report status, and access policy. The current demo checks `X-Demo-Role: maintainer` only.

### `POST /v1/reports/:reportId/disclosure`

Stores a safe public summary after the contract accepts a disclosure digest.

Request:

```json
{
  "disclosureDigest": "digest",
  "summary": "sanitised text"
}
```

The API must reject plaintext exploit code, secrets, private keys, and raw report attachments in this endpoint. Wave 1 can use a manual confirmation screen; production needs content review and storage controls.

### `DELETE /v1/reports/:reportId`

Do not include this in Wave 1. Report deletion creates retention and audit questions that the first release does not need to solve.

## Storage rules

- Store ciphertext, not plaintext.
- Limit report bundle size.
- Remove original filenames from stored metadata.
- Do not log request bodies.
- Do not include report IDs in public indexes.
- Use short-lived download URLs only after authorisation, if the storage layer needs them.
- Keep an audit record of access without storing report contents.
