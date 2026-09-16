# QuietPatch submission copy

Keep the facts aligned with the submitted commit. The video URL remains the only missing external link.

## Project name

QuietPatch

## One-line description

Private vulnerability reporting with encrypted evidence and a public Midnight workflow record.

## Short description

QuietPatch lets a security researcher encrypt a synthetic vulnerability report in the browser while Midnight records the bounty, report commitment, review status, payout claim, and safe disclosure state. Observers can verify the process without seeing the exploit before a fix exists.

## Full description

Security disclosure has a difficult privacy problem: publishing a report too early can put users at risk, while hiding the whole process makes review and payout hard to verify.

QuietPatch separates those concerns. The browser encrypts a report before the bundle leaves the page. The encrypted-bundle service stores ciphertext only. A Compact contract records the public process: bounty configuration, report commitment, status, acceptance or rejection, payout claim, and a later safe disclosure digest.

The contract checks report binding, severity threshold, deadline, one-report state, and separate maintainer and researcher witnesses. It does not claim that a vulnerability is real; the maintainer still reviews the encrypted evidence.

The submitted demo uses synthetic reports and a test payout record. With Lace connected to the deployed and initialized contract, workflow changes require real Midnight transactions and the app does not silently fall back to local state.

## What was built in this Wave

- Compact contract for bounty creation, report submission, acceptance, rejection, payout claims, and disclosure.
- React browser workflow for maintainer, researcher, and observer views.
- Browser-side AES-GCM encryption and typed report commitments.
- Encrypted-bundle API that handles ciphertext rather than report plaintext.
- Lace v4 DApp Connector integration, tDUST checks, transaction stages, and recovery messages.
- Contract, web, and API tests plus a repeatable demo fixture and runbook.

## Privacy split

| Public on Midnight | Private outside the ledger |
|---|---|
| Bounty settings, commitment, status, and payout/disclosure state | Report text, reproduction steps, severity input, nonce, encryption key, and ciphertext |

## Links and evidence

- Repository: https://github.com/ShalyX/quietpatch
- Public preview: https://dist-gamma-orcin-51.vercel.app
- Demo video: `[video URL]`
- Network: Midnight Undeployed, using the project test environment (not Preprod)
- Contract address: `2542183b91bd41aa2c8715abee6d4def0e075776abfa414826e6ac7ec75863a6`
- Verified final report state: `DISCLOSED`
- Submitted commit: `2ca85ce` (`docs: point submission to public preview`)

The public preview is a static build of the browser client. The verified Midnight Undeployed transaction flow remains tied to the local/VPS services used for the demo; do not describe the preview as a fully hosted live network deployment.

## Limits

- The demo uses made-up reports and test values.
- The current API keeps encrypted bundles in memory; a production release needs durable encrypted storage and wallet-authenticated access.
- The current payout path records a claim and does not transfer real funds.
- QuietPatch does not decide whether a reported vulnerability is genuine.
