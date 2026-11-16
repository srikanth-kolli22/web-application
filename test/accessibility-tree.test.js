'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAccessibilityTree } = require('../src/engines/accessibility-tree');

function axNode(nodeId, backendDOMNodeId, role, name, extras = {}) {
  return { nodeId: String(nodeId), backendDOMNodeId, role: { value: role }, name: { value: name, sources: extras.sources || [] }, properties: extras.properties || [], parentId: extras.parentId };
}
function mockCDP(selectorBackendId, nodes) {
  return {
    async send(method, args) {
      if (method === 'Accessibility.getFullAXTree') return { nodes };
      if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
      if (method === 'DOM.querySelectorAll') return { nodeIds: [2] };
      if (method === 'DOM.describeNode') return { node: { backendNodeId: selectorBackendId } };
      throw new Error(`Unexpected CDP method ${method}`);
    }
  };
}
const item = (check, config = {}) => ({ check, config });

test('button-name evaluates the fixture button, not the unrelated reset button', async () => {
  const nodes = [
    axNode(1, 11, 'button', 'Reset scenario'),
    axNode(2, 22, 'button', '')
  ];
  const result = await evaluateAccessibilityTree({}, item('button-name', { text: '', aria: null, title: null }), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'FAIL');
  assert.equal(result.evidence.nodes.length, 1);
  assert.equal(result.evidence.nodes[0].name, '');
});

test('link-name does not pass because unrelated page links have names', async () => {
  const nodes = [axNode(1, 11, 'link', 'Dashboard'), axNode(2, 22, 'link', '')];
  const result = await evaluateAccessibilityTree({}, item('link-name', { text: '', aria: null }), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'FAIL');
  assert.equal(result.evidence.nodes.length, 1);
});

test('input-label rejects a placeholder-derived accessible name', async () => {
  const nodes = [axNode(1, 22, 'textbox', 'Email address', { sources: [{ type: 'placeholder', attribute: 'placeholder' }] })];
  const result = await evaluateAccessibilityTree({}, item('input-label', { placeholder: 'Email address' }), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'FAIL');
  assert.equal(result.evidence.placeholderOnlyName, true);
});

test('input-label accepts a non-placeholder accessible name', async () => {
  const nodes = [axNode(1, 22, 'textbox', 'Email address', { sources: [{ type: 'relatedElement', nativeSource: 'label' }, { type: 'placeholder', attribute: 'placeholder', superseded: true }] })];
  const result = await evaluateAccessibilityTree({}, item('input-label', { placeholder: 'name@example.com' }), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'PASS');
});

test('heading check ignores an unrelated page heading', async () => {
  const nodes = [axNode(1, 11, 'heading', 'Scenario under test')];
  const result = await evaluateAccessibilityTree({}, item('heading', { text: 'Account settings' }), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'FAIL');
  assert.equal(result.evidence.nodes.length, 0);
});

test('list check ignores unrelated navigation lists', async () => {
  const nodes = [axNode(1, 11, 'list', '', { parentId: '9' }), axNode(2, 12, 'listitem', 'Home', { parentId: '1' })];
  const result = await evaluateAccessibilityTree({}, item('list-semantics'), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'FAIL');
  assert.equal(result.evidence.nodes.length, 0);
});

test('list check accepts the fixture list with list items', async () => {
  const nodes = [axNode(1, 22, 'list', '', { parentId: '9' }), axNode(2, 23, 'listitem', 'First item', { parentId: '1' })];
  const result = await evaluateAccessibilityTree({}, item('list-semantics'), mockCDP(22, nodes));
  assert.equal(result.observedResult, 'PASS');
});

test('DOM-only keyboard and focus-order checks remain NOT_TESTABLE in AX engine', async () => {
  const result = await evaluateAccessibilityTree({}, { check:'keyboard-operability', detectionClass:'DOM_ONLY', config:{} }, mockCDP(22, []));
  assert.equal(result.observedResult, 'NOT_TESTABLE');
  assert.match(result.notTestableReason, /keyboard interaction/);
});

test('Label in Name compares the computed AX name with the fixture visible label', async () => {
  const nodes = [axNode(1, 22, 'button', 'Save')];
  const result = await evaluateAccessibilityTree({}, { check:'label-in-name', detectionClass:'BOTH', config:{visible:'Save'} }, mockCDP(22, nodes));
  assert.equal(result.observedResult, 'PASS');
});
