# Automated Conformance Testing — Interim Project

## Scope included in this ZIP
This is the interim-stage implementation described in the progress report: **TC01–TC08 only**, with three variants per family (D1, D2 and C), giving **24 variants**. It contains the SPA test bed, DOM evaluator, Chromium Accessibility Tree evaluator, Playwright runner and axe-core as a separate reference scanner.

TC09–TC15, the supplementary interaction-assisted Accessibility Tree evaluator, and the wider dynamic-scenario experiments are deliberately excluded from this interim package. The Accessibility Tree evaluator reports TC08 keyboard operability as NOT_TESTABLE because a static Accessibility Tree snapshot cannot establish keyboard reachability or activation.

## Requirements
- Node.js (LTS recommended)
- npm
- Playwright Chromium browser

## Setup (Windows PowerShell)
```powershell
npm install
npx playwright install chromium
npm start
```
Open http://localhost:3000. The dashboard lists the eight interim test families and their 24 variants.

## Run the interim experiment
Keep the application running in one terminal. In a second terminal, from this project folder, run:
```powershell
npm run experiment
```
The default is five repetitions. To change it for a diagnostic run only:
```powershell
$env:EXPERIMENT_REPETITIONS=1
npm run experiment
```
The runner creates timestamped JSON, CSV and summary JSON files under `results/`. With five repetitions, it is designed to produce 120 DOM records, 120 Accessibility Tree records and 120 axe-core reference records (360 total).

## Run tests
```powershell
npm test
```

## Important interpretation
- D1/D2/C are fixture intentions, not automatically verified ground truth.
- Do not change `UNVERIFIED` to `VERIFIED` until each expected label has been independently reviewed and evidence recorded.
- Five repetitions demonstrate repeatability, not correctness of expected labels.
- axe-core is a separate reference scanner, not ground truth and not one of the two primary engines.
- This application checks selected conditions only; it does not certify complete WCAG 2.2 conformance.
- TC08 requires real keyboard interaction evidence. A static AX snapshot cannot prove keyboard operability.

## Main structure
```text
src/data/cases.js                 Interim register: TC01-TC08
src/engines/dom.js                DOM evaluator
src/engines/accessibility-tree.js Chromium CDP Accessibility Tree evaluator
src/runner/run.js                 Five-repeat Playwright experiment
src/server.js                     Express application
views/                            Handlebars pages
public/                            CSS and client-side behaviour
test/                              Interim scope and AX engine tests
results/                           Generated experiment outputs
```
