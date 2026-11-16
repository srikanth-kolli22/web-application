'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { version: playwrightVersion } = require('playwright/package.json');
const { version: expressVersion } = require('express/package.json');
// axe-core is declared as a project dependency. Keep its absence from preventing
// the two primary experimental engines from running; record reference scans as
// NOT_TESTABLE and print an actionable installation message instead.
let axeVersion = 'not-installed';
let axeCorePath = null;
try {
  axeVersion = require('axe-core/package.json').version;
  axeCorePath = require.resolve('axe-core');
} catch (_) {
  // Handled per case below so DOM and Accessibility Tree results are preserved.
}
const { cases } = require('../data/cases');
const { evaluateDOM } = require('../engines/dom');
const { evaluateAccessibilityTree } = require('../engines/accessibility-tree');

const ROOT = path.resolve(__dirname,'../..');
const RESULTS = path.join(ROOT,'results');
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPETITIONS = Number(process.env.EXPERIMENT_REPETITIONS || 5);

async function waitForServer(child) {
  for (let i=0;i<60;i++) {
    try { const r=await fetch(`${BASE_URL}/health`); if(r.ok) return; } catch {}
    if(child && child.exitCode !== null) throw new Error(`Application server exited with code ${child.exitCode}`);
    await new Promise(r=>setTimeout(r,250));
  }
  throw new Error('Timed out waiting for the Express application.');
}
async function startServerIfNeeded() {
  try { const r=await fetch(`${BASE_URL}/health`); if(r.ok) return null; } catch {}
  const child=spawn(process.execPath,[path.join(ROOT,'src/server.js')],{cwd:ROOT,env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
  await waitForServer(child); return child;
}
async function prepare(page,item) {
  await page.goto(`${BASE_URL}/test/${item.caseId}`,{waitUntil:'domcontentloaded'});
  await page.locator('#fixture').waitFor({state:'visible'});
  for(const step of item.interaction || []) {
    const match=step.match(/^click:(.+)$/);
    if(match) {
      await page.locator(match[1]).click();
      await page.waitForFunction(({check}) => {
        if(check==='tab-state') return !!document.querySelector('#panel-two') && !document.querySelector('#panel-two').hidden;
        if(check==='disclosure-state') return !!document.querySelector('#extra-content') && !document.querySelector('#extra-content').hidden;
        if(check==='dialog-name') return !!document.querySelector('#preferences')?.open;
        if(check==='status-role') return !!document.querySelector('#status-message')?.textContent.trim();
        return true;
      }, {check:item.check}, {timeout:3000});
    }
  }
  await page.locator('#fixture').evaluate(el=>el.dataset.ready='true');
}
function csvCell(value){ const s=typeof value==='string'?value:JSON.stringify(value??''); return `"${String(s).replace(/"/g,'""')}"`; }
function countOutcomes(records, engines) {
  const counts=Object.fromEntries(engines.map(engine=>[engine,{PASS:0,FAIL:0,NOT_TESTABLE:0}]));
  for(const record of records) if(counts[record.engine] && counts[record.engine][record.observed_result] !== undefined) counts[record.engine][record.observed_result]++;
  return counts;
}

async function runRouteChangeScenario(page, context, runId, repetition, metadata) {
  const started=Date.now();
  const base={run_id:runId,scenario_id:'S1-ROUTE-CHANGE',repetition,expected_condition:'SPA route changes to the selected test view, document title updates, and focus moves to the new view heading.',timestamp:new Date().toISOString(),browser_metadata:metadata};
  try {
    await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});
    await page.locator('.variant-link').first().click();
    await page.waitForURL(/\/test\/TC01-D1$/,{timeout:5000});
    await page.waitForFunction(()=>document.activeElement?.matches('#main-content h1'));
    const domEvidence=await page.evaluate(()=>({url:location.pathname,title:document.title,heading:document.querySelector('#main-content h1')?.textContent.trim(),focusMovedToHeading:document.activeElement===document.querySelector('#main-content h1')}));
    const expectedTitle='TC01-D1 · Conformance Testing Lab';
    const domPass=domEvidence.url==='/test/TC01-D1' && domEvidence.title===expectedTitle && domEvidence.focusMovedToHeading;
    const domRecord={...base,engine:'DOM',observed_result:domPass?'PASS':'FAIL',evidence:domEvidence,not_testable_reason:'',duration_ms:Date.now()-started};

    const cdp=await context.newCDPSession(page);
    let treeRecord;
    try {
      const {nodes=[]}=await cdp.send('Accessibility.getFullAXTree');
      const focusedHeading=nodes.find(n=>String(n.role?.value||'').toLowerCase()==='heading' && (n.properties||[]).some(p=>p.name==='focused' && (p.value?.value ?? p.value)===true));
      if(!focusedHeading) treeRecord={...base,engine:'ACCESSIBILITY_TREE',observed_result:'NOT_TESTABLE',evidence:{method:'Accessibility.getFullAXTree',nodeCount:nodes.length},not_testable_reason:'Chromium did not expose the route heading focus state as a focused Accessibility Tree property.',duration_ms:Date.now()-started};
      else treeRecord={...base,engine:'ACCESSIBILITY_TREE',observed_result:'PASS',evidence:{method:'Accessibility.getFullAXTree',focusedHeading:{role:focusedHeading.role?.value,name:focusedHeading.name?.value}},not_testable_reason:'',duration_ms:Date.now()-started};
    } finally { await cdp.detach().catch(()=>{}); }
    return [domRecord,treeRecord];
  } catch(error) {
    return ['DOM','ACCESSIBILITY_TREE'].map(engine=>({...base,engine,observed_result:'NOT_TESTABLE',evidence:null,not_testable_reason:`Route-change scenario execution failed: ${error.message}`,duration_ms:Date.now()-started}));
  }
}

