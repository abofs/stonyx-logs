# Release Process

This package follows the shared Stonyx release pipeline implemented in
[abofs/stonyx-workflows](https://github.com/abofs/stonyx-workflows). This repo's own
`.github/workflows/*.yml` files are thin wrappers that `uses:` the reusable workflows defined
there (`ci.yml`, `npm-publish.yml`, `cascade.yml`, `security-audit.yml`); the actual job steps
live in the shared repo, not here. What follows is verified against this repo's three workflow
files (`.github/workflows/ci.yml`, `publish.yml`, `security-audit.yml`), `package.json`'s
`prepublishOnly` script, and a read-only look at the shared workflows' current content — not
copied from the shared repo's own docs. **Infrastructure specifics — secrets, OIDC/token
handling, branch protection — are out of scope for this document**; see
[stonyx-workflows/docs/release.md](https://github.com/abofs/stonyx-workflows/blob/main/docs/release.md)
for those.

**npm package:** `@stonyx/logs`

## 1. CI (`.github/workflows/ci.yml`)

Runs on PRs targeting `dev`, `main`, or any `fix/**` branch. The reusable job:

1. Checks out the code.
2. `pnpm install --frozen-lockfile`
3. `pnpm test`
4. `pnpm run --if-present build` (this repo declares `build`, so it runs)
5. A docs-import check that verifies every `@stonyx/*` import shown in this repo's `README.md` /
   `docs/**/*.md` resolves against a real published (or locally built) export.

This matches what `pnpm install --frozen-lockfile && pnpm test` verified locally in this task:
install was clean against the committed lockfile, and all 79 tests passed. Lint (`pnpm lint`) is
**not** part of `ci.yml` — it is not run in CI for this repo, only locally/on-demand.

## 2. Publish (`.github/workflows/publish.yml`)

Triggers, as declared in this repo's `publish.yml`:

- `repository_dispatch` (`cascade-publish`) — triggered by an upstream Stonyx package's own
  publish, to cascade a dependency bump into this package.
- `workflow_dispatch` — manual run with a `version-type` (`patch`/`minor`/`major`) or a
  `custom-version`.
- `pull_request` (`opened`, `synchronize`, `reopened`) targeting `dev` or `main` — i.e. **opening
  or pushing to a PR into `dev` or `main` triggers a publish run**, not just CI.
- `push` to `dev` or `main`.

The reusable `npm-publish.yml` job picks a version channel from the triggering event (in this
order): a cascade dispatch publishes beta; a `pull_request` event publishes alpha; a push to
`main` publishes stable; any other push (i.e. to `dev`) publishes beta. This means:

- Opening/updating a PR into `dev` → **alpha** publish, commented back onto the PR.
- Merging into `dev` (a push to `dev`) → **beta** publish.
- Merging `dev` into `main` (a push to `main`) → **stable** publish.

`prepublishOnly` (`npm run build && npm test`) is **not** run by `pnpm publish`/`npm publish`
directly — `pnpm pack` (which the reusable workflow uses to build the release artifact) runs
`prepack`/`prepare`, not `prepublishOnly`. The reusable workflow accounts for this: it explicitly
checks whether `prepublishOnly` is declared and runs it itself immediately before packing. Net
effect for this repo: `npm run build && npm test` really does run once per publish, which matches
the intent of declaring `prepublishOnly` in `package.json` — but it is worth knowing that this
happens because the shared workflow special-cases it, not because `pnpm pack`/`npm publish` runs
it natively.

A successful publish also dispatches to downstream dependents via the reusable `cascade.yml` job,
so that packages depending on `@stonyx/logs` pick up the new version automatically. This repo does
not declare any Stonyx dependencies itself, so it is a cascade *source*, not a cascade *target*.

## 3. Security audit (`.github/workflows/security-audit.yml`)

Runs on a daily cron (`0 8 * * *`) and on manual `workflow_dispatch`. The reusable job installs
with `pnpm install --frozen-lockfile` and runs `pnpm audit --audit-level moderate` with
`continue-on-error: true` — a finding is surfaced in the job log but does not fail the run or
block anything.

## What this document could not verify from this repo alone

- The exact mechanics of OIDC/npm-token handling, the release-artifact `.git`-content guard, and
  branch-protection rules on `dev`/`main` are implemented in `abofs/stonyx-workflows` and are
  deliberately not reproduced here (see the infra note above).
- Whether `dev`/`main` currently have branch protection rules configured is not something this
  repo's files can confirm or deny.
