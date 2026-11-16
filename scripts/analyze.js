'use strict';
const fs=require('fs');
const path=require('path');
const input=process.argv[2];
if(!input){console.error('Usage: npm run analyze -- results/<run-id>.json');process.exit(2);}
const data=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
const register=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/ground-truth-register.json'),'utf8'));
const gt=new Map(register.map(x=>[x.test_case_id,x]));
const engines=['DOM','ACCESSIBILITY_TREE'];
const records=data.records||[];
const majority=(rs)=>{
 const counts={PASS:0,FAIL:0,NOT_TESTABLE:0};
 for(const r of rs) if(Object.hasOwn(counts,r.observed_result)) counts[r.observed_result]++;
 let result='INCONSISTENT';
 if(counts.PASS>rs.length/2) result='PASS';
 else if(counts.FAIL>rs.length/2) result='FAIL';
 else if(counts.NOT_TESTABLE>rs.length/2) result='NOT_TESTABLE';
 return {result,counts,repetitions:rs.length,stable:rs.length>0 && Object.values(counts).filter(n=>n>0).length===1};
};
const byEngineCase=new Map();
for(const r of records){
 if(!engines.includes(r.engine)) continue;
 const key=`${r.engine}::${r.test_case_id}`;
 if(!byEngineCase.has(key)) byEngineCase.set(key,{engine:r.engine,test_case_id:r.test_case_id,records:[]});
 byEngineCase.get(key).records.push(r);
}
const aggregated=[...byEngineCase.values()].map(x=>({...x,...majority(x.records)}));
const report={runId:data.metadata?.runId||'unknown',groundTruthStatus:'Ground-truth register controls scoring',caseVariants:new Set(aggregated.map(r=>r.test_case_id)).size,repetitions:data.metadata?.actualRepetitions||null,rawPairedEngineEvaluations:records.filter(r=>engines.includes(r.engine)).length,engines:{},agreement:null,nonComparableCases:[],repeatability:{},axeCoreReference:null,limitations:[]};
for(const engine of engines){
 const raw=records.filter(r=>r.engine===engine);
 const rows=aggregated.filter(r=>r.engine===engine);
 const counts={PASS:0,FAIL:0,NOT_TESTABLE:0,INCONSISTENT:0};
 for(const r of rows) counts[r.result]++;
 const verified=rows.filter(r=>gt.get(r.test_case_id)?.ground_truth_status==='VERIFIED' && ['PASS','FAIL'].includes(gt.get(r.test_case_id)?.verified_expected_label));
 const testable=verified.filter(r=>['PASS','FAIL'].includes(r.result));
 const tp=testable.filter(r=>gt.get(r.test_case_id).verified_expected_label==='FAIL'&&r.result==='FAIL').length;
 const fp=testable.filter(r=>gt.get(r.test_case_id).verified_expected_label==='PASS'&&r.result==='FAIL').length;
 const fn=testable.filter(r=>gt.get(r.test_case_id).verified_expected_label==='FAIL'&&r.result==='PASS').length;
 const tn=testable.filter(r=>gt.get(r.test_case_id).verified_expected_label==='PASS'&&r.result==='PASS').length;
 const predictedFailures=tp+fp, actualDefects=tp+fn;
 const precision=predictedFailures?tp/predictedFailures:null;
 const recall=actualDefects?tp/actualDefects:null;
 const f1=precision!==null&&recall!==null?(precision+recall>0?2*precision*recall/(precision+recall):0):null;
 const stable=rows.filter(r=>r.stable).length;
 report.engines[engine]={rawEvaluationRecords:raw.length,uniqueCaseVariants:rows.length,repetitionCount:rows.length?rows[0].repetitions:0,majorityOutcomeCounts:counts,majorityCoverage:rows.length?(rows.length-counts.NOT_TESTABLE-counts.INCONSISTENT)/rows.length:null,verifiedGroundTruthCases:verified.length,validAssessmentsOnVerifiedCases:testable.length,coverageOnVerifiedCases:verified.length?testable.length/verified.length:null,confusionMatrix:{truePositive:tp,falsePositive:fp,falseNegative:fn,trueNegative:tn},precision,recall,f1,scoringStatus:verified.length?'CALCULATED_ON_VERIFIED_GROUND_TRUTH':'NOT_CALCULATED_NO_VERIFIED_GROUND_TRUTH'};
 report.repeatability[engine]={fullyConsistentCases:stable,totalCaseVariants:rows.length,fullyConsistentRate:rows.length?stable/rows.length:null,unstableCases:rows.filter(r=>!r.stable).map(r=>({test_case_id:r.test_case_id,counts:r.counts,majorityResult:r.result}))};
}
const perCase=new Map();
for(const row of aggregated){if(!perCase.has(row.test_case_id))perCase.set(row.test_case_id,{});perCase.get(row.test_case_id)[row.engine]=row.result;}
const jointlyTestable=[...perCase.entries()].filter(([,x])=>['PASS','FAIL'].includes(x.DOM)&&['PASS','FAIL'].includes(x.ACCESSIBILITY_TREE));
const agree=jointlyTestable.filter(([,x])=>x.DOM===x.ACCESSIBILITY_TREE).length;
report.agreement={totalCaseVariants:perCase.size,jointlyTestableCases:jointlyTestable.length,agreements:agree,disagreements:jointlyTestable.length-agree,agreementRate:jointlyTestable.length?agree/jointlyTestable.length:null,denominator:'Majority outcomes per case; only cases where both engines return PASS or FAIL are included. NOT_TESTABLE and INCONSISTENT are excluded.'};
report.nonComparableCases=[...perCase.entries()].filter(([,x])=>!(['PASS','FAIL'].includes(x.DOM)&&['PASS','FAIL'].includes(x.ACCESSIBILITY_TREE))).map(([test_case_id,outcomes])=>({test_case_id,...outcomes,reason:'At least one engine majority result is NOT_TESTABLE or INCONSISTENT; excluded from paired agreement.'}));
const axe=records.filter(r=>r.engine==='AXE_CORE_REFERENCE');
if(axe.length){
 const byCase=new Map();for(const r of axe){if(!byCase.has(r.test_case_id))byCase.set(r.test_case_id,[]);byCase.get(r.test_case_id).push(r);}
 const rows=[...byCase.entries()].map(([test_case_id,rs])=>({test_case_id,...majority(rs)}));
 report.axeCoreReference={rawScans:axe.length,uniqueCaseVariants:rows.length,majorityOutcomeCounts:rows.reduce((a,r)=>(a[r.result]++,a),{PASS:0,FAIL:0,NOT_TESTABLE:0,INCONSISTENT:0}),note:'Separate off-the-shelf reference results; not counted as a research engine.'};
}
report.limitations.push('Majority outcome is calculated per case across repeated runs; a case without a strict majority is marked INCONSISTENT.');
report.limitations.push('Coverage and agreement are descriptive implementation outputs; agreement is not accuracy.');
report.limitations.push('NOT_TESTABLE and INCONSISTENT are excluded from confusion-matrix and paired-agreement metrics and are never treated as PASS.');
report.limitations.push('Precision, recall and F1 require independently verified labels in docs/ground-truth-register.json.');
report.limitations.push('axe-core is an independent reference and is not treated as ground truth.');
report.limitations.push('Results apply only to the implemented fixtures, rules, Chromium version and test conditions.');
const out=path.resolve(path.dirname(input),`${path.basename(input,'.json')}-analysis.json`);
fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));console.log(`\nSaved: ${out}`);