async function runModalScenario(page, context, runId, repetition, metadata) {
  const started=Date.now();
  const base={run_id:runId,scenario_id:'S2-MODAL-DIALOG',repetition,expected_condition:'Opening the modal exposes a named dialog and moves focus inside it; Escape closes it and returns focus to the opener.',timestamp:new Date().toISOString(),browser_metadata:metadata};
  try {
    await page.goto(`${BASE_URL}/test/TC13-C`,{waitUntil:'domcontentloaded'});
    const opener=page.locator('#open-dialog');
    await opener.click();
    const openState=await page.evaluate(()=>({open:!!document.querySelector('#preferences')?.open,focusInside:!!document.querySelector('#preferences')?.contains(document.activeElement),activeElement:document.activeElement?.id||document.activeElement?.tagName?.toLowerCase()}));
    const cdp=await context.newCDPSession(page);
    let treeEvidence;
    try {
      const {nodes=[]}=await cdp.send('Accessibility.getFullAXTree');
      const dialog=nodes.find(n=>String(n.role?.value||'').toLowerCase()==='dialog' && String(n.name?.value||'').trim());
      treeEvidence={method:'Accessibility.getFullAXTree',dialogFound:!!dialog,dialogName:dialog?.name?.value||null};
    } finally { await cdp.detach().catch(()=>{}); }
    await page.keyboard.press('Escape');
    const returnedFocus=await page.evaluate(()=>({closed:!document.querySelector('#preferences')?.open,focusReturned:document.activeElement===document.querySelector('#open-dialog')}));
    const domPass=openState.open && openState.focusInside && returnedFocus.closed && returnedFocus.focusReturned;
    const treePass=treeEvidence.dialogFound;
    return [
      {...base,engine:'DOM',observed_result:domPass?'PASS':'FAIL',evidence:{...openState,...returnedFocus},not_testable_reason:'',duration_ms:Date.now()-started},
      {...base,engine:'ACCESSIBILITY_TREE',observed_result:treePass?'PASS':'FAIL',evidence:treeEvidence,not_testable_reason:'',duration_ms:Date.now()-started}
    ];
  } catch(error) {
    return ['DOM','ACCESSIBILITY_TREE'].map(engine=>({...base,engine,observed_result:'NOT_TESTABLE',evidence:null,not_testable_reason:`Modal scenario execution failed: ${error.message}`,duration_ms:Date.now()-started}));
  }
}

