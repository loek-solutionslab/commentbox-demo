# CommentBox demo

A small demo site for [CommentBox](https://commentbox.dev). Open the page, click any text and leave a comment. The comment goes to your own CommentBox server, which sends it to your own agent.

The site is a fictional interiors studio, Fieldnote. It is the same example page as on commentbox.dev. The issues and pull requests in this repository were made this way: a comment on the page, filed as an issue by the agent step in `agent/receive.mjs`, then fixed in a pull request. The latest round: the client asks "Can this say Book a call?" on the headline "Book a free visit".

## Run it locally

Needs Node 20.11 or later. Filing issues also needs the [GitHub CLI](https://cli.github.com) (`gh`), logged in.

```bash
npm install
cp .env.example .env   # fill in WEBHOOK_SECRET and ADMIN_TOKEN
npm run server         # CommentBox server on http://localhost:8787
npm run site           # the site on http://localhost:3000
npm run agent          # the agent step on http://localhost:8790/hooks/commentbox
```

Then open http://localhost:3000, click the headline and send a comment. Set `AGENT_DRY_RUN=1` in `.env` to print the issue instead of filing it.

## What is in here

- `index.html`, `styles.css`: the site. The widget script tag was added by `npx @commentbox/cli init`.
- `commentbox/`: the Cloudflare Worker scaffold from the same command. Not needed for the local run.
- `scripts/server.mjs`: runs [`@commentbox/server-node`](https://www.npmjs.com/package/@commentbox/server-node) with local defaults.
- `agent/receive.mjs`: verifies the signed webhook, saves the screenshot, opens a GitHub issue and marks the comment as in progress.

## Links

- CommentBox: https://commentbox.dev
- Solutions Lab: https://solutionslab.net

MIT licensed.

via CommentBox, by [Solutions Lab](https://solutionslab.net)
