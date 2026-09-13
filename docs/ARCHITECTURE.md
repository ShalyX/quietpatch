# QuietPatch architecture

## 1. System view

```text
Researcher browser
  |  encrypt report, create commitment, generate proof
  v
Web app  ------------------------------>  Midnight contract
  |                                           |
  | encrypted bundle                          | public workflow state
  v                                           v
Encrypted bundle API  <----------------  Indexer / read API
  ^
  | authorised download
  |
Maintainer browser
  decrypt report locally, review, accept or reject
```

The browser handles plaintext report data. The API handles ciphertext. The Compact contract handles commitments, private-input checks, role checks, status, deadline, and payout claims. A claim changes contract state to `Paid`; this Wave 1 contract does not transfer tNIGHT or hold escrow. The browser uses the local adapter only when no wallet is connected. If Lace is connected without an attached contract, all workflow mutations are locked. Once a contract is attached, a failed network transaction never falls back to a local success state.

The contract has separate maintainer and researcher witnesses. The selected UI role is only navigation; it is not an authority grant. A single browser can walk the hackathon flow with one Lace account, but the two circuit witnesses still prevent a maintainer key from satisfying the researcher claim check. Separate operators should keep their private state in separate wallet/browser sessions.

## 2. Components

### Web app

React and TypeScript provide the maintainer, researcher, and observer views. The client calls the generated Midnight bindings and the report API. It must keep private report data in memory where possible and clear it when the review session ends.

### Compact contract

The contract owns the process state. It should not store report text, encrypted attachments, private keys, or a public storage URL that reveals report metadata.

The contract should expose generated bindings to the web app through a small client wrapper. The wrapper translates contract errors into messages that a user can act on.

### Encrypted bundle API

The API stores encrypted bytes and a small record containing an opaque report ID, bounty ID, creation time, bundle size, and maintainer access policy. The API must never receive the report key.

The current implementation keeps bundles in memory. A production deployment should use a durable encrypted object store without changing the browser or contract interface.

### Proof service

The compiled Compact contract defines the proof checks. The browser contract client uses the generated bindings and Midnight.js providers to generate, balance, and submit proofs. It must surface proof failures and must not mark a local report as submitted when the configured network transaction fails.

## 3. Public and private data

| Data | Location | Public? |
|---|---|---:|
| Bounty ID, title, threshold, deadline, reward | Contract | Yes |
| Maintainer wallet address | Contract | Yes |
| Report commitment | Contract | Yes |
| Report status and payout state | Contract | Yes |
| Report text and reproduction steps | Encrypted bundle | No |
| Attachment bytes | Encrypted bundle | No |
| Raw severity score | Researcher witness and encrypted report | No |
| Report nonce | Researcher witness and encrypted report | No |
| AES key | Browser session storage in Wave 1; key wrapping in the production plan | No |
| Safe disclosure summary | API and contract digest | Yes after disclosure |

The table is a design constraint. If a new field does not have a clear privacy reason, keep it off the contract.

## 4. Report commitment

The researcher creates a canonical report package and computes a digest. The commitment binds the following values:

```text
commitment = persistentHash([pad32("quietpatch:report:"), bountyId32, reportDigest32, reportNonce32, severityAsFieldBytes32])
```

The exact hash function and encoding must follow the Midnight-supported primitives. Do not implement a custom hash format in the web app and a second format in Compact.

The encrypted bundle includes the canonical report package. After decryption, the maintainer can recalculate `reportDigest` and compare it with the committed value. The browser uses SHA-256 for the report digest and Midnight's `persistentHash` over the same typed vector used by the Compact contract for the commitment. The helper lives in `apps/web/src/crypto.ts` and uses the Compact runtime types, so the network call receives the same 32-byte value that the circuit recomputes.

## 5. Proof claims

The Wave 1 proof should make five claims:

1. The private severity meets the public bounty threshold.
2. The private report digest and nonce produce the submitted commitment.
3. The report binds to the selected bounty.
4. The accepted report cannot be claimed twice because the state must be `Accepted` before it changes to `Paid`.
5. Maintainer and researcher authorization use different private witnesses.

The proof does not claim that the report is a real vulnerability. The maintainer's review supplies that decision.

## 6. Contract state

### Bounty

```text
bountyId
maintainer
minimumSeverity
rewardAmount
submissionDeadline
status: Open | Closed
```

### Report

```text
reportCommitment
severityPass
reportResearcher
status: Submitted | Accepted | Rejected | Paid | Disclosed
```

The contract stores hashes or commitments for text fields. It does not store a plaintext title if the title itself could reveal the issue.

## 7. Contract actions

The deployed Compact interface is:

```text
createBounty(newBountyId, newMinimumSeverity, newRewardAmount, newSubmissionDeadline)
closeBounty()
submitReport(reportCommitmentInput)
acceptReport()
rejectReport()
claimPayout()
publishDisclosure(newDisclosureDigest)
```

The final Compact signatures must follow the toolchain version used by the repository. Keep the public interface small and document every caller check in the contract source.

## 8. Failure handling

- A failed proof must leave no report in `Submitted` state.
- A changed encrypted bundle must fail digest verification.
- A report past the deadline must fail before proof submission.
- Only the maintainer witness bound at bounty creation may accept or reject.
- Only the researcher witness bound at report submission may claim an accepted report.
- A paid report must reject a second claim.
- A rejected report must not release a payout.
- A disclosure must require an accepted or paid report.

## 9. Deployment modes

### Local mode

Local mode is the primary development and test path. The browser demo uses a local ledger adapter and in-memory API service unless a wallet and contract address are configured. Contract compilation runs through Compact 0.31.1.

### Preprod mode

Preprod mode uses the supported Midnight Preprod network. The app reads the network and optional contract address from environment configuration, persists a successfully deployed address in the current browser profile, and submits configured circuit actions through Midnight.js. The browser client requests proving from the connected wallet, so a local Midnight Docker stack is not part of the Preprod path. The repository must record the exact ledger and package versions used for the deployment.

### Production mode, later

Production needs managed encrypted storage, key rotation, abuse controls, audit logs that exclude report content, wallet recovery, payout funding, and a security review. Those items sit outside the Wave 1 build.
