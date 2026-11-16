'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const express = require('express');
const { engine } = require('express-handlebars');
const { families, cases } = require('./data/cases');
const app = express();
const PORT = process.env.PORT || 3000;
let activeRun = null;

app.engine('handlebars', engine({ defaultLayout:'main', layoutsDir:path.join(__dirname,'../views/layouts') }));
app.set('view engine','handlebars');
app.set('views',path.join(__dirname,'../views'));
app.use(express.json());
app.use(express.static(path.join(__dirname,'../public')));

app.get('/', (req,res) => res.render('dashboard', { title:'Conformance Testing Lab', families, totalCases:cases.length }));
app.get('/test/:caseId', (req,res) => {
  const item = cases.find(c => c.caseId === req.params.caseId);
  if (!item) return res.status(404).render('not-found',{title:'Scenario not found'});
  res.render('scenario',{title:item.caseId, item, configJson:JSON.stringify(item.config).replace(/</g,'\\u003c')});
});
app.get('/api/cases', (req,res) => res.json(cases));
app.get('/api/summary', (req,res) => res.json({families:families.length,cases:cases.length,engines:['DOM','ACCESSIBILITY_TREE'],repetitions:5,plannedPairedEngineEvaluations:cases.length*2*5,plannedAxeCoreReferenceScans:cases.length*5,groundTruthStatus:'UNVERIFIED'}));
app.post('/api/run', (req,res) => {
  if (activeRun && activeRun.status === 'RUNNING') return res.status(409).json({error:'An experiment is already running.',run:activeRun});
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath,[path.join(__dirname,'runner/run.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
  activeRun = {status:'RUNNING',startedAt,stdout:'',stderr:'',exitCode:null};
  const append = (key,chunk) => { activeRun[key] = (activeRun[key] + chunk.toString()).slice(-12000); };
  child.stdout.on('data',chunk=>append('stdout',chunk));
  child.stderr.on('data',chunk=>append('stderr',chunk));
  child.on('error',error=>{if(activeRun){activeRun.status='FAILED';activeRun.stderr+=error.message;activeRun.completedAt=new Date().toISOString();}});
  child.on('close',code=>{if(activeRun){activeRun.status=code===0?'COMPLETED':'FAILED';activeRun.exitCode=code;activeRun.completedAt=new Date().toISOString();}});
  res.status(202).json({status:'RUNNING',startedAt});
});
app.get('/api/run-status', (req,res) => res.json(activeRun || {status:'IDLE'}));
app.get('/api/runs', (req,res) => {
  const dir=path.join(__dirname,'../results');
  const items=fs.readdirSync(dir).filter(name=>name.endsWith('-summary.json')).map(name=>{try{return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch{return null;}}).filter(Boolean).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
  res.json(items);
});
app.get('/api/runs/:runId', (req,res) => {
  if(!/^run-[a-zA-Z0-9-]+$/.test(req.params.runId)) return res.status(400).json({error:'Invalid run identifier.'});
  const file=path.join(__dirname,'../results',`${req.params.runId}-summary.json`);
  if(!fs.existsSync(file)) return res.status(404).json({error:'Run not found.'});
  res.json(JSON.parse(fs.readFileSync(file,'utf8')));
});
app.get('/api/runs/:runId/download/:format', (req,res) => {
  if(!/^run-[a-zA-Z0-9-]+$/.test(req.params.runId) || !['json','csv','summary.json','dynamic-scenarios','modal-scenarios','visibility-scenarios'].includes(req.params.format)) return res.status(400).json({error:'Invalid run file request.'});
  const suffix=req.params.format==='summary.json'?'-summary.json':req.params.format==='dynamic-scenarios'?'-dynamic-scenarios.json':req.params.format==='modal-scenarios'?'-modal-scenarios.json':req.params.format==='visibility-scenarios'?'-visibility-scenarios.json':`.${req.params.format}`;
  const file=path.join(__dirname,'../results',`${req.params.runId}${suffix}`);
  if(!fs.existsSync(file)) return res.status(404).json({error:'Run file not found.'});
  res.download(file);
});
app.get('/health', (req,res) => res.json({status:'ok',service:'automated-conformance-testing',timestamp:new Date().toISOString()}));
app.listen(PORT, '127.0.0.1', () => console.log(`Conformance Testing Lab running at http://localhost:${PORT}`));
