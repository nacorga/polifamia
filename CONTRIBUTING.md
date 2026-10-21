# Contributing to Polifamia

Thanks for your interest. Polifamia investigates political claims, so the rules on evidence and neutrality matter
as much as the code. Before opening a PR, read:

- [`.specify/memory/constitution.md`](.specify/memory/constitution.md): non-negotiable principles (Spanish).
- [`docs/governance.md`](docs/governance.md): who decides, how sources are added and how a result is disputed.
- [`specs/001-youtube-claim-investigation/`](specs/001-youtube-claim-investigation/): MVP spec, plan and tasks (Spanish).

Issues and PRs are welcome in English or Spanish.

## Setup

Follow the "Development" section of the [README](README.md). You need Node ≥22.12, pnpm and Docker. `demo` mode needs
no provider keys.

## Workflow

1. Open or comment on an issue before large changes.
2. Spec-driven work (github/spec-kit): new features start from a spec in `specs/NNN-*/`. `tasks.md` is the shared
   state: tick `[x]` as each task is completed.
3. Any change to the evidence policy, the approved sources or the result states requires an ADR in
   [`docs/adr/`](docs/adr/).
4. One branch per change, small commits using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat(api): …`, `fix(extension): …`, `docs: …`).
5. Before asking for review, everything green:

   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
   pnpm e2e   # if you touch the extension
   ```

## Rules no PR can bypass

- **Evidence before verdict**: conclusions are decided by deterministic code, never by the LLM
  ([ADR 0002](docs/adr/0002-politica-de-evidencia.md)).
- **Neutrality**: nothing may depend on the speaker, party or political identity. Invariance tests check this.
- **No YouTube scraping**: no captions, internal endpoints or downloads.
- **No secrets in the extension**: `apps/extension/scripts/check-bundle.mjs` fails the build if any are found.
- **Simulated data is always labelled DEMO.**
- **Human gates** (legal, dataset review, evidence audit, user validation) are documented in
  [`docs/gates.md`](docs/gates.md). A PR does not close them.

## License of contributions

By contributing you agree that your code is published under [AGPL-3.0-or-later](LICENSE) and your data under the
licenses in [`DATA-LICENSE.md`](DATA-LICENSE.md). There is no CLA.

## Security and conduct

Report vulnerabilities privately, never in issues: see [`SECURITY.md`](SECURITY.md). This project follows a
[Code of Conduct](CODE_OF_CONDUCT.md).
