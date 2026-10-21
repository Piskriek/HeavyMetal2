# Prompt: working with Argon (Gemini) and the Codex fallback

Paste everything below the line into the Claude session for the other game.

---

You have about 25% of this week's Claude usage left, so treat it as scarce. Your job is to set up **Argon** (Google Gemini) as a second engineer and creative partner on this game, so that the work keeps going when you and the Haiku sidecars are out of usage. When you are out, Argon writes self-contained task packages that the owner gives to a **Codex agent on arena.ai** (Agent mode), which implements them and opens pull requests.

Spend your usage on three things only:
- setting up Argon well;
- architecture and glue;
- reviewing what comes back.

Delegate the bulk code.

## 1. What Argon is and how to reach him
- **Where:** gemini.google.com, signed in on the owner's Google account in your built-in browser pane.
- **The model:** pick **"Argon"** ("4 Argon, complex tasks") in the model picker beside the send arrow, not "Flash". Argon runs in Task mode: he plans, runs code in his own sandbox, reads and writes the owner's Google Drive, and works for minutes at a time.
- **Use one chat per game.** Start a fresh chat for this game (the owner's other chat belongs to the other project). A chat that grows very long stops loading or answers blank. When that happens, write a handoff file and start a new chat seeded with it.
- **His limits:**
  - He has his own usage limit. When it hits, the page says "You've reached your current usage limit ... available again at HH:MM". Note the time and plan around it.
  - His sandbox **cannot reach GitHub** (private or not). He reads only what is in the Drive folder or pasted in chat.
- **How to type to him (the browser quirks are real):**
  - **Type only into `rich-textarea .ql-editor`.** A Gemini Canvas also matches `[contenteditable]`, and text once landed inside a document by mistake.
  - **Wait for the chat to finish loading** (about 15 s) before typing. Text typed during a re-render is lost.
  - **Clear the input first.** Select its contents and delete. A stray "Allow" can be left there after a usage-limit hit; if the input is locked by the limit, it cannot be cleared until the limit resets.
  - **Use the computer `type` action, then press Return.**
  - **Check that it was sent:** the newest `user-query` shows your text and the input is empty. A message that never landed costs a whole round.
- **Reading his reply.** Read the last `model-response` element's `innerText` with JavaScript; it is faster than screenshots. While he works, a Stop button is present. His answer follows "Gemini said".
- **Press Allow (standing permission from the owner).** Gemini pauses on platform confirmations ("Confirmation required ... Skip / Allow"), for example when he moves a file into the shared folder or uses a browser tool. He stalls until someone presses Allow, so check his chat every 15 to 20 minutes while he works.
  - Find the enabled Allow button with JavaScript. A disabled one is a stale confirmation from an earlier turn.
  - Click it with the computer tool. Screenshot coordinates are scaled: `screenshot_x = css_x * (screenshot_width / innerWidth)`.
- **If he answers blank** ("Complete" and an empty "Gemini said"), he is usually waiting for a go-ahead. Ask a short plain-text question, and tell him: "don't wait for a go-ahead within a job I've given you."

## 2. The Drive relay (how files move between you and him)
- **Ask the owner for a link-shared Drive folder for this game** (or create one), and note its id. Everything Argon needs goes there.
- **Uploading to him (the owner has given standing permission to upload anything Argon needs).** Commit and push first, then upload from the folder page with this recipe:
  1. Open the folder page in a **separate tab**. Never navigate the Gemini tab away.
  2. Fetch each file into a `File`. Use raw.githubusercontent at the commit SHA when the repo is public, or the file content itself otherwise.
  3. Patch the file input so Drive's upload takes them:

     ```js
     window.__upl = files; // File[]
     const orig = HTMLInputElement.prototype.click;
     HTMLInputElement.prototype.click = function () {
       if (this.type === 'file') {
         const dt = new DataTransfer(); for (const f of window.__upl) dt.items.add(f);
         this.files = dt.files; this.dispatchEvent(new Event('change', { bubbles: true }));
         HTMLInputElement.prototype.click = orig; return;
       }
       return orig.call(this);
     };
     ```
  4. Front the tab and press `alt+c`, then `u` (Drive's "File upload" shortcut). Clicking New often does nothing in a fresh tab, and synthetic drag and drop is ignored.
  5. Poll the page text for "N uploads complete" (up to 30 s) before leaving. Leaving mid-upload cancels it silently.
  6. Get the new ids from `https://drive.google.com/drive/recent`: read the `[role=row]` and `[data-id]` aria-labels. Search does not index new files at once.
  7. Give Argon the file names **and** ids.
- **Reading his files:**
  - **A file in the link-shared folder:** `curl -sSL "https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t" -o <file>`.
  - **A Google Doc:** `https://docs.google.com/document/d/<id>/export?format=md`.
  - **A file saved in My Drive's root:** he often saves there, because moving a file into the shared folder needs an Allow. Then curl returns a sign-in page, and you move the file yourself:
    1. Search Drive for its name and click its card.
    2. Right-click it: Organise, then Move.
    3. Pick the folder, press Move, and confirm "Change who has access" with Move.
    
    Drive's menus sometimes do not show in screenshots. List the `[role=menuitem]` elements with JavaScript and click their scaled coordinates.
  - **Check downloads:** an HTML page instead of your file means it is not shared yet. Compare an md5 against the original when it matters.

## 3. His bundles, and never trusting a bundle unread
- **Format:** his code arrives as a JSON bundle, `{ "ticket": ..., "description": ..., "files": { "<repo path>": "<content>" } }`, usually with a `oneLineUnpackCommand`. **Never run his unpack command.** It writes straight into the repo. Unpack into a holding folder with a path-checked script:

  ```js
  // unpack.mjs <bundle.json> <destDir>: refuses absolute or escaping paths
  import fs from 'node:fs'; import path from 'node:path';
  const [bundle, dest] = process.argv.slice(2); const root = path.resolve(dest);
  const { files } = JSON.parse(fs.readFileSync(bundle, 'utf8'));
  for (const [p, c] of Object.entries(files)) {
    const out = path.resolve(root, p);
    if (path.isAbsolute(p) || !out.startsWith(root + path.sep)) throw new Error(`refused path ${p}`);
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, c); console.log('wrote', out);
  }
  ```
- **Review before install (the owner's rule: "you guys need to check each other, shortcuts are unacceptable").** His "all tests pass" claims have been wrong before. So:
  1. Copy the files into the working tree.
  2. Run the typecheck and the full tests.
  3. Render the result if it is visual. Use black-box checks where you can: a hash of what existing code produces before and after proves nothing old changed.
  4. Write your review as a note in the folder: what holds, and what to fix, numbered and specific.
  5. Install only what passes. Take the files back out of the working tree when you hold a bundle, so they do not break your typecheck.
- **The cross-check runs both ways.** Have him review your plans and briefs against the owner's words. He catches real things.

## 4. Seed him now, while you still have usage
Write a handoff file for this game into the Drive folder, and start his chat by pointing at it. It should give:
- **The game and the repo:** the repo, the branch, the stack, and how to build and test.
- **The owner's explicit rules for this game,** in his words.
- **The current state and the next jobs,** in order.
- **The task-package template** (section 5).
- **His role.** Here he is the second engineer, the reviewer, and the writer of Codex briefs. On creative calls he decides with you; the owner provides resources and reviews results.
- **The working agreements:** files and ids in every message; bundles as JSON in the folder; plain text; no waiting for go-aheads inside a job; ask for the files he needs by path.

## 5. The fallback: Argon writes, a Codex agent on arena.ai builds and opens the PR
When you and the Haikus are out of usage, the owner runs this loop with Argon:
1. **The owner asks Argon for the next task package** (the "next job" list from your handoff). Argon writes it as a file in the Drive folder.
2. **The owner opens arena.ai in Agent mode**, with the GitHub repo connected (the owner connects it). Agent mode's input is a rich editor: a long *first* message can fail with "Failed to create coding session". So send `hi` first, stop the reply, then paste the package as the follow-up.
3. **The Codex agent implements it on its own branch** (named like `arena/<id>-<repo>`) and opens a pull request. One job takes about 5 minutes.
   - **If it stops at its turn limit** with a "still to do" list, send "continue with your list", and choose "Keep working" when asked.
   - **Never click its rating buttons or "Merge PR".** Merging is the owner's decision after review.
4. **The owner pastes the PR link, the diff summary and the CI or test output back to Argon.** Argon reviews it against the package's acceptance checks and writes a fix-up message. The owner pastes that into the **same** Codex chat, which keeps its context.
5. **The owner merges** only when Argon's review and CI both pass. When Claude is back, review everything merged in the meantime, starting with the tests.

**Every task package Argon writes must be self-contained.** The Codex agent knows nothing else. Each one gives:
- **Repo, base branch and the PR target branch.**
- **The goal, in two or three sentences of plain words:** what the player or owner will see.
- **Files:** the exact paths to create or change, the interfaces and signatures to match, and the files not to touch.
- **Constraints:** the owner's rules for this game, code style (strict types, no new dependencies unless named), and performance limits.
- **Acceptance checks:** the commands to run (typecheck, unit tests, any browser test) and what passing looks like. Include the test code itself where possible.
- **The PR:** its title, and a body listing what changed and how it was tested.
- **Size:** one job per package, small enough for one PR, about 5,000 characters or less.

## 6. Order of work for you now
1. Ask the owner for (or create) the Drive folder, and get Argon's new chat open on Argon.
2. Write and upload the handoff file (section 4), with the task-package template.
3. Give Argon his first real job, either a review of your plan or a bundle to write, so the loop is proven while you can still check it.
4. Keep the "next jobs" list in the handoff current, so the fallback loop always has work queued.
5. Record the Drive folder id, the chat URL and Argon's usage reset times in your resume or notes, so a fresh session can pick them up.
