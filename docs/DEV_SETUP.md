# QuietPatch development setup

## Supported local paths

| Task | Path |
|---|---|
| Web app | Windows or WSL2 |
| API service | Windows or WSL2 |
| Compact compiler | WSL2 Linux on Windows, Linux, or macOS |
| Midnight local network | Docker Desktop with Compose |
| Preprod wallet flow | Lace wallet and the supported Midnight network configuration |

The Windows `compact.exe` utility is not the Midnight Compact compiler. Run Compact through WSL2.

The browser app uses the Midnight DApp Connector API for wallet discovery. It supports v4 connector wallets such as Lace. The default app network is `undeployed`. If Docker is unavailable, use `preprod` in both the wallet and `apps/web/.env`.

## First install

Install Node.js 22 or newer on the host. Install WSL2 with an Ubuntu distribution. In WSL2, install the Compact devtools and select the toolchain used by this repository:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
compact compile --version
```

The expected compiler version is `0.31.1`, which targets Compact language version `0.23`.

## Install the project

From PowerShell or WSL2, enter the repository and install the npm workspaces:

```bash
npm install
```

Compile the contract:

```bash
npm run compile:contract
```

The Windows helper calls WSL2 automatically. On Linux or macOS, it calls `compact` directly.

The web build reads ZK keys and ZKIR files from the generated contract directory. Run `npm run compile:contract` after cloning before starting or building the web app; generated contract output is not tracked. A contract deployed before a Compact witness change is not compatible with the new verifier keys, so reset the demo and deploy a fresh contract after this role-authority update.

## Start the browser demo

```bash
npm run dev:web
```

Open the Vite URL shown in the terminal. Use the role tabs to run the researcher, observer, and maintainer flows. The demo stores only encrypted report data and public metadata in browser storage. Reset the demo before recording a new run.

The `Connect wallet` control checks for a v4 Midnight DApp Connector wallet and initializes the Midnight.js provider stack. For the no-Docker Preprod path, copy `.env.example` and set:

```text
VITE_NETWORK_ID=preprod
VITE_CONTRACT_ADDRESS=
```

Install or open a supported Lace v4 wallet, switch it to the selected network, fund the same Lace account with test tNIGHT, and designate it for tDUST generation. tDUST refills over time; a `Refilling` status means designation is already active and does not need another click. Start the web app and connect the wallet. Select `Deploy contract`; once the deployment is included, the app saves the returned address and contract client in the browser profile. Select `Initialize bounty` to send the separate `createBounty` transaction. A known compatible address can also be set as `VITE_CONTRACT_ADDRESS` for a fresh browser profile. With an attached contract, report submission and maintainer actions use Midnight transactions. If Lace is connected but no contract is attached, the app locks workflow changes instead of silently using the local demo. The contract now uses separate maintainer and researcher witnesses. The one-device demo can use the role tabs; a separate researcher wallet can attach with fresh private state and submit, while the maintainer must retain the private state created during deployment. If the wallet reports a proof-provider or network error, check that the wallet network matches `VITE_NETWORK_ID`; the browser client requests proving from the connected wallet.

For the local Midnight network, Docker Desktop and the Midnight local-dev repository are still required. That path is optional for this project and is not needed to run the browser demo or use Preprod.

## Start the API

In another terminal:

```bash
npm run dev:api
```

Check the service:

```bash
curl http://localhost:8787/health
```

The current service keeps bundles in memory. Restarting it removes them. That is deliberate for the browser demo; a preprod release needs durable encrypted storage.

## Checks before committing

```bash
npm run typecheck
npm run build
npm run compile:contract
```

If the contract compiler downloads proving parameters, let the first run finish before judging the result. Keep the generated directory out of source control unless the submission plan calls for publishing the artifacts.
