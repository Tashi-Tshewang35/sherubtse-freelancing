# GitHub preparation

GitHub stores source; it does not itself host this Express backend. Render later reads the repository. Sign in privately and never paste passwords or access tokens into source/chat.

## Check before staging

Open the terminal in the folder containing package.json. This workspace already has Git initialized; `git init` below is for a fresh extracted copy. The ignore rules protect private environment files, dependencies, coverage, dumps, backups, caches and generated ZIPs. Placeholder environment examples remain shareable.

```bash
git status --short
git check-ignore .env .env.test node_modules/ coverage/ backups/
git ls-files .env .env.test
```

check-ignore should list private paths; ls-files should print nothing for them. `npm run check:delivery` checks exclusions and known local secret values without printing credentials. Review `git diff --cached` before committing. Database dumps can contain private user records even when they contain no connection password.

## Commands

Create an empty repository on github.com, without an initial README if local commits already exist. Replace YOUR_GITHUB_REPOSITORY_URL with its actual HTTPS URL.

```bash
git init
git add .
git commit -m "Prepare Sherubtse Freelancing for deployment"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

| Command | Meaning |
| --- | --- |
| git init | Creates the local .git repository inside the project |
| git add . | Stages non-ignored changes for review |
| git commit ... | Records that staged snapshot locally |
| git branch -M main | Names the current branch main |
| git remote add origin ... | Links the local repository to your empty GitHub repository |
| git push -u origin main | Uploads commits and sets the upstream branch |

If origin exists, inspect `git remote -v` and deliberately change it with `git remote set-url origin YOUR_GITHUB_REPOSITORY_URL`. GitHub authentication may open a browser; ordinary account passwords do not work as Git HTTPS passwords. If identity is missing, set your own `git config user.name "Your Name"` and `git config user.email "Your GitHub Email"`. Do not force-push to solve an unfamiliar error.

## Secret prevention and recovery

.gitignore ignores `.env`, `.env.test` and private variants while allowing `.env.example`, `.env.production.example` and `.env.test.example`. An ignore rule does not untrack a committed file. If a private file is tracked, remove only that path from the index while preserving the local file:

```bash
git rm --cached -- .env .env.test
```

Specify only actually tracked files; an untracked path produces a pathspec error. Commit the removal. If credentials were uploaded, revoke/rotate them and consider cleaning history: deleting today's file does not remove old commits.

After pushing, confirm server.js, Dockerfile, package-lock.json, guides, schema/migration and placeholder examples are visible, while real environment files, dependencies and backups are absent. Hosting secrets belong in Render's settings. The optional CI workflow tests disposable databases and does not deploy.
