# QuietPatch production plan

## 1. Goal

Ship a working Wave 1 slice that lets a maintainer create a bounty, lets a researcher submit an encrypted report, and lets the maintainer accept or reject the report. The public view must show the process without exposing the report. The current tree has the browser flow, API, tests, compiling Compact contract, wallet connection, and optional Midnight.js contract calls. Deployment to a running local network or Preprod is the next delivery slice.

The team should optimise for one clean path through the product. Every extra feature competes with the contract, tests, and demo.

## 2. Product decisions

### Target user

Wave 1 targets maintainers of open-source libraries and Midnight dApps. The product story can later extend to fintech teams and security programs.

### Main promise

> A security report can be verified, reviewed, and paid without publishing the exploit before the fix.

### Wave 1 boundary

The product will use synthetic reports, local or test-network accounts, and a test payout balance. The interface must say this clearly. A pretend live bug report would weaken trust.

### Privacy boundary

The report is encrypted in the browser before the API receives it. The API stores ciphertext and metadata only. The contract stores a commitment and workflow state, not the report or attachment.

### Trust boundary

The proof binds a report to a bounty, severity rule, nonce, and report digest. It does not prove that the bug exists. A maintainer reviews the report before acceptance.

## 3. Roles

| Role | Responsibilities |
|---|---|
| Researcher | Creates the report, encrypts it, generates the proof, checks the payout claim. |
| Maintainer | Creates bounties, receives the encrypted report, reviews evidence, accepts or rejects. |
| Observer | Checks the public bounty and report status without seeing the report. |
| Builder | Maintains the contract, app, tests, deployment, and submission materials. |

For a small team, one person may hold several roles. The demo should use separate browser profiles or clearly labelled accounts.

## 4. Delivery phases

### Phase 0: Scope lock, half a day

Decide the exact contract fields, state transitions, report format, and demo accounts. Write down what the proof claims and what it does not claim.

Exit condition: the team can explain the full flow in one minute and has agreed to the Wave 1 limits.

### Phase 1: Toolchain and repository, day 1

- Pin the Node.js and package manager versions.
- Start the Midnight local network, indexer, and proof server when network integration begins.
- Copy the smallest useful structure from the official Midnight sample app.
- Compile a trivial Compact contract before adding product logic.
- Add TypeScript checks, formatting, test commands, and an Apache-2.0 license.

Exit condition: a new contributor can install dependencies and compile the contract from a clean checkout.

### Phase 2: Contract, days 2–4

Implement the smallest state machine:

```text
Draft bounty
  -> Open
Open + valid report
  -> Submitted
Submitted + maintainer acceptance
  -> Accepted
Accepted + researcher claim
  -> Paid
Submitted + maintainer rejection
  -> Rejected
Accepted or Rejected + safe summary
  -> Disclosed
```

Contract work includes role checks, deadline checks, commitment validation, report uniqueness, and payout state. Keep payout transfer behind an adapter so local tests don't depend on a funded wallet.

Exit condition: the contract compiles, the happy path runs locally, and the negative tests fail for the right reason.

### Phase 3: Report package and encryption, days 4–5

Define a versioned report package. It should contain:

- report title;
- affected component and version;
- severity score and reason;
- reproduction steps;
- impact statement;
- suggested fix;
- attachment digest;
- report nonce;
- package version.

Canonicalise the package before hashing. Encrypt the canonical bytes with AES-GCM in the browser. Encrypt the AES key for the maintainer's public key. Never log plaintext report fields.

Exit condition: the maintainer can decrypt a valid bundle, a changed bundle fails its digest check, and the API never receives plaintext.

### Phase 4: API and storage, days 5–6

Build a small TypeScript service with these duties:

- issue a bounty metadata record;
- accept encrypted report bundles;
- return an opaque internal report ID;
- serve a bundle only to the authorised maintainer;
- store disclosure summaries after acceptance;
- apply size limits, content-type limits, and rate limits.

The current demo uses in-memory storage. Replace it with SQLite or an encrypted object store before preprod, while keeping the endpoint shape unchanged.

Exit condition: a researcher can upload ciphertext and a maintainer can retrieve it without exposing the bundle to an unauthorised account.

### Phase 5: Web app, days 6–8

Build four screens:

1. Maintainer dashboard: create bounty and view report status.
2. Researcher report form: enter report data, encrypt, and submit.
3. Maintainer review: decrypt locally, inspect the report, accept or reject.
4. Public record: show bounty, commitment, status, and payout state.

Make privacy visible. Show a public observer view beside the maintainer view during the demo. Do not display fake proof animations; show real status changes and real error states.

Exit condition: a new user can complete the happy path without reading the source code.

### Phase 6: Integration and tests, days 8–10

Run the complete path against the local network. Add contract-testkit cases for invalid proofs, changed report data, duplicate submissions, late reports, wrong maintainer, double payout, and replayed claims. The current TypeScript suite covers the local adapter and API path.

Check that the public view never includes report text, attachment names, severity score, email address, or encryption key.

Exit condition: the test suite passes from a clean checkout and the team can repeat the demo twice without resetting hidden state by hand.

### Phase 7: Preprod and submission package, days 10–12

- Deploy the compiled contract to the supported Midnight preprod environment if the wallet and proof flow remain stable.
- Keep a local demo path available if preprod sync blocks the submission.
- Record contract address, network, ledger version, and commit hash.
- Write the setup section from a fresh machine.
- Record the demo in one take after two dry runs.
- Build slides around the problem, privacy boundary, contract flow, test evidence, and next release.

Exit condition: a judge can clone the repo, find the contract, run the test command, and understand the demo without a private message from the team.

### Buffer, final day

Use the final day for fixes only. Do not add a new contract feature. Re-run the submission checklist, confirm the repository label, and upload the exact commit that the video demonstrates.

## 5. Work ownership

The contract owner should not also be the only person who can explain the demo. Pair on the state machine, review every public/private field, and have someone who did not write the contract follow the setup instructions.

The person recording the video owns the final demo data. Keep a reset script for local accounts and seed data.

## 6. Risks and decisions

| Risk | Response |
|---|---|
| Compact proof work takes longer than expected | Compile the smallest proof first; keep the report package and public workflow useful even if the proof scope stays narrow. |
| Preprod wallet sync consumes the schedule | Treat local execution as the release gate; attempt preprod after local tests pass. |
| Encrypted storage becomes a backend project | Use a small local service and keep the storage interface narrow. |
| Judges mistake the prototype for a real security service | Label synthetic data, test balance, and maintainer review limits in the UI and README. |
| A public commitment still leaks timing or size | Avoid sensitive filenames and keep bundle metadata minimal. |

## 7. Definition of done

QuietPatch is ready for Wave 1 when all of these are true:

- the Compact contract compiles from a clean checkout;
- the researcher flow creates the same typed commitment that the Compact circuit recomputes, and the network adapter creates a valid proof;
- the maintainer can review encrypted evidence;
- the public observer cannot read the report;
- acceptance and rejection update the contract state;
- the payout claim cannot execute twice;
- the test suite covers the failure cases in `TEST_PLAN.md`;
- the README contains setup and limitations;
- slides and video match the submitted commit.
