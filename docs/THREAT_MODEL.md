# QuietPatch threat model

## Security goals

QuietPatch should protect the report contents and researcher secrets before public disclosure. It should make the public workflow tamper-evident and stop an accepted report from being paid twice.

## Assets

- vulnerability report and reproduction steps;
- researcher identity and wallet binding;
- maintainer decryption key;
- bounty amount and claim;
- report commitment;
- acceptance and disclosure history.

## Trust assumptions

- The maintainer can read a report after receiving the decryption key.
- The maintainer reviews the report honestly enough to decide acceptance.
- The browser and wallet are not already compromised.
- The Midnight proof system and supported hash primitives work as specified.
- A zero-knowledge proof cannot establish facts that never entered its witness or public inputs.

## Threats and controls

| Threat | Control |
|---|---|
| API operator reads a report | Encrypt in the browser before upload. |
| An attacker changes the bundle | Bind the canonical report digest to the contract commitment and verify after decryption. |
| A researcher replays a valid claim | Bind the proof to bounty ID, report ID, wallet binding, and nonce; reject used claims. |
| A researcher submits after the deadline | Check the deadline in the contract, not only in the browser. |
| A non-maintainer accepts a report | Check the maintainer address in the contract and signed API session. |
| A report receives two payouts | Move state to `Paid` before accepting another claim. Test the retry path. |
| A public page leaks report text | Keep observer queries separate from maintainer queries and add an automated response-body check. |
| Attachment name reveals the issue | Strip filenames and avoid public object URLs. |
| Malicious attachment harms the maintainer | Do not open attachments in the browser by default; use size and type limits and a sandbox in a hosted release. |
| Fake severity passes the proof | Keep severity proof separate from maintainer acceptance. Say this in the UI and pitch. |
| A stolen maintainer key exposes reports | Use a separate report encryption key, show key fingerprint, and plan rotation and revocation for a later release. |
| Spam fills the report store | Add request limits now; add a deposit or invitation rule after the MVP. |
| Contract admin changes bounty rules | Keep the Wave 1 admin surface small and document every admin action. Add multisig or governance later. |

## Privacy review before release

Search the web app, API, logs, and error messages for these fields:

```text
report text
reproduction steps
attachment filename
severity score
email address
encryption key
private wallet data
```

No field on that list should appear in an observer response, browser URL, public contract state, or default log line.
