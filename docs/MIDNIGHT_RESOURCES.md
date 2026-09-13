# Midnight resources

This list was checked against the Akindo Buildathon Overview page on September 2, 2026.

## Main resources

| Resource | Use for QuietPatch |
|---|---|
| [Midnight docs](https://docs.midnight.network/) | Compact, runtime, wallets, network, and security reference |
| [Midnight GitHub organization](https://github.com/midnightntwrk) | Official repositories and examples |
| [Midnight local dev](https://github.com/midnightntwrk/midnight-local-dev) | Local node, indexer, proof server, and funded test accounts |
| [Midnight RPS sample app](https://github.com/mashharuki/midnight-rps-sample-app/blob/main/README.md) | Full-stack Compact app with Lace Wallet integration |
| [Effectstream](https://github.com/effectstream/effectstream) | Optional Web3 and multi-chain infrastructure |
| [Kuira SDK](https://github.com/kuiralabs/kuira-sdk-android) | Optional Android wallet and privacy application path |
| [Midnight Discord](https://discord.gg/SUZNRF6fu) | Technical support and buildathon updates |
| [Luma kickoff page](https://luma.com/midnight-buildathon) | Workshop registration and recording access |

## AI build tools

The Overview page links to [Kapa and Midnight Expert](https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert).

Midnight's current guidance is:

- Kapa is the documentation and question-answering MCP server.
- Midnight Expert is the hands-on plugin set for Compact, DApp, wallet, devnet, proof, and error workflows.
- The old Midnight MCP should not be used.

### Kapa MCP endpoint

For an MCP client that accepts remote HTTP servers:

```json
{
  "mcpServers": {
    "midnight": {
      "type": "http",
      "url": "https://midnight.mcp.kapa.ai"
    }
  }
}
```

The official migration article also documents the Claude Code command:

```bash
claude mcp add --transport http midnight https://midnight.mcp.kapa.ai
```

### Midnight Expert

The official install command is:

```bash
curl -fsSL https://midnightntwrk.expert/install.sh | bash
```

The most useful workflows for this project are contract verification, local devnet setup, status-code lookup, toolchain fact-checking, wallet integration, and DApp scaffolding.

## Resources already used

- The official Compact compiler and standard-library reference were used for the contract.
- The official `example-bboard` and `example-counter` repositories were used as Compact and TypeScript references.
- Compact 0.31.1 is installed in WSL2 for this repository.

## Access status in this workspace

The current Codex session has web access, local Compact tooling, the repository references above, and the authenticated Kapa MCP endpoint. The available Kapa capability is Midnight documentation search. Midnight Expert is a separate Claude Code plugin set and is not connected to this Codex task.

The project can still be built locally. Kapa is useful for checking Compact, wallet, devnet, proof, and SDK questions while implementing the real wallet and devnet integration.
