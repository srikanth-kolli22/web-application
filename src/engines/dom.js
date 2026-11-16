'use strict';
function result(pass, evidence, reason='') { return { observedResult: pass ? 'PASS' : 'FAIL', evidence, notTestableReason: reason }; }

// Start from the browser's normal unfocused state and use real Tab key presses.
// This deliberately avoids element.focus(), which can make tabindex=-1 controls
// appear keyboard-operable even though users cannot reach them sequentially.
async function tabToTarget(page, targetSelector, stopSelector, maxTabs=20) {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') active.blur();
  });
  const path = [];
  for (let i=0; i<maxTabs; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return { id: el?.id || '', tag: el?.tagName?.toLowerCase() || '', text: (el?.innerText || el?.textContent || '').trim().slice(0,80) };
    });
    path.push(focused);
    if (await page.locator(targetSelector).evaluate((el, id) => el === document.activeElement, null).catch(() => false)) {
      return { reached: true, path, focused };
    }
    if (stopSelector && focused.id === stopSelector.replace(/^#/, '')) break;
  }
  return { reached: false, path, focused: path[path.length-1] || null };
}

async function verifyKeyboardOperability(page) {
  const target = page.locator('#keyboard-target');
  const tab = await tabToTarget(page, '#keyboard-target', '#reset-fixture');
  const attributes = await target.evaluate(el => ({ tag:el.tagName.toLowerCase(), role:el.getAttribute('role'), tabIndex:el.tabIndex }));
  if (!tab.reached) {
    return result(false, { method:'Playwright real Tab/Enter/Space interaction', ...attributes, tabReachable:false, tabPath:tab.path, enterActivated:null, spaceActivated:null, reason:'Target was skipped during sequential Tab navigation.' });
  }
  await page.keyboard.press('Enter');
  const enterActivated = await target.evaluate(el => el.dataset.activated === 'true');
  await target.evaluate(el => { delete el.dataset.activated; });
  await page.keyboard.press('Space');
  const spaceActivated = await target.evaluate(el => el.dataset.activated === 'true');
  return result(tab.reached && enterActivated && spaceActivated, {
    method:'Playwright real Tab/Enter/Space interaction', ...attributes,
    tabReachable:tab.reached, tabPath:tab.path, enterActivated, spaceActivated,
    expected:'The target is reachable with Tab and activates with Enter and Space.'
  });
}

async function verifyFocusOrder(page) {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') active.blur();
  });
  const sequence=[];
  const tabPath=[];
  for(let i=0;i<25 && sequence.length<3;i++) {
    await page.keyboard.press('Tab');
    const focused=await page.evaluate(()=>{
      const el=document.activeElement;
      return {id:el?.id||'',tag:el?.tagName?.toLowerCase()||'',text:(el?.innerText||el?.textContent||'').trim().slice(0,80)};
    });
    tabPath.push(focused);
    if(/^step-[123]$/.test(focused.id) && !sequence.includes(focused.id)) sequence.push(focused.id);
  }
  const expected=['step-1','step-2','step-3'];
  return result(JSON.stringify(sequence)===JSON.stringify(expected), {
    method:'Playwright real sequential Tab navigation', observedFocusOrder:sequence,
    expectedFocusOrder:expected, fullTabPath:tabPath,
    tabindexValues:await page.locator('#fixture button[id^="step-"]').evaluateAll(els=>els.map(el=>({id:el.id,tabIndex:el.tabIndex})))
  });
}

