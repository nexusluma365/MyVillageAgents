# AI Agent Village — React Three Fiber Edition

A 3D isometric AI Village. Aria is the head agent and the only user-facing
contact: user requests go to Aria, Aria routes specialist work behind the
scenes, specialists report back to Aria, and Aria owns summaries and approval
requests.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle (verified — builds clean, ~280KB gz)
```

Node 18+ recommended.

## Deploying

This project is ready for Netlify and Vercel:

- Build command: `npm run build`
- Publish directory: `dist`
- Netlify Functions directory: `netlify/functions`
- Vercel API route: `api/aria-router.js`
- Vercel SPA rewrites/security headers: `vercel.json`
- Netlify server Basic Auth: `public/_headers`
- Vercel/app login gate: `src/ui/AuthGate.jsx`

Login:

- Username: `Admin`
- Password: `Millionaire1@`

Ask Aria uses the same-origin endpoint at `/api/aria-router`. On Vercel, that
is `api/aria-router.js`. On Netlify, `netlify.toml` redirects it to the
Netlify Function. The function proxies the production n8n webhook from the
server so the browser does not hit n8n CORS limits.

## Aria routing model

- **Aria is the single point of contact.** Click Aria to create a request.
- **Specialists are private workers.** Clicking Marketing, Conversion,
  Website / Developer, or Listings only shows safe status: idle/working/
  waiting/completed, current task, and last sanitized result.
- **Specialists never alert the owner directly.** Their completion/error
  notices are routed through Aria.
- **Approvals are owned by Aria.** The Activity panel has an Approvals tab.
  Website/developer changes and backend-declared changes create pending
  approvals. Approval execution is blocked unless you approve.
- **No live website change runs without approval.** Approving posts the
  approval payload to the configured execution endpoint.

## Business event notifications

The frontend can now accept backend-originated business events and present them
as ARIA notifications in the Activity system:

```json
{ "eventId": "unique-id", "event": "new_lead", "message": "Hey Boss, a new lead just came in.", "timestamp": "..." }
```

```json
{ "eventId": "unique-id", "event": "new_sale", "message": "Congratulations Boss! You have a new sale!", "amount": 10, "timestamp": "..." }
```

`eventId` is optional, but when provided the frontend uses it to prevent
duplicate Activity entries and duplicate sale-sound playback. Sale events try
to play `/sounds/new-sale.mp3` once. Add an original, licensed audio file at
`public/sounds/new-sale.mp3`; missing or browser-blocked audio fails quietly.

This is only the safe frontend foundation for push. A real push backend still
needs to create browser Push subscriptions and deliver authenticated Web Push
payloads from n8n/server-side code. No private keys or payment credentials are
stored in browser JavaScript.

## Backend connection status

Fully connected in this repo:

- 3D village UI, selection, status panels, Activity tabs, toasts, and Aria
  alerts.
- Central Aria request entry point.
- Same-origin ARIA proxy to the production n8n webhook. Aria/n8n decides which
  specialist should work; the frontend only sends the owner request and
  optional route hint.
- Private specialist status views with sensitive request/result data hidden.
- Pending approval queue owned by Aria.
- Existing rental qualification handoff through `VITE_ARIA_HANDOFF_URL`.

Requires your real backend URLs:

- Specialist execution endpoints. Without these, specialist work fails with a
  configuration error instead of generating fake output.
- `VITE_APPROVAL_EXECUTION_URL` or a per-result `executionEndpoint` from a
  specialist backend to apply approved live changes.

## Environment variables

Create a `.env.local` file for local development:

```bash
# Ask Aria uses /api/aria-router by default.
# Leave VITE_ARIA_ROUTER_URL unset for Netlify and Vercel deploys.

VITE_ARIA_HANDOFF_URL=https://your-backend.example.com/aria/rental-qualification

VITE_MARKETING_AGENT_URL=https://your-backend.example.com/agents/marketing
VITE_CONVERSION_AGENT_URL=https://your-backend.example.com/agents/conversion
VITE_WEBSITE_AGENT_URL=https://your-backend.example.com/agents/website
VITE_LISTINGS_AGENT_URL=https://your-backend.example.com/agents/listings

# Optional fallback for specialists without their own URL.
VITE_SPECIALIST_AGENT_URL=https://your-backend.example.com/agents/run

