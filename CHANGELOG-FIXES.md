# Baseline-run fixes (1.0.1)

Reviewed against the user's 7 November 2026 run JSON. The original run completed all 90 records, but the Accessibility Tree engine contained target-selection and evidence-interpretation defects.

## Corrected

- Button and link rules now bind to the intended fixture element using CDP backend-node identity. An unrelated named button/link elsewhere on the SPA can no longer make an unnamed target pass.
- Input-label evaluation now rejects empty accessible names and placeholder-only names. A placeholder is not treated as a persistent programmatic label.
- Table-header evaluation is scoped to descendants of the target table.
- Tab, disclosure, dialog, iframe and status checks are scoped to their fixture targets.
- The document-language rule now returns NOT_TESTABLE in the Accessibility Tree engine when the captured Chromium AX tree does not expose the authored language property. It does not fall back to DOM inspection.
- Added regression tests for target matching, placeholder-only names and the language limitation.

## Validation performed in this environment

- `node --check` passed for the modified runner and Accessibility Tree engine.
- `node --test test/*.test.js`: 9 tests passed, 0 failed.
- A complete browser experiment was not run here because this environment does not have the project's npm dependencies installed. Run `npm install`, `npx playwright install chromium`, and then execute a fresh run locally.

The original JSON remains an immutable baseline. Do not edit its observed outcomes. Compare a new run against it after running this updated version.

## Version 1.0.2 — target scoping and analysis integrity

- Scoped Accessibility Tree heading and list checks to the exact fixture target. Unrelated page headings or navigation lists can no longer create false PASS results.
- The list check now requires a fixture AX `list` node with at least one AX `listitem`; a presentational list that is absent from the AX tree fails the semantic check.
- Strengthened DOM input labelling: `aria-labelledby` must resolve to at least one existing non-empty referenced element; wrapping labels are also recognised.
- Expanded analysis output with per-engine PASS/FAIL/NOT_TESTABLE counts and an explicit list of non-comparable case variants.
- Kept TC07 (document language) and TC15 (authored ID uniqueness) as Accessibility Tree NOT_TESTABLE because the captured AX tree does not reliably expose those authored DOM properties. These are coverage limitations, not forced FAIL outcomes.
- Ground truth remains UNVERIFIED. No accuracy, precision, recall or F1 claim is authorised until independent manual verification is recorded in the ground-truth register.

## Version 1.1.0 — proposal alignment and repeated experiment

- Replaced TC07 Page Language (WCAG 3.1.1, outside the proposal's selected criteria) with Label in Name (WCAG 2.5.3).
- Replaced TC08 Frame Title and TC15 Unique IDs with bounded Keyboard Operability (WCAG 2.1.1) and Focus Order (WCAG 2.4.3), so the register covers all nine criteria named in the proposal.
- Added `detectionClass` to every case. Keyboard operability and focus order are DOM-only; the Accessibility Tree engine explicitly reports NOT_TESTABLE for these cases rather than inferring keyboard behaviour from AX node order.
- Added five repetitions per case and a strict-majority aggregation in the analysis script. Cases without a strict majority are marked INCONSISTENT.
- Added axe-core as a separate off-the-shelf reference (225 scans across five repetitions), not as a third research engine or ground truth.
- Added five-repeat SPA route-change and modal-dialog scenario checks. The SPA now moves focus to the new route heading after navigation.
- Expanded result exports and download endpoints for route-change and modal scenario JSON.
- Rebuilt the ground-truth register for the revised 45 cases; every label remains UNVERIFIED pending manual evidence and peer review.
- Added regression tests for the nine-criterion mapping and declared detection classes.


## TC08 / TC15 browser-interaction correction

- Replaced TC08's programmatic `element.focus()` check with real sequential Tab navigation, followed by Enter and Space activation checks. This catches a native button with `tabindex=-1` that cannot be reached through Tab, and a `role=button` div that has no keyboard activation handler.
- Replaced TC15's static `tabindex` sorting inference with actual Chromium Tab-key traversal and captured focus sequence.
- Added six Playwright browser regression tests covering D1, D2 and C for both test families.
- The Accessibility Tree engine continues to report the six corresponding checks as `NOT_TESTABLE`, correctly preserving the boundary between accessibility-tree structure and interactive keyboard behaviour.


## 1.1.1 – Dynamic visibility scenario coverage

- Added S5 visibility-change execution: the runner captures DOM computed visibility and Chromium Accessibility Tree exposure before hiding, while hidden, and after restoring an informative image.
- Added a dedicated `*-visibility-scenarios.json` output and download endpoint/UI link.
- Added explicit run-summary coverage counts for all five required dynamic scenarios; form-status and widget-state evidence is counted from TC14 and TC11/TC12.
- Added contract tests to prevent the required five-scenario coverage and visibility download from being omitted.
- Ground-truth labels remain UNVERIFIED until independent manual review; this change does not relabel provisional outcomes.


## 2026-11-07 — S1 route-change title assertion correction
- Corrected the DOM route-change assertion to compare against the actual rendered document title (`TC01-D1 · Conformance Testing Lab`).
- The previous assertion expected `TC01-D1` without the application title suffix, causing a false DOM FAIL even when SPA navigation and heading focus worked.
- Added a regression test tying the runner expectation to the layout title template.
- No experimental engine logic, fixture behaviour, ground-truth labels, or existing modal/visibility checks were changed.


## Final summary correction
- Corrected the summary `outcomes` field to count only the two experimental engines (DOM and Accessibility Tree). axe-core reference counts remain in the separate `axeCoreOutcomes` field. This prevents misleading zero counts for a reference engine intentionally excluded from `experimentalRecords`.


## 2026-11-08 — Supplementary interaction-assisted Accessibility Tree evaluation
- Added a separate hybrid evaluator for TC08 keyboard operability and TC15 focus order.
- Playwright supplies actual keyboard interaction evidence; CDP `Accessibility.getFullAXTree` supplies semantic-node corroboration for the focused fixture controls.
- Added a separate five-repeat runner, JSON/summary outputs, and six focused browser regression tests.
- Preserved the baseline Accessibility Tree engine's `NOT_TESTABLE` outcomes and the original experiment files. Supplementary results must not be merged into baseline agreement or described as pure Accessibility Tree results.
- Runtime execution remains pending dependency installation and a fresh browser run; syntax checks alone do not establish runtime correctness.
