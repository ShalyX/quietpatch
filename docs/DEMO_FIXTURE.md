# QuietPatch demo fixture

Use this fixture only for recordings, tests, and screenshots. It is not a real vulnerability report.

## Bounty

| Field | Value |
|---|---|
| Bounty ID | `QP-BTY-001` |
| Title | Midnight contract review |
| Component | `quietpatch-demo-contract` |
| Minimum severity | 4 |
| Test reward | 250 tNIGHT |

## Synthetic report

| Field | Value |
|---|---|
| Title | Replayable approval after test-session revocation |
| Affected component | `quietpatch-demo-contract` |
| Affected version | `0.1.0` |
| Private severity | 4 |
| Summary | A synthetic test session can reuse a previously issued approval marker after that session is marked revoked. This fixture is made up for the QuietPatch demo. |
| Reproduction | 1. Create the synthetic test session.\n2. Record its approval marker.\n3. Mark the session revoked.\n4. Reuse the marker in the test route.\n5. Observe that the fixture accepts it. |
| Impact | The synthetic fixture demonstrates how an outdated authorization proof could be reused in a test environment. It does not describe a live exploit. |
| Suggested fix | Bind the approval marker to the current session version and reject markers issued before revocation. |

## Safe disclosure summary

Use after the payout demonstration:

> Patched a synthetic approval-replay test case in version 0.1.1. No production vulnerability or user data was involved.

## Recording rules

- Never enter a real vulnerability, private key, seed phrase, API token, or personal information.
- Keep the report body visible only in the maintainer scene.
- In the observer scene, show the commitment and status instead of this fixture text.