# Used when a specialist result does not return its own executionEndpoint.
VITE_APPROVAL_EXECUTION_URL=https://your-backend.example.com/approvals/execute
```

Specialist endpoints should accept JSON shaped like:

```json
{
  "agentId": "automation",
  "specialist": "Website / Developer",
  "taskType": "aria_specialist_task",
  "title": "Website / Developer Work",
  "parameters": {
    "instructions": "Owner request text",
    "routedBy": "Aria",
    "delegatedBy": "Aria"
  }
}
```

They should return JSON with at least one readable summary field, for example:

```json
{
  "success": true,
  "summary": "Prepared a homepage copy update.",
  "publicSummary": "Homepage copy update ready.",
  "requiresApproval": true,
  "approvalQuestion": "The team recommends publishing this homepage update. Approve or reject?",
  "proposedChange": "Replace the hero copy with the approved text.",
  "executionEndpoint": "https://your-backend.example.com/approvals/execute",
  "changePayload": {
    "changeId": "change_123"
  }
}
```

## Honest scope note on "real 3D assets"

This build could not fetch or license external 3D model files (rigged
`.glb`/`.fbx` humanoids, textured building kits, etc.) — this environment
has no access to asset marketplaces, and doing so would raise the exact
copying concern you asked me to avoid with the reference screenshots.
Instead, every character and building is **genuine 3D geometry** —
real meshes, real depth, real lighting/shadows, not flat sprites — built
procedurally from primitives (capsules, cones, spheres) and shaded per
role. This is a deliberate, original art direction, not a placeholder.

If you later want to swap in bespoke sculpted/rigged models, the seam is
`src/three/characters/Character.jsx` and `src/three/village/Buildings.jsx`:
replace the primitive `<mesh>` trees inside each with `useGLTF()` calls and
the animation/status logic around them keeps working unchanged, since it
already drives everything from plain state (`status`, `motion.walkPhase`,
`buildingGlow`) rather than from the geometry itself.

## Architecture

```
src/
  domain/          <- agent identities, backend providers, routing helpers
    agentsConfig.js    AGENTS_CONFIG, STAGE_LABELS, STATUS_COLORS
    nodes.js           navigation graph + pathfinding (routeBetween, etc.)
    eventBus.js         EventBus pub/sub
    ariaRouter.js       Aria/head-agent routing and approval helpers
    realAriaProvider.js live Aria router + rental qualification calls
    realSpecialistProvider.js live specialist backend calls
    historyStore.js      localStorage task history

  store/            <- glue layer and Aria-owned orchestration
    motion.js           per-agent {pos, walkPhase, facingLeft} —
                         deliberately kept OUTSIDE React/zustand so 60fps
                         position updates never trigger a re-render
    AgentRuntime.js      moveTo/idle-cycle/assign/onTaskDone state machine,
                         with specialist reports redirected to Aria
    useVillageStore.js   zustand store: reactive UI state (status, panels,
                         toasts, activity feed), Aria request router,
                         private specialist status, and approvals

  three/            <- the new rendering layer
    Scene.jsx            Canvas, lights, fog, composition root
    CameraRig.jsx        isometric orthographic "game camera": drag-to-pan,
                         wheel-to-zoom, click-empty-space-to-deselect
    characters/
      Character.jsx       procedural agent mesh; reads `motion` every frame
                         for position/walk-cycle, reads store `status` for
                         event-driven pose changes (idle bob / work fidget /
                         error tremor), shows name tag + speech bubble via
                         drei's <Html>
      characterParts.jsx  per-role hat + carried tool (quill, book, visor,
                         wrench, banner) so all five silhouettes read
                         differently at a glance
    village/
      Ground.jsx, Pond.jsx, ForestBorder.jsx, Buildings.jsx, Decor.jsx
      — five distinct role buildings with an emissive window-glow tied to
      `buildingGlow[agentId]`, a shader-animated pond, an instanced forest
      ring, benches/lamps/gardens/well
    effects/
      Ambient.jsx          birds circling, butterflies over the flower beds,
                         fireflies over the pond — all instanced, all
                         useFrame-driven, no physics/textures needed
      Beams.jsx            the collaboration/handoff visual: a traveling
                         light arcs from Aria's building to a specialist

  ui/               <- HTML overlay
    TopBar.jsx, Legend.jsx, ZoomControls.jsx, Toasts.jsx
    TaskMenu.jsx          Aria-only request assignment
    DetailPanel.jsx       Aria detail/history plus specialist-safe status
    ActivityPanel.jsx     Active / Approvals / Completed / Errors tabs

  App.jsx, main.jsx, styles.css
```

## What's event-driven vs. per-frame

- **Per-frame (useFrame, no React re-render):** agent position, walk-cycle
  limb rotation, idle bob/sway, camera lerp, bird/butterfly/firefly motion,
  pond shader ripple, building glow pulse.
- **Event-driven (bus + zustand, triggers a re-render where it matters):**
  task assigned/started/progress/completed/failed, status transitions,
  building glow on/off, delegation beams, toasts, history writes, approvals,
  panel open/close.

This split is why five agents, ambient wildlife, and a live pond can all
animate at once without frame drops — nothing that moves every frame lives
in React state.

## Known simplifications vs. the original 2D build

- Floating panels (task menu / detail panel) are docked to a fixed screen
  position rather than following the clicked character's exact screen
  projection — simpler and works better once the camera can orbit/zoom in
  3D. Selection is still shown with a ring under the character itself.
- Touch pinch-to-zoom isn't wired up yet (mouse-wheel and click-drag are);
  it's a small addition to `CameraRig.jsx` following the same pattern as
  the wheel handler.
- Specialist execution requires real backend URLs. Missing URLs produce clear
  configuration errors rather than fake specialist output.
