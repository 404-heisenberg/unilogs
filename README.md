# UniLogs

A customisable digital logbook for university students. Students record what they
work on, define what a log entry looks like rather than accepting a fixed template,
group entries into projects, tag them, and see where their time goes.

Built by **Team Code of Duty** for COMS3011A Software Design Project, University
of the Witwatersrand.

## Repository layout

```
frontend/   React + TypeScript + Vite
backend/    Express + TypeScript + Prisma
docs/       Docusaurus documentation site
```

There are no npm workspaces. Each folder is installed and run independently.

## Getting started

Requires Node.js 20 or later.

```bash
git clone https://github.com/404-heisenberg/unilogs.git
cd unilogs

npm install
cd frontend && npm install
cd ../backend && npm install
cd ../docs && npm install
```

Copy each `.env.example` to `.env` and fill in the values. See the README in each
folder for what goes where.

To run the stack locally, use two terminals:

```bash
cd backend && npm run dev     # http://localhost:3000
cd frontend && npm run dev    # http://localhost:5173
```

## Git conventions

**Commits** follow the Scoped Commits format. The scope must be one of ten frozen
values and is checked automatically by a Husky hook.

```
repo  ci  backend  frontend  auth  entries  projects  tags  stats  docs
```

```
entries: add validation to the entry form

Closes #23
Assisted-by: Claude-Web[Claude Opus 5]
```

Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) are rejected by the hook.
Use `Closes #n`, not `refs #n` — only a closing keyword actually closes the card.

**Branches** use prefix conventions:

```
feature/  bugfix/  hotfix/  design/  refactor/  test/  doc/  chore/
```

Format: `prefix/issue-number-short-description`, e.g. `feature/14-password-reset`.

Note the branch prefix and the commit scope are separate lists. A branch named
`feature/14-password-reset` contains commits scoped `auth:`.

**Merging** is squash merge, then delete the branch. Every change goes through a
pull request with an approving review.

Full detail is in the Git Methodology document.

## AI declaration

This project is developed with AI assistance in line with the course policy.
Any commit where an AI tool wrote or materially shaped the change carries an
`Assisted-by:` trailer naming the tool and model.

The two commits that bootstrapped this repository, `30cbc3d` and `8382818`,
predate the adoption of that convention. Both were produced with the assistance
of `Claude-Web[Claude Opus 5]` — repository tooling, git hooks, and Prettier
configuration. They are declared here rather than by rewriting history.

In-line editor autocomplete is not declared per commit.

## Team

Mosey · Renda Mudau · Chuene Thato · Dikeledi Mokoatle · Lethabo Sekgobela ·
Ozuko Mabongo · McAtaaji Andongndou