async function runVisibilityScenario(page, context, runId, repetition, metadata) {
  const started=Date.now();
  const base={run_id:runId,scenario_id:'S5-VISIBILITY-CHANGE',repetition,expected_condition:'A visible informative image is exposed in the accessibility tree; when hidden with CSS visibility:hidden it is removed from the exposed accessibility tree; restoring visibility makes it available again.',timestamp:new Date().toISOString(),browser_metadata:metadata};
  try {
    await page.goto(`${BASE_URL}/test/TC01-C`,{waitUntil:'domcontentloaded'});
    const target=page.locator('#fixture img');
    await target.waitFor({state:'visible'});
    const session=await context.newCDPSession(page);
    try {
      const {root}=await session.send('DOM.getDocument',{depth:-1,pierce:true});
      const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#fixture img'});
      if(!nodeId) throw new Error('Visibility target image was not found in the DOM.');
      const {node}=await session.send('DOM.describeNode',{nodeId});
      const backendNodeId=node.backendNodeId;
      const readAX=async()=>{
        const {nodes=[]}=await session.send('Accessibility.getFullAXTree');
        const found=nodes.find(n=>n.backendDOMNodeId===backendNodeId);
        return {present:!!found,ignored:found?.ignored??null,role:found?.role?.value??null,name:found?.name?.value??null};
      };
      const initiallyVisible=await page.evaluate(()=>{const e=document.querySelector('#fixture img');const s=getComputedStyle(e);return {display:s.display,visibility:s.visibility,rects:e.getClientRects().length};});
      const initiallyAX=await readAX();
      await target.evaluate(el=>el.style.visibility='hidden');
      await page.waitForTimeout(50);
      const hiddenDOM=await page.evaluate(()=>{const e=document.querySelector('#fixture img');const s=getComputedStyle(e);return {display:s.display,visibility:s.visibility,rects:e.getClientRects().length};});
      const hiddenAX=await readAX();
      await target.evaluate(el=>el.style.visibility='visible');
      await page.waitForTimeout(50);
      const restoredDOM=await page.evaluate(()=>{const e=document.querySelector('#fixture img');const s=getComputedStyle(e);return {display:s.display,visibility:s.visibility,rects:e.getClientRects().length};});
      const restoredAX=await readAX();
      const domPass=initiallyVisible.visibility==='visible' && hiddenDOM.visibility==='hidden' && restoredDOM.visibility==='visible';
      const axPass=initiallyAX.present && initiallyAX.ignored===false && (!hiddenAX.present || hiddenAX.ignored===true) && restoredAX.present && restoredAX.ignored===false;
      return [
        {...base,engine:'DOM',observed_result:domPass?'PASS':'FAIL',evidence:{initiallyVisible,hiddenDOM,restoredDOM},not_testable_reason:'',duration_ms:Date.now()-started},
        {...base,engine:'ACCESSIBILITY_TREE',observed_result:axPass?'PASS':'FAIL',evidence:{method:'Accessibility.getFullAXTree',initiallyVisible:initiallyAX,hidden:hiddenAX,restored:restoredAX},not_testable_reason:'',duration_ms:Date.now()-started}
      ];
    } finally { await session.detach().catch(()=>{}); }
  } catch(error) {
    return ['DOM','ACCESSIBILITY_TREE'].map(engine=>({...base,engine,observed_result:'NOT_TESTABLE',evidence:null,not_testable_reason:`Visibility-change scenario execution failed: ${error.message}`,duration_ms:Date.now()-started}));
  }
}

