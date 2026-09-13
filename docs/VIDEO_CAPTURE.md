# QuietPatch Wave 1 video capture

## Job

- **Primary job:** prove the wallet-backed disclosure flow works.
- **Secondary job:** explain the public/private split.
- **Audience question:** does Midnight protect the report while recording a verifiable process?
- **Duration:** 70 seconds.
- **Format:** 16:9, 1080p if available, with the app browser chrome hidden.

## What is verified

- The demo is on Midnight `undeployed`, not Preprod.
- Contract: `2542183b91bd41aa2c8715abee6d4def0e075776abfa414826e6ac7ec75863a6`.
- The final report state is `DISCLOSED`.
- The public report commitment is `d88ae7d71bc14d261941d31d974c935693675deb7ba8a167af4cf0cbe07a6d96`.
- The payout action records an authorised test claim. It does not transfer tNIGHT.
- The report is synthetic. Do not enter or show a real vulnerability, wallet secret, or personal data.

## Capture setup

1. Start the local web app and encrypted-bundle API.
2. Open QuietPatch in Chrome, connect the existing Lace account on `undeployed`, and refresh the chain.
3. Confirm the ledger shows `DISCLOSED`, the commitment, `Hidden` report body, and safe disclosure summary.
4. Do not reset the demo or send another transaction. The completed state is the proof.
5. In OBS, create a `QuietPatch final` scene with a Window Capture source for Chrome. Fit the source to the canvas, use 1920×1080 at 30 fps, and record to MKV with an H.264 encoder. Remux the finished file to MP4 from OBS after recording.
6. Keep the browser at a readable zoom. Do not show wallet extensions, terminal output, or other tabs.

## Shot list and narration

| Time | Screen action | Narration or on-screen line |
|---|---|---|
| 0–6s | Show the QuietPatch header and final ledger. | “QuietPatch records a private security disclosure process on Midnight without putting the exploit on the ledger.” |
| 6–16s | Hold the ledger: `DISCLOSED`, commitment, `Hidden` report body. | “The report content stays encrypted. What becomes public is the commitment and the workflow state.” |
| 16–28s | Switch to Observer. Hold the hidden report and commitment. | “An observer can verify that a report exists, passed the threshold, and reached disclosure. They cannot read the evidence.” |
| 28–40s | Switch to Researcher. Show the existing synthetic report notice and on-chain record. | “The researcher’s browser encrypted a synthetic report before upload, then submitted its commitment through a Lace-signed Midnight transaction.” |
| 40–53s | Switch to Maintainer. If the decrypted synthetic report is available in this browser session, show it briefly; otherwise stay on the public ledger. | “Only the maintainer’s browser can decrypt the synthetic evidence for review. The Compact contract controls acceptance, one claim, and disclosure.” |
| 53–64s | Return to the ledger and hold `DISCLOSED`, the safe disclosure text, and payout record. | “This completed run reached safe disclosure on Midnight Undeployed. The payout is a test claim record, not a fund transfer.” |
| 64–70s | Show the footer or title area. | “QuietPatch: fix the bug before you reveal the bug.” |

## Delivery check

- Watch the export once at normal speed.
- Verify `undeployed` is named in the title, description, or spoken narration.
- Verify there is no claim of a real payout, escrow, Preprod deployment, or real vulnerability.
- Upload as an unlisted video or another public link that opens without a login.
- Put the final URL in `docs/WAVE1_SUBMISSION.md` and the Akindo entry.
