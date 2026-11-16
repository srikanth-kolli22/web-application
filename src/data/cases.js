'use strict';

// Expected labels are provisional fixture hypotheses, not validated ground truth.
// Detection class records which evidence source can legitimately assess the condition.
const allFamilies = [
  { id:'TC01', name:'Image text alternatives', wcag:'1.1.1', target:'img', check:'image-alt', detectionClass:'BOTH', description:'Check that informative images expose a non-empty text alternative.', variants:{ D1:{alt:null}, D2:{alt:''}, C:{alt:'Quarterly sales chart'} } },
  { id:'TC02', name:'Form labels', wcag:'1.3.1; 3.3.2', target:'input', check:'input-label', detectionClass:'BOTH', description:'Check programmatic labelling of a text input; placeholder text alone is not treated as a persistent label.', variants:{ D1:{label:null,placeholder:'Email address'}, D2:{label:'',placeholder:'Email address'}, C:{label:'Email address',placeholder:'name@example.com'} } },
  { id:'TC03', name:'Button accessible names', wcag:'4.1.2', target:'button', check:'button-name', detectionClass:'BOTH', description:'Check that an action button has a non-empty accessible name.', variants:{ D1:{text:'',aria:null,title:null}, D2:{text:'',aria:'',title:null}, C:{text:'Save changes',aria:null,title:null} } },
  { id:'TC04', name:'Link accessible name', wcag:'4.1.2', target:'a', check:'link-name', detectionClass:'BOTH', description:'Check that a link exposes a non-empty accessible name; this does not establish full link purpose in context.', variants:{ D1:{text:'',aria:null,href:'#details'}, D2:{text:'',aria:'',href:'#details'}, C:{text:'View details',aria:null,href:'#details'} } },
  { id:'TC05', name:'Heading structure', wcag:'1.3.1', target:'heading', check:'heading', detectionClass:'BOTH', description:'Check that the scenario exposes a semantic heading rather than plain text.', variants:{ D1:{tag:'div',role:null,text:'Account settings'}, D2:{tag:'p',role:null,text:'Account settings'}, C:{tag:'h2',role:null,text:'Account settings'} } },
  { id:'TC06', name:'Document title', wcag:'2.4.2', target:'document', check:'document-title', detectionClass:'BOTH', description:'Check for a meaningful non-empty document title.', variants:{ D1:{title:''}, D2:{title:' '}, C:{title:'Profile settings – Test Bed'} } },
  { id:'TC07', name:'Label in Name', wcag:'2.5.3', target:'button', check:'label-in-name', detectionClass:'BOTH', description:'Check that the accessible name contains the visible label text for a speech-input-compatible button.', variants:{ D1:{visible:'Save',aria:'Submit request'}, D2:{visible:'Save',aria:'Send form'}, C:{visible:'Save',aria:'Save'} } },
  { id:'TC08', name:'Keyboard operability', wcag:'2.1.1', target:'button', check:'keyboard-operability', detectionClass:'DOM_ONLY', description:'Check that the control can receive keyboard focus and be activated with Enter; this is a bounded keyboard-operability test, not a complete audit of all keyboard interactions.', variants:{ D1:{element:'button',tabIndex:-1,keyboardHandler:true}, D2:{element:'div',role:'button',tabIndex:0,keyboardHandler:false}, C:{element:'button',tabIndex:0,keyboardHandler:true} } },
  { id:'TC09', name:'Table header semantics', wcag:'1.3.1', target:'table', check:'table-headers', detectionClass:'BOTH', description:'Check that data table column headers use header cells.', variants:{ D1:{headers:false,caption:'Quarterly results'}, D2:{headers:'td',caption:'Quarterly results'}, C:{headers:'th',caption:'Quarterly results'} } },
  { id:'TC10', name:'List semantics', wcag:'1.3.1', target:'list', check:'list-semantics', detectionClass:'BOTH', description:'Check that a group of related items is represented as a semantic list.', variants:{ D1:{tag:'div',role:null}, D2:{tag:'ul',role:'presentation'}, C:{tag:'ul',role:null} } },
  { id:'TC11', name:'Tab selected state', wcag:'4.1.2', target:'tab', check:'tab-state', detectionClass:'BOTH', description:'Open the tabs scenario and check selected-state exposure.', interaction:['click:#tab-two'], variants:{ D1:{role:'tab',selected:null}, D2:{role:'tab',selected:'false'}, C:{role:'tab',selected:'true'} } },
  { id:'TC12', name:'Disclosure expanded state', wcag:'4.1.2', target:'disclosure', check:'disclosure-state', detectionClass:'BOTH', description:'Open the disclosure scenario and check expanded-state exposure.', interaction:['click:#disclosure'], variants:{ D1:{expanded:null}, D2:{expanded:'false'}, C:{expanded:'true'} } },
  { id:'TC13', name:'Dialog accessible name', wcag:'4.1.2', target:'dialog', check:'dialog-name', detectionClass:'BOTH', description:'Open the dialog and check its accessible name.', interaction:['click:#open-dialog'], variants:{ D1:{role:'dialog',label:null,title:null}, D2:{role:'dialog',label:'',title:null}, C:{role:'dialog',label:'Preferences',title:null} } },
  { id:'TC14', name:'Status message semantics', wcag:'4.1.3', target:'status', check:'status-role', detectionClass:'BOTH', description:'Submit the form and inspect the status message semantics.', interaction:['click:#submit-status'], variants:{ D1:{role:null,live:null,text:'Saved'}, D2:{role:'generic',live:'off',text:'Saved'}, C:{role:'status',live:'polite',text:'Saved'} } },
  { id:'TC15', name:'Focus order', wcag:'2.4.3', target:'focus-sequence', check:'focus-order', detectionClass:'DOM_ONLY', description:'Check whether sequential keyboard focus follows the documented logical order of the three related controls. The Accessibility Tree alone does not establish actual keyboard tab order.', variants:{ D1:{order:[2,1,3]}, D2:{order:[1,3,2]}, C:{order:[0,0,0]} } }
];

// Interim submission scope: TC01-TC08 only (8 families x D1/D2/C = 24 variants).
const families = allFamilies.slice(0, 8);

const cases = [];
for (const f of families) for (const variant of ['D1','D2','C']) {
  const v = f.variants[variant];
  cases.push({
    caseId:`${f.id}-${variant}`, familyId:f.id, family:f.name, variant,
    wcag:f.wcag, check:f.check, target:f.target, detectionClass:f.detectionClass,
    description:f.description, interaction:f.interaction || [], config:v,
    expectedLabel:variant === 'C' ? 'PASS' : 'FAIL',
    groundTruthStatus:'UNVERIFIED',
    groundTruthNote:'Provisional fixture intention only. Requires independent manual verification against the mapped WCAG 2.2 criterion.'
  });
}
module.exports = { families, cases };
