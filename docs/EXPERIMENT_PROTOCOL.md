# Experiment protocol and evidence checklist

## Paired execution

Each of the 45 registered variants is evaluated by the DOM and Accessibility Tree engines in five independent repetitions (450 paired-engine evaluation records). axe-core is executed as a separate reference scan and is not counted as either experimental engine. The runner also executes the SPA route-change, modal-dialog and visibility-change scenarios five times each and stores their outcomes separately. Status-message and widget-state scenarios are exercised through TC14 and TC11/TC12 respectively in every repetition.

For each case variant, the runner loads the same route in the same Chromium context with a fixed viewport and locale. It resets the fixture, performs the registered interaction sequence and then invokes the DOM and Accessibility Tree engines independently. Each engine run is separately prepared from the same deterministic initial state. Evidence is captured by the relevant engine only.

## Outcome definitions

- **PASS:** no violation was found for the specific automated condition implemented by that rule.
- **FAIL:** the engine found evidence meeting the rule's defined failure condition.
- **NOT_TESTABLE:** evidence was unavailable, ambiguous, unsupported or outside the engine's valid assessment capability.

NOT_TESTABLE is not a successful result and is excluded from classification metrics. It is included in coverage reporting.

## Before experimental scoring

- Confirm each scenario tests one intended condition and does not accidentally introduce unrelated failures.
- Verify the exact WCAG 2.2 success criterion mapping and expected outcome independently.
- Test keyboard operation and rendered behaviour; perform screen-reader checks where feasible.
- Record evidence and reviewer/date in `ground-truth-register.json`.
- Confirm each engine's evidence is confined to its designated source. Cases classified `DOM_ONLY` (keyboard operability and focus order) are expected to return `NOT_TESTABLE` from the Accessibility Tree engine; this is a declared evidence limitation, not a reason to substitute DOM inspection. The Accessibility Tree engine may use CDP backend-node identity solely to bind the intended fixture target to its AX node; all classification evidence must remain AX roles, names and properties. If Chromium does not expose a relevant property in the captured tree, record NOT_TESTABLE rather than reading the DOM.
- Review all five repetitions and inspect unstable results and NOT_TESTABLE reasons. Verify the route-change scenario separately.
- Preserve raw run JSON/CSV and do not overwrite previous runs.

## Reporting

Report denominators with every percentage. Agreement must use the jointly testable cases and must not be described as accuracy. Precision, recall and F1 require verified ground truth. Report coverage separately. Limit conclusions to these 45 fixture variants, implemented rules, browser version and controlled conditions.


## Dynamic scenario coverage

- S1 Route change: repeated separately five times; records route, title and focus movement to the new view heading for DOM and Accessibility Tree evidence.
- S2 Modal dialog: repeated separately five times; checks dialog naming, focus entry and focus restoration after Escape.
- S3 Status message: represented by TC14 D1/D2/C after the scripted form submission, with five repetitions.
- S4 Widget state: represented by TC11 (tab selected state) and TC12 (disclosure expanded state), each with D1/D2/C and five repetitions.
- S5 Visibility change: separately hides and restores an informative image, checking rendered visibility through DOM and exposure through the Chromium Accessibility Tree, five times.

The route, modal and visibility scenario outputs are saved in separate JSON files. Status and widget outcomes remain in the main case-level JSON/CSV with their scenario interactions recorded.
