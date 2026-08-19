# AGENTS.md

Instructions for AI coding agents working in this repository. Applies to any tool
— Claude Code, Codex, Cursor, Copilot, Qoder, or anything else. Team members use
different agents, so this file is the shared source of truth.

## Project

UniLogs is a customisable digital logbook for university students, built by Team
Code of Duty for COMS3011A Software Design Project at the University of the
Witwatersrand.

## Structure

```
frontend/   React, TypeScript, Vite, Tailwind v4, shadcn/ui
backend/    Express, TypeScript, ESM, Prisma
docs/       Docusaurus documentation site
```

There are **no npm workspaces**. Each folder has its own `package.json` and
`package-lock.json` and is installed independently. Always `cd` into the correct
folder before running `npm` commands.

## Commands

| Folder      | Install       | Dev           | Check before committing                              |
| ----------- | ------------- | ------------- | ---------------------------------------------------- |
| `frontend/` | `npm install` | `npm run dev` | `npm run lint`, `npx tsc --noEmit`, `npm run build`  |
| `backend/`  | `npm install` | `npm run dev` | `npm run lint`, `npm run typecheck`, `npm run build` |
| `docs/`     | `npm install` | `npm start`   | `npm run build`                                      |
| root        | `npm install` | —             | `npm run format:check`                               |

CI runs all of these on every pull request. If a check fails locally it will fail
in CI, so run them first.

### After pulling

Run `npm install` in any folder whose `package-lock.json` changed. A missing
module after a pull almost always means a teammate added a dependency.

When adding a dependency, install it in the folder that needs it and commit both
`package.json` and `package-lock.json`. If two people add dependencies at the same
time the lockfiles will conflict — resolve by taking one side and re-running
`npm install`. Never hand-edit a lockfile.

### Keeping a branch current

Pull `main` before starting a branch, and merge `main` into any branch that lives
longer than a day:

```bash
git checkout main
git pull
git checkout your-branch
git merge main
```

Small conflicts resolved daily are much cheaper than one large conflict at the end
of a sprint.

## Commit messages

Format is `scope: description`. The scope must be one of exactly ten values:

```
repo  ci  backend  frontend  auth  entries  projects  tags  stats  docs
```

Rules:

- Description starts with a verb, all lowercase, present tense, no full stop
- **Never** use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) — a Husky
  `commit-msg` hook rejects them outright
- One scope per commit. If a change spans two scopes, make two commits
- When two scopes both fit, choose the specific one. A button on the entry form is
  `entries`, not `frontend`

Full shape:

```
entries: add validation to the entry form

Closes #23
Assisted-by: Claude-Code[Claude Sonnet 5]
```

Use `Closes #n`, never `refs #n` — only a closing keyword closes the issue when
the pull request merges.

## AI declaration — required

This is a course requirement, not a preference.

Any commit where an AI tool wrote or materially shaped the change **must** carry an
`Assisted-by:` trailer, on its own line after a blank line, naming the tool and the
model:

```
Assisted-by: <Tool>[<Model>]
```

Multiple tools go on one line, comma separated:

```
Assisted-by: Claude-Code[Claude Sonnet 5], ChatGPT-Web[GPT-5.5]
```

**Agents must use their own tool and model name, not one copied from an example in
this file.**

If your tool is not already named in the AI declaration section of the root
`README.md`, add it there in the same pull request. That declaration covers three
separate categories — code generation, in-line editing, and code review — and both
usage and non-usage must be stated accurately. The whole team is liable for an
incorrect declaration.

Documentation pages on the docs site carry their own declaration via the
`<AiDeclaration />` component. Every page needs one.

## Branches

```
prefix/issue-number-short-description
```

Prefixes: `feature/`, `bugfix/`, `hotfix/`, `design/`, `refactor/`, `test/`,
`doc/`, `chore/`.

Example: `feature/14-password-reset-flow`

Note that branch prefixes and commit scopes are **separate lists**. A branch named
`feature/14-password-reset` contains commits scoped `auth:`. Do not use a commit
scope as a branch prefix or vice versa.

## Pull requests

`main` is protected. Direct pushes are blocked. Every change goes through a pull
request with an approving review and four passing CI jobs.

Merges are **squash merge**, then delete the branch.

Keep pull requests narrow enough that one person can review them properly.

## Database

PostgreSQL on Neon, accessed through Prisma. The schema lives in
`backend/prisma/schema.prisma`.

```bash
cd backend
npx prisma generate      # regenerate the client after a schema change
npx prisma migrate dev   # create and apply a migration locally
npx prisma studio        # browse the data in a local UI
```

Run `npx prisma generate` after pulling any change to `schema.prisma`, or
TypeScript will still be using the old generated types.

Never edit files in `backend/prisma/migrations/` by hand. A migration that has
been applied is history — correct it with a new migration instead.

`DATABASE_URL` points at a Neon development branch for local work. The production
connection string lives only in Render's environment variables and is never
committed.

## Gotchas

These catch people. Read them before writing code.

**Backend uses ESM.** Relative imports need a `.js` extension even though the file
on disk is `.ts`:

```ts
import { createApp } from './app.js'; // correct
import { createApp } from './app'; // fails at runtime
```

Package imports such as `express` do not need it.

**Frontend uses the `@/` alias** for `src/`. `baseUrl` is deliberately absent from
both tsconfig files — it is deprecated and stops working in TypeScript 7.0. The
alias resolves from `paths` alone. Do not add `baseUrl` back.

**`frontend/src/components/ui/` is generated by shadcn/ui.** It is excluded from
ESLint and Prettier. Never edit these files by hand — the generator overwrites
them. Add components with `npx shadcn@latest add <component>`.

**State ownership on the frontend.** Data from the API belongs in TanStack Query.
Zustand is for state that never touches the server, such as UI preferences. Do not
store API responses in Zustand.

**Never commit `.env`.** When adding a new environment variable, add it to the
matching `.env.example` with the value left blank.

**Do not run `npm audit fix --force` anywhere in this repository.**

Two known advisories are accepted rather than fixed:

- `docs/` — vulnerabilities in Docusaurus build tooling. These are development
  dependencies that do not ship to users, and the available fixes require breaking
  major-version upgrades.
- `backend/` — `deepmerge-ts`, reached through `@prisma/config`. This is the Prisma
  CLI: a development dependency that never runs in production and only parses our
  own configuration file. The available fix downgrades Prisma across a major
  version, which would break the current `prisma.config.ts` layout.

Both were reviewed and accepted deliberately. Raise it in a pull request if you
believe either has changed.

## Style

- TypeScript everywhere, no `any` without a comment explaining why
- Prettier decides formatting — do not hand-format, do not argue with it
- Prefer clarity over cleverness; this codebase is read by seven people who are
  learning the stack
