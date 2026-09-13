# QuietPatch test plan

## Test policy

The test suite must run without real security reports or real funds. Use fixed synthetic reports and test accounts. Keep the fixtures small enough that a new contributor can understand them.

## Contract tests

### Bounty creation

- creates a bounty with valid details;
- rejects a reused bounty ID;
- rejects a zero or oversized reward;
- rejects a threshold outside the supported range;
- rejects a deadline in the past.

### Report submission

- accepts a valid proof and commitment;
- rejects an invalid proof;
- rejects a proof bound to another bounty;
- rejects a changed report digest;
- rejects a severity below the threshold;
- rejects a duplicate commitment;
- rejects a late submission;
- rejects a submission after the bounty closes.

### Review and payout

- allows only the maintainer to accept;
- allows only the maintainer to reject;
- rejects review of a report that is not `Submitted`;
- allows the bound researcher to claim an accepted report;
- rejects a claim from another account;
- rejects a second claim;
- keeps a rejected report unpaid;
- allows a valid disclosure only after acceptance or payment.

## Encryption tests

- encrypts and decrypts a canonical report package;
- rejects a changed ciphertext;
- rejects a changed report field after decryption;
- rejects the wrong maintainer key;
- clears the report key after the review session ends;
- never writes plaintext to the API request body logs.

## API tests

- accepts ciphertext with a valid signed request;
- rejects a missing or expired session;
- rejects a researcher reading another researcher's bundle;
- rejects a non-maintainer reading a bundle;
- enforces bundle size and content-type limits;
- does not expose a public bundle URL;
- does not return report contents in error responses.

## End-to-end test

Run the following with fresh local accounts:

1. Maintainer creates a bounty.
2. Observer opens the public record.
3. Researcher enters a synthetic report.
4. Browser encrypts the report and creates the typed Midnight `persistentHash` commitment. When a contract address is configured, the generated bindings create and submit the network proof.
5. Researcher submits the report.
6. Observer sees a commitment and `Submitted`, but no report text.
7. Maintainer retrieves and decrypts the report.
8. Maintainer accepts the report.
9. Researcher claims the test payout.
10. Observer sees `Paid` and the same commitment.
11. Researcher publishes a safe summary.

Repeat the flow with a rejected report, a late report, and an altered bundle.

## Release checks

- Run tests from a clean checkout.
- Run the app with empty logs and inspect every browser network response.
- Confirm the contract address and commit hash in the demo configuration.
- Test the demo with a person who did not write the contract.
