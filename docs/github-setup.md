# GitHub Setup

This repo is prepared for a GitHub connection, but no remote or credentials are configured yet.

Intended initial GitHub repository:

- Owner: `ArneGleason`
- Repo: `grow`
- URL: `https://github.com/ArneGleason/grow`
- Initial visibility: `private` unless Arne explicitly changes it.

## Repo Remote

Before creating a GitHub repo, confirm:

- Repo slug: likely `grow`, but confirm first.
- Owner: likely `arnegleason`, but confirm first.
- Visibility: `private` or `public`.
- Canonical local checkout: keep `/Users/arnegleason/Documents/Grow` or move to `/Users/arnegleason/code/github.com/arnegleason/grow`.

Check GitHub CLI authentication:

```sh
gh auth status
```

Create and connect the remote after visibility is confirmed:

```sh
gh repo create ArneGleason/grow --source=. --remote=origin --private
git push -u origin main
```

Use `--public` only after the human owner confirms public visibility.

## Product Integration Options

If Grow itself needs to connect to GitHub, choose the credential model based on the product need:

- GitHub App: best default for repository automation, webhooks, installation-scoped permissions, and least privilege.
- OAuth App: useful for "sign in with GitHub" or user-delegated actions.
- Fine-grained personal access token: acceptable for local development or one-off scripts, not ideal as a long-term product credential.

## Local Environment Variables

Copy `.env.example` to `.env.local` when credentials are needed. Keep `.env.local` ignored.

Potential variables:

```sh
GITHUB_OWNER=arnegleason
GITHUB_REPO=grow
GITHUB_TOKEN=
GITHUB_APP_ID=
GITHUB_APP_INSTALLATION_ID=
GITHUB_PRIVATE_KEY_PATH=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
```

Only add the variables that the selected integration actually needs.

## Secret Rules

- Never commit tokens, OAuth secrets, private keys, webhook secrets, or raw credential exports.
- Keep private keys outside the repo, or store encrypted secrets in the deployment environment.
- Use least-privilege scopes and document the scopes here once chosen.
- Rotate credentials if any secret is pasted into chat, logs, shell history, or a committed file.
