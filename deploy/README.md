# Deploying

The live site is published from the `gh-pages` branch, which holds the built
output of `npm run build:pages -- night-shield`.

`github-pages-workflow.yml` is the GitHub Actions version of the same thing —
it rebuilds and redeploys on every push to `main`. It is parked here rather
than in `.github/workflows/` because the token used for the first push did not
carry the `workflow` scope. To switch to automatic deploys:

1. `gh auth refresh -s workflow`
2. `mkdir -p .github/workflows && git mv deploy/github-pages-workflow.yml .github/workflows/deploy.yml`
3. Commit, push, then set Settings → Pages → Source to "GitHub Actions".
