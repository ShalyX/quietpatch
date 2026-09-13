# QuietPatch

Private vulnerability disclosure and bounty settlement for open-source projects.

This project is built on the Midnight Network.

## The problem

A security researcher has to choose between two bad options:

- send a sensitive report through a platform that exposes identity and report metadata;
- publish enough detail to prove the issue, which can put users at risk before a fix exists.

QuietPatch gives researchers a private submission path and gives maintainers a public record of the process. The exploit stays encrypted until the maintainer has reviewed it.

## What QuietPatch does

1. A maintainer creates a bounty with a severity threshold and a deadline.
2. A researcher prepares a report in the browser.
3. The browser encrypts the report for the maintainer and creates a commitment to the report contents.
4. The Compact contract is the enforcement target: it checks the commitment, severity threshold, report binding, deadline, and separate maintainer/researcher authorities without putting the report on the public ledger.
5. The maintainer accepts or rejects the report.
6. An accepted report creates a payout claim. The researcher can publish a safe summary after the patch.

The browser has three deliberate modes:

- with no wallet connected, it runs the clearly labelled local demo;
- with Lace connected but no attached contract, it prepares providers and locks workflow changes until a contract is deployed or attached;
- with Lace connected to an initialized contract, state-changing actions require a Midnight transaction. The app does not fall back to a local success message when that transaction is unavailable or fails.

The wallet button discovers a v4 Midnight DApp Connector wallet and initializes the matching Midnight.js providers. A deployed address is saved in this browser after a successful deployment; `VITE_CONTRACT_ADDRESS` is optional for preconfiguring a known, compatible contract.

The first release uses synthetic reports and a test payout amount. It does not handle real exploits or real funds. `claimPayout` records the authorised claim as `Paid`; it does not transfer tNIGHT or hold an escrow balance. The current contract supports one report per bounty; the next contract version should use a report collection and a funded settlement adapter.

## What Midnight handles

The Compact contract stores the public process state:

- bounty owner, bounty ID, severity threshold, reward, and deadline;
- report commitment and status;
- acceptance result and payout claim;
- disclosure status and final report digest.

The report text, attachments, raw severity score, report nonce, and encryption details stay outside the public ledger. The Compact contract is written to receive private inputs and a proof that binds those inputs to the public commitment. Maintainer and researcher use separate private witnesses, so a maintainer witness cannot claim a researcher payout. The current browser adapter mirrors this flow locally.

The proof does not decide whether a vulnerability is real. A maintainer still reviews the encrypted report. The contract covers the conditions it can check: binding, severity threshold, submission timing, and one-time claim state.

## Wave 1 scope

The Wave 1 build must include:

- one Compact contract that compiles;
- a local Midnight development setup;
- a browser report form;
- client-side AES-GCM encryption;
- a small TypeScript service for encrypted bundle storage;
- maintainer review and accept/reject screens;
- a payout claim record using test balance;
- contract tests and an end-to-end demo;
- a public GitHub repository with setup instructions.

Wave 1 will not include a public bug database, automatic vulnerability scoring, live security reports, or production payments.

## Project layout

The repository layout is:

```text
quietpatch/
  apps/web/                 React and TypeScript client
    src/wallet.ts           Midnight wallet discovery and connection
    src/midnightClient.ts   Midnight.js provider factory and contract binding
  apps/api/                 Encrypted bundle service
  contract/                 Compact contract and generated bindings
  scripts/                  Cross-platform contract compile helper
  docs/                     Project documentation
```

## Local setup

The browser demo runs with Node.js 22 or newer. Compact 0.31.1 runs through WSL2 on Windows. Docker Desktop is needed for a Midnight local network; it is not needed to view the browser demo.

```bash
npm install
npm run compile:contract
npm run typecheck
npm run build
```

`npm run build` copies the compiled contract's ZK keys and ZKIR files into the web build. Those generated files are ignored by Git, so run `npm run compile:contract` after a fresh checkout before building.

The default network ID is `undeployed`. It requires a Lace configuration compatible with that network. If Docker is unavailable, Preprod is an alternative: copy `apps/web/.env.example` to `apps/web/.env`, set `VITE_NETWORK_ID=preprod`, and leave `VITE_CONTRACT_ADDRESS` empty for the first run. After connecting, `Deploy contract` sends a deployment request to Lace and saves the successful address in this browser. Then use `Initialize bounty` for the separate `createBounty` transaction. You may place a known compatible address in `VITE_CONTRACT_ADDRESS` for a fresh browser profile.

Start the web app:

```bash
npm run dev:web
```

Start the encrypted bundle service in a second terminal if you need the API path:

```bash
npm run dev:api
```

The web app uses a local ledger adapter only when no wallet is connected. A connected wallet initializes the Midnight.js provider stack from `apps/web/src/midnightClient.ts`. If there is no attached contract, the app exposes `Deploy contract` and locks report, review, payout, and disclosure mutations. After deployment, `Initialize bounty` sends the first circuit call. Once attached and initialized, report submission and maintainer actions call the deployed contract. The Compact source and generated artifacts live under `contract/`. The API keeps bundles in memory for the demo and does not provide durable storage.

No wallet seed, API token, private key, or report secret belongs in the repository.

## Design limits

QuietPatch also does not prove the truth of an external security claim. The maintainer's review remains part of the workflow. The contract records what happened and prevents changes to the submitted evidence.

## Documentation

- `ARCHITECTURE.md` describes the public and private data boundary.
- `CONTRACT_SPEC.md` lists the Compact state machine and checks.
- `API.md` describes encrypted bundle storage.
- `THREAT_MODEL.md` records the security assumptions.
- `TEST_PLAN.md` lists the release tests.
- `DEMO_SCRIPT.md` is the Wave 1 recording script.
- `VIDEO_CAPTURE.md` is the final-state capture plan for the required demo video.
- `DEMO_FIXTURE.md` contains safe synthetic demo values.
- `DEPLOYMENT_RUNBOOK.md` is the wallet, tDUST, and transaction recovery runbook.
- `SUBMISSION_COPY.md` contains paste-ready submission text.
- `WAVE1_SUBMISSION.md` records the verified deployment evidence and manual Akindo handoff.
- `MIDNIGHT_RESOURCES.md` records the Akindo resources and MCP setup.

## License

Midnight-related code written for this project must use Apache License 2.0. Add the full `LICENSE` file before submission. Third-party packages keep their own licenses.

## Hackathon submission

The submission needs a public repository, slide deck, demo or pitch video, a clear README, and the `midnightntwrk` GitHub label. See `SUBMISSION_CHECKLIST.md` for the final review.
