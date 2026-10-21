# Security

## Reporting

Please do not open a public issue for a security problem. Use GitHub's private
**Report a vulnerability** flow (Security → Advisories) on this repository, or
contact the maintainer listed on the repository profile.

## Scope

This app:

- has no accounts, sessions or database;
- stores only a watchlist and theme preference in `localStorage`;
- reads public NBA data from ESPN and map tiles from OpenStreetMap;
- never stores API keys in source control (`.env.local` is git-ignored).

Relevant classes of issue: server-side request forgery through provider URLs,
XSS in map tooltips or team/player strings rendered from the feed, dependency
vulnerabilities, and accidental exposure of environment variables in the client
bundle.

## Known non-issues

- `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_SITE_URL` are public by design.
- The demo's synthetic data is not a security boundary; it is labelled `Mock`.
