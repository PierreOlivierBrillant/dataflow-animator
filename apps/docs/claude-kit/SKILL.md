---
name: dataflow-animator
description: Creates step-by-step animated diagrams with DataFlow Animator, a library that turns a JSON spec into a scrubbable animation: requests and packets travelling between clients, servers and databases, network and security protocols (TLS, OAuth, DNS, Diffie-Hellman), system architectures, algorithms on binary trees and graphs (BST, AVL, red-black, Dijkstra, A*, spanning trees), and electrical or logic circuits with flowing current. Use it whenever the user asks to animate, illustrate step by step, or visualize a data flow, protocol, architecture, algorithm or circuit, mentions DataFlow Animator or its spec, or shares a DataFlow Animator playground link. Produces a validated spec and a link that opens it in the online playground.
---

# DataFlow Animator

You write a **DataFlow Animator spec** (JSON), validate it with the bundled
script, and hand the user a **playground link** that plays it. Everything you
need is in this folder.

| Path                          | Read it                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `reference/guide.md`          | ALWAYS, before writing: the model, the layouts, the common mistakes |
| `reference/types.md`          | To look up a field — every field of the spec, from the JSON Schema  |
| `reference/pins.md`           | For circuits: the `"node:pin"` terminal names of every component    |
| `examples/INDEX.md`           | To pick 1–2 examples close to the request                           |
| `examples/<id>.json`          | Real gallery specs; copy their idioms                               |
| `scripts/validate.mjs`        | Validates a spec (schema + references + terminals)                  |
| `scripts/playground-link.mjs` | Spec → playground link, and link → spec (`--decode`)                |

## Workflow

1. **Understand the request.** If the subject is clear, do not ask questions:
   choose sensible actors and steps yourself. Ask only when a choice changes the
   whole animation (e.g. which protocol version, which algorithm).
2. **Read `reference/guide.md`.** Then open `examples/INDEX.md` and read the one
   or two examples with the same `direction` and similar actions.
3. **Plan the steps in plain sentences** (4–12 root steps, one idea each), then
   write the spec to a file, e.g. `animation.json`. Fill `description`. Write
   every visible string in the user's language.
4. **Validate and fix until clean:**

   ```bash
   node scripts/validate.mjs animation.json
   ```

   Fix every `✗` error (each one says where and usually suggests the right
   value). Read the `⚠` warnings: they are usually real mistakes (a packet never
   moved, coordinates that will be ignored).

5. **Make the link:**

   ```bash
   node scripts/playground-link.mjs animation.json
   ```

6. **Answer** with: a short outline of the steps, the playground link (as a
   Markdown link), and the spec — as a downloadable file when you can create
   files, otherwise in a ```json block. Mention that the playground lets them
   scrub, step through, edit the JSON live and export a video.

When the user shares a playground link (`…/playground/#spec=…`), decode it with
`node scripts/playground-link.mjs --decode "<link>"`, apply their changes,
validate, and return a new link.

## Running the scripts

The scripts need Node.js 18+ and nothing else (no install, no network). Paths
are relative to this skill's folder — `cd` into it, or prefix the paths. If no
code execution is available, still follow the guide, check the spec against
`reference/types.md` yourself, and tell the user to paste the JSON into the
playground at https://pierreolivierbrillant.github.io/dataflow-animator/playground/
(it validates as they paste).

## Quality bar

- The animation explains something: each step's change is visible AND narrated
  (a `comment`, or a packet whose text says what it is).
- Labels are short; panels and packets hold a few lines, not paragraphs.
- No `duration` unless it is a deliberate effect — the engine derives reading
  and travel times; use `pace` to slow the whole thing down.
- Persistent changes (`set_color`, `set_icon`, `set_visible`) show the state the
  story has reached, so a paused frame is self-explanatory.
