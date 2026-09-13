# QuietPatch deployment runbook

Use this runbook for the wallet-backed demo. It does not replace the local demo path.

## Before opening Lace

Run these checks from the repository root:

```bash
npm run compile:contract
npm run typecheck
npm test
npm run build
```

Start the web app and the encrypted-bundle service:

```bash
npm run dev:web
npm run dev:api
```

For the current Undeployed setup, confirm the proof service is reachable at `http://localhost:6300` before opening the app.

## Wallet readiness

1. Open Lace and unlock the intended account.
2. Select the same Midnight network configured in QuietPatch.
3. Confirm the account holds the funded test tNIGHT.
4. Check the tDUST panel.
   - `Refilling` means the tNIGHT-to-tDUST designation is already active.
   - Do not try to generate tDUST again while it is refilling.
   - If the balance is small, wait for it to grow before spending a deployment attempt.
5. Connect Lace from QuietPatch and approve the site connection.

## Deployment sequence

1. Confirm the QuietPatch header shows `lace`, the expected network, and a readable tDUST balance.
2. Select **Deploy contract** once.
3. Approve the deployment in Lace.
4. Wait for the app to report the final deployment status. Do not click the button a second time while it is processing.
5. Record the returned contract address, network, git commit, and transaction ID.
6. Select **Initialize bounty** and approve the separate Lace transaction.
7. Refresh chain state and confirm the bounty appears before submitting the synthetic report.

## Expected transaction boundaries

| Action | Lace approval expected? | Safe retry rule |
|---|---:|---|
| Deploy contract | Yes | Retry only if the app failed before submission. |
| Initialize bounty | Yes | Refresh chain state before retrying. |
| Submit report | Yes | Do not retry after a submit/confirm-stage failure until chain state is checked. |
| Accept or reject | Yes | Refresh chain state before retrying. |
| Claim payout | Yes | Retry only if the public state is still `ACCEPTED`. |
| Publish disclosure | Yes | Refresh chain state before retrying. |

When Lace is connected without an attached contract, QuietPatch locks these actions. Disconnecting Lace is the explicit way to return to the local demo.

## Known recovery cases

### Not enough tDUST

Leave the tNIGHT designation active and wait for the tDUST balance to refill. A balance-stage failure means the deployment was not submitted, so one later retry is safe.

### Failure after submit or confirmation

Do not deploy again. Refresh the chain state, check Lace activity, and record any transaction ID shown by the app.

### Saved contract cannot decrypt private state

Do not clear browser storage or reset Lace. QuietPatch preserves the old contract address and ciphertext. That address may still be useful for recovery with the original browser private-state key. A new deployment requires enough tDUST and creates a separate contract namespace.

### Wallet connection stuck

Unlock Lace, verify the selected network, close and reopen the extension, then reconnect QuietPatch. If Lace has changed network endpoints, wait for its balance panel to finish syncing before retrying.