async function evaluateDOM(page, item) {
  try {
    const evidence = await page.evaluate(({check,caseId}) => {
      const root = document.querySelector('#fixture');
      const one = s => root.querySelector(s);
      const text = el => (el?.innerText || el?.textContent || '').trim();
      const attr = (el,n) => el?.getAttribute(n);
      switch(check) {
        case 'image-alt': { const e=one('img'); return {pass:!!e && e.hasAttribute('alt') && !!attr(e,'alt').trim(), detail:{alt:attr(e,'alt'),present:!!e?.hasAttribute('alt')}}; }
        case 'input-label': { const e=one('input'); if(!e) return {pass:false,detail:'input missing'}; const id=e.id; const labelled=!!(id && [...root.querySelectorAll('label[for]')].some(l=>l.htmlFor===id && text(l))) || !!e.closest('label') && !!text(e.closest('label')) || !!attr(e,'aria-label')?.trim() || !!(attr(e,'aria-labelledby')?.trim() && attr(e,'aria-labelledby').trim().split(/\s+/).some(ref=>{const target=document.getElementById(ref);return target && text(target);})); return {pass:labelled,detail:{id,labels:[...root.querySelectorAll('label')].map(text),ariaLabel:attr(e,'aria-label'),ariaLabelledby:attr(e,'aria-labelledby')}}; }
        case 'button-name': { const e=one('button'); const name=text(e)||attr(e,'aria-label')?.trim()||attr(e,'title')?.trim(); return {pass:!!name,detail:{text:text(e),ariaLabel:attr(e,'aria-label'),title:attr(e,'title')}}; }
        case 'link-name': { const e=one('a'); const name=text(e)||attr(e,'aria-label')?.trim()||attr(e,'title')?.trim(); return {pass:!!name,detail:{text:text(e),ariaLabel:attr(e,'aria-label')}}; }
        case 'heading': { const e=one('h1,h2,h3,h4,h5,h6,[role="heading"]'); return {pass:!!e,detail:{tag:e?.tagName,role:attr(e,'role'),ariaLevel:attr(e,'aria-level'),text:text(e)}}; }
        case 'document-title': return {pass:!!document.title.trim(),detail:{title:document.title}};
        case 'label-in-name': { const e=one('#label-name-target'); const visible=text(e); const accessible=attr(e,'aria-label')?.trim()||visible; return {pass:!!visible && accessible.toLocaleLowerCase().includes(visible.toLocaleLowerCase()),detail:{visibleLabel:visible,ariaLabel:attr(e,'aria-label'),accessibleNameCandidate:accessible}}; }
        case 'keyboard-operability': return {pass:true,detail:'Keyboard activation is verified by the Playwright runner.'};
        case 'focus-order': { const controls=[...root.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(e=>!e.disabled && e.tabIndex>=0); const positive=controls.filter(e=>e.tabIndex>0).sort((a,b)=>a.tabIndex-b.tabIndex); const normal=controls.filter(e=>e.tabIndex===0); const sequence=[...positive,...normal].map(e=>e.id); const expected=['step-1','step-2','step-3']; return {pass:JSON.stringify(sequence)===JSON.stringify(expected),detail:{observedTabSequence:sequence,expectedLogicalSequence:expected,tabIndexValues:controls.map(e=>({id:e.id,tabIndex:e.tabIndex}))}}; }
        case 'table-headers': { const e=one('table'); const headers=e?[...e.querySelectorAll('th')]:[]; return {pass:headers.length>0,detail:{thCount:headers.length,tdCount:e?.querySelectorAll('thead td').length||0}}; }
        case 'list-semantics': { const e=one('ul,ol'); return {pass:!!e && attr(e,'role')!=='presentation' && attr(e,'role')!=='none',detail:{tag:e?.tagName,role:attr(e,'role')}}; }
        case 'tab-state': { const e=one('#tab-two'); return {pass:attr(e,'role')==='tab' && attr(e,'aria-selected')==='true',detail:{role:attr(e,'role'),selected:attr(e,'aria-selected')}}; }
        case 'disclosure-state': { const e=one('#disclosure'); return {pass:attr(e,'aria-expanded')==='true',detail:{expanded:attr(e,'aria-expanded')}}; }
        case 'dialog-name': { const e=one('dialog'); const labelledby=attr(e,'aria-labelledby'); const labelledText=labelledby ? labelledby.split(/\\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim() : ''; const name=attr(e,'aria-label')?.trim()||labelledText||attr(e,'title')?.trim(); return {pass:!!name,detail:{role:attr(e,'role'),ariaLabel:attr(e,'aria-label'),labelledby,labelledText,title:attr(e,'title')}}; }
        case 'status-role': { const e=one('#status-message'); const role=attr(e,'role'); const live=attr(e,'aria-live'); return {pass:role==='status'||role==='alert'||live==='polite'||live==='assertive',detail:{role,ariaLive:live,text:text(e)}}; }
        default: return {notTestable:true,detail:`No DOM rule for ${check}`};
      }
    }, {check:item.check,caseId:item.caseId});
    if(evidence.notTestable) return {observedResult:'NOT_TESTABLE',evidence:evidence.detail,notTestableReason:'No implemented DOM rule for this condition.'};
    if (item.check === 'keyboard-operability') return await verifyKeyboardOperability(page);
    if (item.check === 'focus-order') return await verifyFocusOrder(page);
    return result(evidence.pass,evidence.detail);
  } catch (error) {
    return {observedResult:'NOT_TESTABLE',evidence:null,notTestableReason:`DOM evidence extraction failed: ${error.message}`};
  }
}
module.exports = { evaluateDOM, tabToTarget, verifyKeyboardOperability, verifyFocusOrder };
