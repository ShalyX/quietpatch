# QuietPatch submission checklist

Use the live Akindo page for the current Wave deadline. The rules PDF contains an earlier schedule, so check the submission page again before uploading.

## Code

- [ ] Public GitHub repository is reachable without a private invitation.
- [ ] Midnight-related code has an Apache License 2.0 license file.
- [ ] Repository has the `midnightntwrk` GitHub label.
- [ ] At least one Compact contract compiles from a clean checkout.
- [ ] Contract address, network, and commit hash are recorded.
- [ ] Package and ledger versions are pinned or documented.
- [ ] No private keys, wallet seeds, API tokens, report contents, or personal data appear in the repository.
- [ ] README explains setup, architecture, Midnight integration, limitations, and test commands.

## Product

- [ ] Maintainer can create a bounty.
- [ ] Researcher can encrypt and submit a synthetic report.
- [ ] Contract stores a commitment and workflow state.
- [ ] Maintainer can review the encrypted report.
- [ ] Observer cannot read the report.
- [ ] Acceptance and rejection work.
- [ ] A paid report cannot be claimed twice.
- [ ] Safe disclosure summary works.
- [ ] Local fallback works if preprod is unavailable during judging.

## Tests

- [ ] Contract tests pass.
- [ ] Proof failure test passes.
- [ ] Deadline test passes.
- [ ] Duplicate submission test passes.
- [ ] Wrong maintainer test passes.
- [ ] Wrong researcher test passes.
- [ ] Double claim test passes.
- [ ] Changed bundle test passes.
- [ ] Observer response scan finds no report text or private fields.

## Submission materials

- [ ] Slide deck explains the problem, flow, private/public split, contract, tests, and next release.
- [ ] Video shows the full path using synthetic data.
- [ ] Video states whether it uses local or preprod.
- [ ] Video matches the submitted commit.
- [ ] Wave progress description lists what changed in this Wave.
- [ ] Every team member registered on AKINDO.
- [ ] GitHub, slide deck, and video links open in a private browser session.
- [ ] Submission is uploaded before the live deadline.