async function main(){
  if(!Number.isInteger(REPETITIONS) || REPETITIONS < 1) throw new Error('EXPERIMENT_REPETITIONS must be a positive integer.');
  fs.mkdirSync(RESULTS,{recursive:true});
  const server=await startServerIfNeeded();
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1365,height:900},locale:'en-US',colorScheme:'light'});
    const page=await context.newPage();
    const cdpMeta=await context.newCDPSession(page);
    let protocolVersion='unavailable';
    try { protocolVersion=(await cdpMeta.send('Browser.getVersion')).protocolVersion; } catch {}
    await cdpMeta.detach();
    const runId=`run-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(3).toString('hex')}`;
    const metadata={runId,startedAt:new Date().toISOString(),nodeVersion:process.version,axeCoreAvailable:!!axeCorePath,platform:`${os.platform()} ${os.release()}`,architecture:os.arch(),playwrightVersion,expressVersion,axeCoreVersion:axeVersion,browserName:'Chromium',browserVersion:browser.version(),cdpProtocolVersion:protocolVersion,accessibilityTreeTargetFrame:'main frame',accessibilityTreeFiltering:'Full tree requested; no pre-filter before rule-specific matching',accessibilityTreeNodeMatching:'CDP DOM backend-node identity binds the fixture target; pass/fail evidence comes only from Accessibility.getFullAXTree',browserFlags:[],viewport:{width:1365,height:900},locale:'en-US',headless:true,treeExtractionMethod:'CDP Accessibility.getFullAXTree',plannedRepetitions:REPETITIONS,actualRepetitions:REPETITIONS,caseVariants:cases.length,pairedEngineEvaluationsPerRepetition:cases.length*2,offTheShelfReference:'axe-core (reported separately; not counted as either experimental engine)'};
    const records=[];
    const routeScenarioRecords=[];
    const modalScenarioRecords=[];
    const visibilityScenarioRecords=[];
    for(let repetition=1;repetition<=REPETITIONS;repetition++) {
      for(let index=0;index<cases.length;index++) {
        const item=cases[index];
        for(const engine of ['DOM','ACCESSIBILITY_TREE']) {
          const started=Date.now();
          let observed;
          try {
            await prepare(page,item);
            if(engine==='DOM') observed=await evaluateDOM(page,item);
            else {
              const session=await context.newCDPSession(page);
              try { observed=await evaluateAccessibilityTree(page,item,session); }
              finally { await session.detach().catch(()=>{}); }
            }
          } catch(error) {
            observed={observedResult:'NOT_TESTABLE',evidence:null,notTestableReason:`Runner setup or execution failed: ${error.message}`};
          }
          records.push({run_id:runId,repetition,test_case_id:item.caseId,test_family_id:item.familyId,variant_id:item.variant,engine,expected_label:item.expectedLabel,ground_truth_status:item.groundTruthStatus,detection_class:item.detectionClass,observed_result:observed.observedResult,evidence:observed.evidence,not_testable_reason:observed.notTestableReason||'',browser_metadata:metadata,timestamp:new Date().toISOString(),duration_ms:Date.now()-started,interaction_state:{route:`/test/${item.caseId}`,steps:item.interaction||[],state:'prepared by shared runner'},wcag_mapping:item.wcag,rule:item.check});
        }
        // axe-core is an independent reference, not a third implementation of either research engine.
        try {
          await prepare(page,item);
          if (!axeCorePath) throw new Error('axe-core is not installed. From the project root run: npm install axe-core@^4.10.3');
          await page.addScriptTag({path:axeCorePath});
          const axe=await page.evaluate(async()=>{
            const result=await window.axe.run(document.querySelector('#fixture'));
            return {violations:result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,nodes:v.nodes.length})),passes:result.passes.length,incomplete:result.incomplete.length,inapplicable:result.inapplicable.length};
          });
          records.push({run_id:runId,repetition,test_case_id:item.caseId,test_family_id:item.familyId,variant_id:item.variant,engine:'AXE_CORE_REFERENCE',expected_label:item.expectedLabel,ground_truth_status:item.groundTruthStatus,detection_class:'OFF_THE_SHELF_REFERENCE',observed_result:axe.violations.length?'FAIL':'PASS',evidence:axe,not_testable_reason:'',browser_metadata:metadata,timestamp:new Date().toISOString(),duration_ms:null,interaction_state:{route:`/test/${item.caseId}`,steps:item.interaction||[],state:'prepared by shared runner'},wcag_mapping:item.wcag,rule:'axe-core'});
        } catch(error) {
          records.push({run_id:runId,repetition,test_case_id:item.caseId,test_family_id:item.familyId,variant_id:item.variant,engine:'AXE_CORE_REFERENCE',expected_label:item.expectedLabel,ground_truth_status:item.groundTruthStatus,detection_class:'OFF_THE_SHELF_REFERENCE',observed_result:'NOT_TESTABLE',evidence:null,not_testable_reason:`axe-core reference execution failed: ${error.message}`,browser_metadata:metadata,timestamp:new Date().toISOString(),duration_ms:null,interaction_state:{route:`/test/${item.caseId}`,steps:item.interaction||[],state:'prepared by shared runner'},wcag_mapping:item.wcag,rule:'axe-core'});
        }
      }
      console.log(`Completed repetition ${repetition}/${REPETITIONS}: ${cases.length*2} paired engine evaluations, ${cases.length} axe-core reference scans, for the interim TC01-TC08 scope.`);
    }
    const completedAt=new Date().toISOString();
    metadata.completedAt=completedAt;
    const jsonPath=path.join(RESULTS,`${runId}.json`);
    const csvPath=path.join(RESULTS,`${runId}.csv`);
    fs.writeFileSync(jsonPath,JSON.stringify({metadata,groundTruthStatus:'UNVERIFIED',records},null,2));
    const columns=['run_id','repetition','test_case_id','test_family_id','variant_id','engine','expected_label','ground_truth_status','detection_class','observed_result','evidence','not_testable_reason','browser_metadata','timestamp','duration_ms','interaction_state','wcag_mapping','rule'];
    fs.writeFileSync(csvPath,[columns.map(csvCell).join(','),...records.map(r=>columns.map(c=>csvCell(r[c])).join(','))].join('\n'));
    const experimentalRecords=records.filter(r=>['DOM','ACCESSIBILITY_TREE'].includes(r.engine));
    const axeRecords=records.filter(r=>r.engine==='AXE_CORE_REFERENCE');
    const statusScenarioRecords=experimentalRecords.filter(r=>r.test_case_id?.startsWith('TC14-'));
    const widgetScenarioRecords=experimentalRecords.filter(r=>r.test_case_id?.startsWith('TC11-')||r.test_case_id?.startsWith('TC12-'));
    const summary={runId,completedAt,caseVariants:cases.length,repetitions:REPETITIONS,evaluations:experimentalRecords.length,pairedEngineEvaluations:experimentalRecords.length,referenceScans:axeRecords.length,totalEvaluationAndReferenceRecords:records.length,perEngineEvaluations:{DOM:experimentalRecords.filter(r=>r.engine==='DOM').length,ACCESSIBILITY_TREE:experimentalRecords.filter(r=>r.engine==='ACCESSIBILITY_TREE').length},axeCoreReferenceEvaluations:axeRecords.length,dynamicRouteEvaluations:routeScenarioRecords.length,dynamicModalEvaluations:modalScenarioRecords.length,dynamicStatusEvaluations:statusScenarioRecords.length,dynamicWidgetEvaluations:widgetScenarioRecords.length,dynamicVisibilityEvaluations:visibilityScenarioRecords.length,dynamicScenarioCoverage:{S1_ROUTE_CHANGE:{records:routeScenarioRecords.length,repetitions:REPETITIONS},S2_MODAL_DIALOG:{records:modalScenarioRecords.length,repetitions:REPETITIONS},S3_FORM_STATUS:{records:statusScenarioRecords.length,testVariants:3,repetitions:REPETITIONS,source:'TC14-D1/D2/C in the primary run JSON/CSV'},S4_TABS_AND_DISCLOSURES:{records:widgetScenarioRecords.length,testVariants:6,repetitions:REPETITIONS,source:'TC11 and TC12 in the primary run JSON/CSV'},S5_VISIBILITY_CHANGE:{records:visibilityScenarioRecords.length,repetitions:REPETITIONS}},groundTruthStatus:'UNVERIFIED',outcomes:countOutcomes(experimentalRecords,['DOM','ACCESSIBILITY_TREE']),axeCoreOutcomes:{PASS:axeRecords.filter(r=>r.observed_result==='PASS').length,FAIL:axeRecords.filter(r=>r.observed_result==='FAIL').length,NOT_TESTABLE:axeRecords.filter(r=>r.observed_result==='NOT_TESTABLE').length},routeScenarioOutcomes:countOutcomes(routeScenarioRecords,['DOM','ACCESSIBILITY_TREE']),modalScenarioOutcomes:countOutcomes(modalScenarioRecords,['DOM','ACCESSIBILITY_TREE']),visibilityScenarioOutcomes:countOutcomes(visibilityScenarioRecords,['DOM','ACCESSIBILITY_TREE']),files:[path.relative(ROOT,jsonPath),path.relative(ROOT,csvPath)],warning:'Five repetitions provide repeatability evidence, not ground-truth validation. Expected labels remain provisional until independent manual verification.'};
    fs.writeFileSync(path.join(RESULTS,`${runId}-summary.json`),JSON.stringify(summary,null,2));
    if (!axeCorePath) console.warn('WARNING: axe-core is not installed. DOM and Accessibility Tree experiments completed independently, but all axe-core reference records will be NOT_TESTABLE. Install it from the project root with: npm install axe-core@^4.10.3');
    console.log(JSON.stringify(summary,null,2));
  } finally {
    if(browser) await browser.close();
    if(server && server.exitCode===null) server.kill();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
