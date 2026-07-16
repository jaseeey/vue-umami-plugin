---
name: release-vue-umami-plugin
description: Run the official `@jaseeey/vue-umami-plugin` release workflow by verifying a clean `develop` branch, selecting the next stable semver version, bumping `package.json` and `package-lock.json` without auto-tagging, committing the version bump separately, merging `develop` into `main`, tagging the merge commit, merging `main` back into `develop`, and pushing both branches plus the new tag to `origin`. Use when `vue-umami-plugin` changes are validated and ready for release, then stop and hand off for the user's manual build and npm publish step.
---

Run this workflow from the repository root of `vue-umami-plugin`.

## Inputs

- The user may provide an exact release version such as `1.6.0` or a bump intent of `patch`, `minor`, or `major`.
- The user may optionally name downstream repositories that should be updated after the release is pushed.
- If no version is provided, inspect the latest stable tag and `git log <latest-tag>..develop --oneline`, recommend `patch`, `minor`, or `major`, and ask the user to confirm before versioning.

## Preconditions

- Work from `develop`.
- Ensure all non-version changes are already committed before starting.
- Do not include ticket numbers in `vue-umami-plugin` commit messages unless the user explicitly requests them or the change genuinely needs one.
- This workflow only creates the version bump commit. If other files are still modified, stop and ask the user how to handle them.
- Ensure there are no lingering alpha version bumps or other uncommitted changes in `package.json` or `package-lock.json` before proceeding.
- Do not run `npm publish` as part of this skill. The user must execute the publish step manually because it requires an OTP.

## Workflow

1. Sync branches before the release:

```bash
git fetch origin
git checkout develop
git pull --ff-only origin develop
git checkout main
git pull --ff-only origin main
git checkout develop
```

2. Resolve the target version:
   - If the user supplied an exact version, validate stable semver format and ensure it is newer than the latest release tag.
   - If the user supplied a bump type, use it directly with `npm version`.
   - If no version was supplied, recommend `patch`, `minor`, or `major` from the commits since the latest tag and ask for confirmation.
3. Bump the version without creating a git tag or version commit:

```bash
npm version <version|patch|minor|major> --no-git-tag-version
```

4. Commit only the version files as a separate commit:

```bash
git add package.json package-lock.json
git commit -m "Bump version to X.X.X"
```

5. Merge `develop` into `main` with a non-fast-forward merge and the standard message:

```bash
git checkout main
git merge --no-ff develop -m "Merge branch develop"
```

6. Create the release tag on the merge commit, not on the version bump commit:

```bash
git tag vX.X.X HEAD
```

7. Merge `main` back into `develop`. Prefer a fast-forward; if it fails, stop and inspect instead of forcing an extra merge commit:

```bash
git checkout develop
git merge --ff-only main
```

8. Push both branches and the new tag:

```bash
git push origin main
git push origin develop
git push origin vX.X.X
```

9. Stop after the git push and report that the repository is ready for the manual release handoff:
   - Tell the user the release branches and tag are pushed.
   - Tell the user the repository is ready for manual build and publish.
   - Do not call `npm publish`.
   - Provide the exact next command for the user to run manually:

```bash
npm publish
```

   - Note that `npm publish` will run the package's `prepack` hook, which already builds the distributable. If the user wants to verify the build explicitly before publishing, they can run:

```bash
npm run build
```

10. If the user named downstream repositories, update only those repositories after the manual publish is complete. Do not mass-update unrelated projects.

## Report

- Released version
- Version bump commit SHA
- Merge commit SHA
- Tag name
- Push status for `main`, `develop`, and the tag
- Confirmation that the repo is ready for manual build and `npm publish`
- Reminder that publish was intentionally not executed because it requires the user's OTP
- Downstream repositories updated, if any
