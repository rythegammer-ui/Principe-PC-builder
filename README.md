# Principe Computers

A bench for the PCs you are building, and a way to turn a pasted customer thread into a build prompt.

Jobs stay in this browser. Export the bench if you want a copy.

## The bench

Each build is a ticket. Drag it across the board as it moves from inquiry to parts, the bench, testing, and out the door. Open a ticket to log the quote, deposit, labor, and every part as it is ordered, arrives, and gets installed.

## From a thread

Paste the texts between you and the customer. The reader pulls out budget, games, resolution, brands, what they already own, and what is still unsaid. It writes two things:

- a short text you can send back
- a build prompt you can paste into the model you use to pick parts

The prompt keeps their wording, refuses invented preferences, and asks for a parts list, a compatibility pass, and bench notes. Put the thread on the bench when the job is real.

## Run it

```bash
npm install
npm test
npm run dev
```

Open the local URL Vite prints. `npm run build` writes a static site to `dist/`.
