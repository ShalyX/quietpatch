# QuietPatch Wave 1 submission package

Use this file to prepare the manual Akindo entry. The event rules require the entrant or a registered team member to submit personally; do not use an automated form tool.

## Project

**Name:** QuietPatch

**One-line description:** Private vulnerability reporting with encrypted evidence and a public Midnight workflow record.

## Paste-ready description

QuietPatch lets a security researcher encrypt a synthetic vulnerability report in the browser while Midnight records the bounty, report commitment, review status, payout claim, and safe disclosure state. Observers can verify the process without seeing the exploit before a fix exists.

The browser encrypts the report before the bundle leaves the page. The bundle service stores ciphertext only. A Compact contract records the public process: bounty configuration, report commitment, status, acceptance or rejection, payout claim, and a later safe disclosure digest.

The contract checks report binding, severity threshold, deadline, one-report state, and separate maintainer and researcher witnesses. It does not claim that a vulnerability is real; the maintainer still reviews the encrypted evidence.

## What changed in Wave 1

- Built a Compact contract for bounty creation, report submission, acceptance, rejection, payout claims, and disclosure.
- Built the maintainer, researcher, and observer browser flows.
- Added browser-side AES-GCM encryption, typed report commitments, and ciphertext-only bundle storage.
- Added Lace v4 connection, DUST checks, transaction stages, and recovery messages.
- Ran a wallet-backed Midnight flow through deployment, bounty initialization, report submission, acceptance, claim, and disclosure.
- Added automated tests, a repeatable synthetic fixture, a runbook, architecture notes, and a threat model.

## Verified demo evidence

- **Network:** Midnight Undeployed project test environment, not Preprod.
- **Contract:** `2542183b91bd41aa2c8715abee6d4def0e075776abfa414826e6ac7ec75863a6`
- **Final state:** the bounty is open and the submitted report is `DISCLOSED`.
- **Report commitment:** `d88ae7d71bc14d261941d31d974c935693675deb7ba8a167af4cf0cbe07a6d96`
- **Disclosure digest:** `f38ee11c720156f06892a207458c4731bebeddf42eba3046f755c9e13ed53f9e`
- **Recorded transactions:** report submission `001b41ea7e…0ba1932d`; bounty initialization `002196840d…0a8c025b`; payout claim `00659942e4…9647c5b5`.

## Submission links

- **Repository:** https://github.com/ShalyX/quietpatch
- **Public preview:** https://dist-b1x373fmf-shalyxs-projects.vercel.app
- **Deck:** `deliverables/QuietPatch-Wave1-Submission-Deck-v4.pptx`
- **Demo video:** record or upload the 70-second final-state walkthrough in `docs/VIDEO_CAPTURE.md`, then add its public URL.

The preview is a public static build of the browser client. The verified Midnight Undeployed transaction flow uses the local/VPS services from the demo environment.

## Limits to state clearly

- The report is synthetic; no real vulnerability, user data, or private key was used.
- The test environment is Midnight Undeployed, not public Preprod.
- `claimPayout` records a claim as paid. It does not transfer tNIGHT or manage an escrow balance.
- The encrypted-bundle API uses in-memory storage for this demo. A production version needs durable encrypted storage and wallet-authenticated access.

## Personal submission steps

1. Confirm the published repository, GitHub topic `midnightntwrk`, and Apache-2.0 license.
2. Upload the deck and demo video somewhere that opens without a login.
3. Open Akindo as the registered entrant, paste the project description, add the public URLs, and check every fact against this file.
4. Submit the entry yourself before the Wave 1 deadline.
