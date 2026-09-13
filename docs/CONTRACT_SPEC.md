# QuietPatch contract specification

This document describes the Compact contract in `contract/src/quietpatch.compact` and the next production work around it.

## State machine

```text
Open bounty
  -> Submitted report
      -> Accepted report -> Paid report -> Disclosed report
      -> Rejected report
```

The contract must reject every transition that does not appear in this diagram.

## Public inputs

- bounty ID;
- maintainer address;
- submission deadline as a `Uint<64>` Midnight block-time value;
- minimum severity;
- reward amount or payout claim amount;
- submission deadline;
- report commitment;
- report status;
- disclosure digest.

## Private inputs

- raw severity score;
- report nonce;
- canonical report digest;
- researcher binding secret, if the selected Midnight identity pattern supports it.

The current Compact source uses five witnesses: `maintainerSecretKey`, `researcherSecretKey`, `privateReportDigest`, `privateReportNonce`, and `privateSeverity`.

The maintainer and researcher keys are separate private witnesses. `createBounty`, `acceptReport`, and `rejectReport` use the maintainer witness. `submitReport` and `claimPayout` use the researcher witness. Selecting a role tab does not grant authority; the circuit checks the corresponding derived key.

Do not store the raw report or attachment in contract state.

## Required checks

### `createBounty`

- only runs before a bounty exists;
- caller becomes the maintainer through a context-bound key;
- reward and threshold are positive;
- deadline is in the future according to `blockTimeLt`;
- bounty ID cannot be reused.

### `submitReport`

- bounty exists and remains open;
- current time is before the deadline through `blockTimeLt`;
- private severity meets the public threshold;
- private digest, nonce, severity, and bounty ID reproduce the commitment;
- only one report can be submitted in the Wave 1 contract.

### `acceptReport`

- caller proves the maintainer witness bound when the bounty was created;
- report status is `Submitted`;
- report belongs to the caller's bounty;
- status changes once.

### `rejectReport`

- caller proves the maintainer witness bound when the bounty was created;
- report status is `Submitted`;
- status changes once.

### `claimPayout`

- report status is `Accepted`;
- caller proves the researcher witness bound when the report was submitted;
- the claim has not been used;
- status changes to `Paid`.

The current contract records the claim but does not transfer tokens. Production must add a payout adapter with a retry path before marking a real payout complete.

### `publishDisclosure`

- report status is `Accepted` or `Paid`;
- caller matches the researcher or maintainer disclosure policy;
- the disclosure digest is non-empty;
- the status changes to `Disclosed`.

## Wave 1 simplification

Use one maintainer address and one report per bounty. Defer report collections, arbitration, multi-maintainer approval, reputation scores, automatic severity scoring, and multi-token payouts.

## Contract errors

Use stable error codes so the web client can show useful messages:

```text
BOUNTY_NOT_FOUND
BOUNTY_CLOSED
DEADLINE_PASSED
INVALID_PROOF
DUPLICATE_REPORT
NOT_MAINTAINER
NOT_RESEARCHER
INVALID_STATUS
CLAIM_ALREADY_USED
INVALID_DISCLOSURE
```

The exact Compact error mechanism may differ. Keep the mapping in one client module.
