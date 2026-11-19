# creator-links

A small, community-maintained dataset that connects a creator on Kemono, Coomer or Pawchive to the same person on other sites: the E-Hentai artist or group tag, the Pixiv profile. The [Kemono & Pawchive Download Button](https://github.com/bropines/kemono-download-button) userscript reads it (module `creators.xlinks`) and shows the links on creator pages. Anything else can use it too.

The data is public handles of public creators, nothing more. No user data is collected anywhere.

## What is in here

```
data/<service>.json   source of truth, one file per service (fanbox, patreon, ...)
index.json            generated, compact; this is what the userscript downloads
scripts/              validate.mjs, build-index.mjs, issue-to-pr.mjs (Node 20+, no dependencies)
```

`data/fanbox.json`:

```json
{
  "286217": {
    "name": "fuyuki007",
    "links": [
      { "site": "e-hentai", "type": "artist", "value": "nanahara fuyuki", "confirmations": 1, "added": "2026-11-19" },
      { "site": "pixiv", "value": "286217", "confirmations": 1, "added": "2026-11-19" }
    ]
  }
}
```

- Keys are the creator ids as they appear in the Kemono URL (`/fanbox/user/286217`), sorted.
- `site` is `e-hentai` (with `type` `artist` or `group`, `value` = the tag text in lowercase, without the namespace and quotes) or `pixiv` (`value` = numeric user id).
- `confirmations` counts independent reports; `added` is the date of the first one.
- Links are sorted by site, type, value. Files use 2-space JSON and end with a newline. `node scripts/validate.mjs` checks all of it, so run it before opening a pull request.
- A Fanbox creator id is also the Pixiv user id, so the userscript shows a Pixiv chip for every Fanbox creator without needing an entry here.

`index.json` is `{ "version": N, "updated": "YYYY-MM-DD", "creators": { "fanbox:286217": [["e-hentai","artist","nanahara fuyuki"],["pixiv","","286217"]] } }`. `version` increases whenever the creators change. Do not edit it by hand: the `Build index` workflow rebuilds it after every merge to `main`.

## How to contribute

1. **Issue form (easiest).** Open [Add a link](../../issues/new?template=add-link.yml) (the userscript has a "Suggest a link" button that prefills it). A workflow turns the issue into a pull request, which a maintainer reviews against the evidence you give.
2. **Pull request.** Edit `data/<service>.json`, run `node scripts/validate.mjs`, and open a PR. The `Validate` workflow runs the same checks.

Please only add a link when you are sure both accounts belong to the same person, and give evidence (a profile that links to both, an artist database entry, a post). Wrong links get reverted; a link nobody can verify may be removed.

### For maintainers

- Create the issue label `add-link` (the form applies it, the workflow looks for it).
- Enable Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests", so `issue-to-pr.yml` can open pull requests.
- Pull requests created by `GITHUB_TOKEN` do not start other workflows; `issue-to-pr.yml` runs `scripts/validate.mjs` itself before opening one.
- Protect `main` and require the `Validate` check on human pull requests.

## Licence

The data is dedicated to the public domain under [CC0 1.0 Universal](LICENSE). The scripts are released under the same terms. By contributing you agree to this.

## Removal and opt-out

If you are a creator listed here and want a link or your whole entry removed, open an issue titled "Removal request" with the creator URL and what to remove, or open a pull request that deletes it. Requests from the creator (or someone who can show they act for them) are honoured without discussion. Reports of wrong links work the same way.
