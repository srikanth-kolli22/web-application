# Submission Validation Note

## Project baseline
This package implements the Node.js, Express, Handlebars and Playwright architecture. The two experimental engines are the DOM engine and the Chromium Accessibility Tree engine. The latter obtains the full tree through the Chrome DevTools Protocol method `Accessibility.getFullAXTree`.

## Included scope
- 15 test families and 45 variants (D1, D2 and C).
- DOM and Accessibility Tree evaluation engines.
- Five-repeat paired experiment runner.
- JSON and CSV result export.
- Separate axe-core reference scans (not counted as a third experimental engine).
- Ground-truth verification register.
- Regression tests for register integrity, target scoping and declared Accessibility Tree limitations.

## Keyboard and focus-order correction
TC08 and TC15 are now evaluated by the DOM/Playwright engine using actual Chromium keyboard input. TC08 checks sequential Tab reachability and Enter/Space activation. TC15 records the actual sequence produced by repeated Tab presses. Six browser regression tests have been added for the D1, D2 and C variants of both families.

The Accessibility Tree engine still reports the six related AX evaluations as `NOT_TESTABLE`; this is intentional because a static AX tree cannot establish keyboard operation or sequential focus order. Do not recode those AX results as PASS or FAIL.

## Validation status
The Node regression suite was executed with Node.js v22.16.0 and Chromium: **22 tests passed, 0 failed, 0 skipped**. This includes six browser-based Playwright regression tests for TC08 and TC15. Observed fixture outcomes were TC08-D1 FAIL (not reachable by Tab), TC08-D2 FAIL (reachable, but Enter/Space did not activate), TC08-C PASS; TC15-D1 FAIL (Step 2 → Step 1 → Step 3), TC15-D2 FAIL (Step 1 → Step 3 → Step 2), and TC15-C PASS (Step 1 → Step 2 → Step 3).

A complete five-repeat run through the Express dashboard was not executed in this build environment because the Express/Handlebars/axe-core application dependencies were unavailable after the dependency installation attempt timed out. The regression suite validates the engines' targeted logic, but does not substitute for running the complete application on the submission machine.

These are software/fixture checks. They do not prove that all WCAG interpretations or provisional expected labels are correct. Ground truth remains independently unverified.

## Required before reporting validated accuracy
The 45 expected labels in `docs/ground-truth-register.json` remain provisional and have `UNVERIFIED` status. A reviewer must independently inspect each variant, record the verification method and evidence, and set the verified label before precision, recall or F1 can be treated as validated. Do not represent provisional labels as independently verified ground truth.

## Runtime setup
From this directory, run:

```bash
npm install
npx playwright install chromium
npm test
npm start
```

Open `http://localhost:3000`, then run the five-repeat experiment from the dashboard or with `npm run experiment`.

## Interpretation
A successful test run demonstrates that the software executed. It does not, by itself, demonstrate full WCAG 2.2 conformance, screen-reader behaviour, or validated experimental accuracy. Keyboard operation and focus order are explicitly marked `NOT_TESTABLE` by the Accessibility Tree engine because a static accessibility-tree representation cannot establish actual keyboard operation or sequential focus order.


## Supplementary interaction-assisted AX evaluator (2026-11-08)

A separate evaluator and runner have been added for TC08 and TC15. It combines Playwright keyboard interaction with Chromium Accessibility Tree node corroboration. The original baseline engine still returns NOT_TESTABLE for these cases; no previous run files or baseline classifications have been changed.

Validation performed for this addition in the preparation environment:
- `node --check` passed for the new evaluator, runner and browser regression test files.
- Two dependency-free unit tests passed for Accessibility Tree node summarisation and CDP backend-node matching.
- The six browser-based interaction regression tests were added but could not be executed here because Playwright was not installed and npm dependency installation timed out.
- A new five-repeat supplementary experiment has not yet been run. Execute `npm install`, `npx playwright install chromium`, `npm test`, and `npm run experiment:ax-interaction` on the submission machine.

The supplementary method is hybrid: Playwright determines actual keyboard behaviour, while the Accessibility Tree confirms the browser-exposed semantic identity of the focused controls. Do not describe its outcomes as coming from the Accessibility Tree alone, and do not merge them into the baseline paired-engine agreement calculations.
