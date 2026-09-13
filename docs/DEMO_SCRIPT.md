# QuietPatch demo script

Target length: 90 seconds. Use synthetic data and show the local or preprod network label on screen.

## Scene 1: The leak, 10 seconds

Say:

> A security report can put users at risk if the exploit becomes public before the fix. QuietPatch keeps the evidence encrypted while the chain records the process.

Show the maintainer creating a bounty with a high-severity threshold and a test reward.

## Scene 2: Private submission, 25 seconds

Choose the recording mode before this scene. With no wallet connected, the page is explicitly a local demo. With Lace connected and an initialized contract attached, submit the synthetic report through Midnight and approve the Lace transaction. The app locks the action if a wallet is connected without a contract; it never treats that state as a local network submission.

Point out that the browser encrypts the report before upload. Show the local status result and commitment, not the report contents.

## Scene 3: Public observer, 15 seconds

Open the observer view. Show the bounty, report commitment, `Submitted` status, and timestamp. Try to find the report text. It must not appear in the page, URL, or public response.

Say:

> An observer can verify that a report exists and see its state. The exploit is not on the public ledger.

## Scene 4: Maintainer review, 20 seconds

Switch to the maintainer view. Download the ciphertext, decrypt it in the browser, and show the report. Accept it. The UI role switch is for the one-device demo; the Compact contract still checks separate maintainer and researcher witnesses.

Say:

> The Compact contract checks the report binding, deadline, and severity rule. The local demo mirrors those checks only when the screen is labelled local. The maintainer still decides whether the report describes a real issue.

## Scene 5: Claim and disclosure, 20 seconds

Switch back to the researcher. Claim the test payout. The claim control is intentionally absent from the maintainer view. Publish a safe summary such as the affected component and patched version without reproduction details.

End with:

> QuietPatch gives open-source teams a public disclosure record without forcing the exploit into public view before the fix.

## Recovery plan

If preprod fails during recording, use the local network. Say that the recording uses the local network and show the compiled contract, test output, and full flow. Never imply that a local result happened on preprod.
