(() => {
  const main = document.getElementById('main-content');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mountCurrentView() {
    const search = document.getElementById('case-search');
    if (search) search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll('.family-card').forEach(card => card.hidden = !card.dataset.search.toLowerCase().includes(q));
    });
    const runButton=document.getElementById('run-experiment');
    const statusNode=document.getElementById('run-status');
    const historyNode=document.getElementById('run-history');
    async function refreshRunHistory(){
      if(!historyNode) return;
      try{
        const response=await fetch('/api/runs'); const runs=await response.json(); historyNode.replaceChildren();
        if(!runs.length){const empty=document.createElement('span');empty.textContent='No experiment runs saved yet.';historyNode.append(empty);return;}
        for(const run of runs.slice(0,5)){
          const row=document.createElement('article');
          const label=document.createElement('strong');label.textContent=run.runId;
          const detail=document.createElement('span');detail.textContent=`${run.evaluations} paired engine evaluations + ${run.referenceScans||0} axe-core scans · ${run.completedAt} · ground truth ${run.groundTruthStatus}`;
          const downloads=document.createElement('span');
          for(const format of ['json','csv','summary.json','dynamic-scenarios','modal-scenarios','visibility-scenarios']){const link=document.createElement('a');link.href=`/api/runs/${encodeURIComponent(run.runId)}/download/${format}`;link.textContent=format==='dynamic-scenarios'?'ROUTE':format==='modal-scenarios'?'MODAL':format==='visibility-scenarios'?'VISIBILITY':format.toUpperCase();link.style.marginLeft='10px';link.style.color='var(--accent)';downloads.append(link);}
          row.append(label,detail,downloads);historyNode.append(row);
        }
      }catch(error){if(statusNode)statusNode.textContent=`Could not load run history: ${error.message}`;}
    }
    const refreshButton=document.getElementById('refresh-runs');
    if(refreshButton) refreshButton.addEventListener('click',refreshRunHistory);
    if(runButton) runButton.addEventListener('click',async()=>{
      runButton.disabled=true;
      if(statusNode)statusNode.textContent='Starting Chromium and preparing the paired run…';
      try{
        const start=await fetch('/api/run',{method:'POST'}); const startData=await start.json();
        if(!start.ok) throw new Error(startData.error||'Could not start the experiment.');
        let state={status:'RUNNING'};
        while(state.status==='RUNNING'){
          await new Promise(resolve=>setTimeout(resolve,1200));
          const response=await fetch('/api/run-status'); state=await response.json();
          if(statusNode)statusNode.textContent=state.status==='RUNNING'?'Experiment running: both engines are processing 45 variants for five repetitions; Playwright is also checking keyboard operation and focus order…':state.status==='COMPLETED'?'Experiment completed. JSON/CSV results include five-repeat DOM and Accessibility Tree evaluations, Playwright keyboard/focus evidence, axe-core reference scans and dynamic-scenario evidence.':`Experiment ${state.status.toLowerCase()}: ${state.stderr||'Check the terminal or run log.'}`;
        }
        await refreshRunHistory();
      }catch(error){if(statusNode)statusNode.textContent=error.message;}
      finally{runButton.disabled=false;}
    });
    if(historyNode) refreshRunHistory();

    const host = document.getElementById('fixture');
    if (!host) return;
    const caseId = host.dataset.caseId;
    const config = JSON.parse(host.dataset.config);
    const family = caseId.slice(0,4);
    const state = document.getElementById('fixture-state');
    const setState = message => { if(state) state.textContent = message; };
    function render(){
      if(family === 'TC06') document.title = config.title;
      const c = config;
      switch(family){
        case 'TC01': host.innerHTML = `<h3>Product overview</h3><img width="160" height="90" alt="${c.alt === null ? '' : escapeHTML(c.alt)}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%23d9e2f2'/%3E%3Ctext x='12' y='50' fill='%23344' font-size='13'%3EChart preview%3C/text%3E%3C/svg%3E">`; if(c.alt===null) host.querySelector('img').removeAttribute('alt'); break;
        case 'TC02': host.innerHTML = `<form><label for="email-field">${c.label===null?'':escapeHTML(c.label)}</label><input id="email-field" type="email" placeholder="${escapeHTML(c.placeholder)}"></form>`; if(c.label===null) host.querySelector('label').remove(); break;
        case 'TC03': host.innerHTML = `<button type="button" ${c.aria===null?'':`aria-label="${escapeHTML(c.aria)}"`} ${c.title===null?'':`title="${escapeHTML(c.title)}"`}>${escapeHTML(c.text)}</button>`; if(c.aria===null) host.querySelector('button').removeAttribute('aria-label'); break;
        case 'TC04': host.innerHTML = `<a href="${escapeHTML(c.href)}" ${c.aria===null?'':`aria-label="${escapeHTML(c.aria)}"`}>${escapeHTML(c.text)}</a>`; break;
        case 'TC05': host.innerHTML = `<${c.tag} ${c.role?`role="${c.role}"`:''}>${escapeHTML(c.text)}</${c.tag}>`; break;
        case 'TC06': host.innerHTML = '<h3>Document title scenario</h3><p>Inspect the browser document title.</p>'; break;
        case 'TC07': host.innerHTML = `<button id="label-name-target" type="button" aria-label="${escapeHTML(c.aria)}">${escapeHTML(c.visible)}</button>`; break;
        case 'TC08': { const attrs = `id="keyboard-target" ${c.role?`role="${c.role}"`:''} tabindex="${c.tabIndex}"`; host.innerHTML = c.element==='button' ? `<button ${attrs} type="button">Activate</button>` : `<div ${attrs}>Activate</div>`; const target=host.querySelector('#keyboard-target'); target.addEventListener('click',()=>target.dataset.activated='true'); if(c.keyboardHandler) target.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();target.click();}}); break; }
        case 'TC09': host.innerHTML = `<table><caption>${escapeHTML(c.caption)}</caption><thead><tr>${c.headers==='th'?'<th scope="col">Quarter</th><th scope="col">Revenue</th>':'<td>Quarter</td><td>Revenue</td>'}</tr></thead><tbody><tr><td>Q1</td><td>120</td></tr></tbody></table>`; if(c.headers===false) host.querySelector('thead').remove(); break;
        case 'TC10': host.innerHTML = `<${c.tag} ${c.role?`role="${c.role}"`:''}><li>Alpha</li><li>Beta</li><li>Gamma</li></${c.tag}>`; break;
        case 'TC11': host.innerHTML = `<div role="tablist" aria-label="Account sections"><button id="tab-one" role="tab" aria-controls="panel-one" aria-selected="true">Profile</button><button id="tab-two" role="tab" aria-controls="panel-two" aria-selected="false">Security</button></div><div id="panel-one" role="tabpanel">Profile settings</div><div id="panel-two" role="tabpanel" hidden>Security settings</div>`; host.querySelector('#tab-two').addEventListener('click',()=>{host.querySelectorAll('[role=tab]').forEach(t=>t.setAttribute('aria-selected','false'));if(c.selected===null) host.querySelector('#tab-two').removeAttribute('aria-selected'); else host.querySelector('#tab-two').setAttribute('aria-selected',c.selected);host.querySelector('#panel-one').hidden=true;host.querySelector('#panel-two').hidden=false;setState('Security tab selected');}); break;
        case 'TC12': host.innerHTML = `<button id="disclosure" aria-controls="extra-content" ${c.expanded===null?'':`aria-expanded="false"`}>More information</button><div id="extra-content" hidden>Additional account information</div>`; host.querySelector('#disclosure').addEventListener('click',()=>{host.querySelector('#extra-content').hidden=false;if(c.expanded===null) host.querySelector('#disclosure').removeAttribute('aria-expanded'); else host.querySelector('#disclosure').setAttribute('aria-expanded',c.expanded);setState('Disclosure opened');}); break;
        case 'TC13': host.innerHTML = `<button id="open-dialog">Open preferences</button><dialog id="preferences" role="${escapeHTML(c.role)}" ${c.label===null?'':`aria-label="${escapeHTML(c.label)}"`} ${c.title===null?'':`aria-labelledby="dialog-title"`}><h3 id="dialog-title">Preferences</h3><p>Choose your preferences.</p><button id="close-dialog">Close</button></dialog>`; if(c.label===null) host.querySelector('dialog').removeAttribute('aria-label'); host.querySelector('#open-dialog').addEventListener('click',()=>host.querySelector('dialog').showModal()); host.querySelector('#close-dialog').addEventListener('click',()=>host.querySelector('dialog').close()); break;
        case 'TC14': host.innerHTML = `<form><button id="submit-status" type="submit">Save</button></form><div id="status-message" ${c.role?`role="${c.role}"`:''} ${c.live?`aria-live="${c.live}"`:''}></div>`; host.querySelector('form').addEventListener('submit',e=>{e.preventDefault();host.querySelector('#status-message').textContent=c.text;setState('Form submitted; status message updated');}); break;
        case 'TC15': { const labels=['Step one','Step two','Step three']; host.innerHTML = [1,2,3].map((n,i)=>`<button type="button" id="step-${n}" tabindex="${c.order[i]}">${labels[n-1]}</button>`).join(' '); break; }
        default: host.textContent='No fixture renderer available.';
      }
      setState('Initial state');
    }
    const reset = document.getElementById('reset-fixture');
    if(reset) reset.addEventListener('click',render);
    render();
  }

  async function navigate(url, push=true) {
    try {
      const response=await fetch(url,{headers:{'X-SPA-Navigation':'1'}});
      if(!response.ok) throw new Error(`Navigation failed (${response.status})`);
      const html=await response.text();
      const parsed=new DOMParser().parseFromString(html,'text/html');
      const nextMain=parsed.querySelector('#main-content');
      if(!nextMain) throw new Error('The requested route did not return an application view.');
      main.innerHTML=nextMain.innerHTML;
      document.title=parsed.title;
      const nextLang=parsed.documentElement.getAttribute('lang');
      if(nextLang) document.documentElement.lang=nextLang;
      if(push) history.pushState({},'',url);
      mountCurrentView();
      const routeHeading = document.querySelector('#main-content h1');
      if (routeHeading) { routeHeading.setAttribute('tabindex','-1'); routeHeading.focus(); }
      window.scrollTo(0,0);
    } catch(error) { console.error(error); window.location.href=url; }
  }

  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download')) return;
    const url=new URL(link.href,window.location.href);
    if(url.origin!==window.location.origin||!['/','/test/'].some(prefix=>prefix==='/'?url.pathname==='/':url.pathname.startsWith(prefix))) return;
    if(url.pathname===window.location.pathname&&url.hash) return;
    event.preventDefault();navigate(url.pathname+url.search+url.hash,true);
  });
  window.addEventListener('popstate',()=>navigate(window.location.pathname+window.location.search+window.location.hash,false));
  mountCurrentView();
})();
