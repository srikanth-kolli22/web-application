'use strict';

// The Accessibility Tree engine uses CDP's DOM domain only to bind a fixture
// target to its backend node identity. All pass/fail evidence comes exclusively
// from Accessibility.getFullAXTree (never from DOM attributes or text).

const valueOf = x => x && typeof x === 'object' && 'value' in x ? x.value : x;
function prop(node, name) {
  const p = (node?.properties || []).find(x => x.name === name);
  return p ? valueOf(p.value) : undefined;
}
function role(node) { return String(valueOf(node?.role) ?? '').toLowerCase(); }
function name(node) { return String(valueOf(node?.name) ?? '').trim(); }
function nodeSummary(n) {
  return {
    role: role(n), name: name(n),
    nameSources: (n?.name?.sources || []).map(s => ({
      type: s.type, attribute: s.attribute, nativeSource: s.nativeSource,
      superseded: s.superseded,
      relatedNodes: (s.relatedNodes || []).map(r => ({ text: r.text, idref: r.idref }))
    })),
    description: valueOf(n?.description),
    properties: (n?.properties || []).map(p => ({ name: p.name, value: valueOf(p.value) }))
  };
}

async function backendNodeIdsForSelector(cdp, selector) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeIds = [] } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
  const backendIds = [];
  for (const nodeId of nodeIds) {
    const described = await cdp.send('DOM.describeNode', { nodeId });
    if (described.node?.backendNodeId) backendIds.push(described.node.backendNodeId);
  }
  return backendIds;
}

function descendantsOf(rootNode, nodes) {
  if (!rootNode) return [];
  const byParent = new Map();
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (!byParent.has(node.parentId)) byParent.set(node.parentId, []);
    byParent.get(node.parentId).push(node);
  }
  const found = [];
  const queue = [rootNode.nodeId];
  const seen = new Set(queue);
  while (queue.length) {
    const parent = queue.shift();
    for (const child of byParent.get(parent) || []) {
      if (seen.has(child.nodeId)) continue;
      seen.add(child.nodeId);
      found.push(child);
      queue.push(child.nodeId);
    }
  }
  return found;
}

async function evaluateAccessibilityTree(page, item, cdp) {
  if (item.detectionClass === 'DOM_ONLY') {
    return { observedResult: 'NOT_TESTABLE', evidence: { method: 'Accessibility.getFullAXTree', limitation: item.check, detectionClass: item.detectionClass }, notTestableReason: `The registered rule (${item.check}) requires keyboard interaction or sequential focus evidence that the Accessibility Tree alone does not establish. It is deliberately classified as DOM-only rather than inferred from AX node order.` };
  }

  try {
    const response = await cdp.send('Accessibility.getFullAXTree');
    const nodes = response.nodes || [];
    if (!nodes.length) return { observedResult: 'NOT_TESTABLE', evidence: { method: 'Accessibility.getFullAXTree', nodeCount: 0 }, notTestableReason: 'Chromium returned an empty Accessibility Tree.' };

    const byBackendId = new Map(nodes.filter(n => n.backendDOMNodeId).map(n => [n.backendDOMNodeId, n]));
    const targetSelectors = {
      'image-alt': '#fixture img',
      'heading': '#fixture h1, #fixture h2, #fixture h3, #fixture h4, #fixture h5, #fixture h6, #fixture [role="heading"]',
      'list-semantics': '#fixture ul, #fixture ol, #fixture [role="list"]',
      'input-label': '#fixture input',
      'button-name': '#fixture button',
      'label-in-name': '#fixture #label-name-target',
      'link-name': '#fixture a',
      'tab-state': '#fixture #tab-two',
      'disclosure-state': '#fixture #disclosure',
      'dialog-name': '#fixture #preferences',
      'status-role': '#fixture #status-message',
      'table-headers': '#fixture table'
    };
    let targets = [];
    const selector = targetSelectors[item.check];
    if (selector) {
      const backendIds = await backendNodeIdsForSelector(cdp, selector);
      targets = backendIds.map(id => byBackendId.get(id)).filter(Boolean);
    }

    let pass = false;
    const evidence = { method: 'Accessibility.getFullAXTree', nodeCount: nodes.length, targetSelector: selector || null };
    const target = targets[0];

    switch (item.check) {
      case 'image-alt': {
        const n = target;
        pass = !!n && role(n) === 'image' && !!name(n);
        evidence.nodes = targets.map(nodeSummary);
        break;
      }
      case 'input-label': {
        const n = target;
        if (!n) return { observedResult: 'NOT_TESTABLE', evidence, notTestableReason: 'The target input could not be bound to an Accessibility Tree node.' };
        const accessibleName = name(n);
        const sources = n.name?.sources || [];
        const activePlaceholder = sources.some(s => s.type === 'placeholder' && s.superseded !== true);
        // A placeholder-derived name is not a persistent programmatic label.
        const placeholderOnly = activePlaceholder && accessibleName === String(item.config.placeholder || '').trim();
        pass = role(n) === 'textbox' || role(n) === 'searchbox' || role(n) === 'combobox'
          ? !!accessibleName && !placeholderOnly
          : false;
        evidence.nodes = [nodeSummary(n)];
        evidence.placeholderOnlyName = placeholderOnly;
        break;
      }
      case 'button-name':
      case 'link-name': {
        const n = target;
        const expectedRole = item.check === 'button-name' ? 'button' : 'link';
        pass = !!n && role(n) === expectedRole && !!name(n);
        evidence.nodes = targets.map(nodeSummary);
        evidence.targetName = n ? name(n) : null;
        break;
      }
      case 'label-in-name': {
        const n = target;
        const visibleLabel = String(item.config.visible || '').trim();
        const computedName = name(n);
        pass = !!n && role(n) === 'button' && !!visibleLabel && computedName.toLocaleLowerCase().includes(visibleLabel.toLocaleLowerCase());
        evidence.nodes = targets.map(nodeSummary);
        evidence.visibleLabelFromFixtureSpecification = visibleLabel;
        evidence.computedAccessibleName = computedName;
        break;
      }
      case 'heading': {
        const expected = String(item.config.text || '').trim();
        const n = target;
        pass = !!n && role(n) === 'heading' && !!name(n);
        evidence.targetExpectedName = expected;
        evidence.nodes = targets.map(nodeSummary);
        evidence.targetName = n ? name(n) : null;
        break;
      }
      case 'document-title': {
        const root = nodes.find(n => role(n) === 'rootwebarea');
        pass = !!root && !!name(root);
        evidence.root = nodeSummary(root || {});
        break;
      }
      case 'table-headers': {
        const table = target;
        if (!table) return { observedResult: 'NOT_TESTABLE', evidence, notTestableReason: 'The table target could not be identified in the Accessibility Tree.' };
        const withinTable = descendantsOf(table, nodes);
        const headers = withinTable.filter(n => ['columnheader', 'rowheader'].includes(role(n)));
        pass = headers.length > 0;
        evidence.table = nodeSummary(table);
        evidence.headers = headers.map(nodeSummary);
        break;
      }
      case 'list-semantics': {
        // Bind only to the list element inside the fixture; unrelated navigation lists
        // must never make a defective scenario pass. A presentational list may have
        // no AX node, in which case the fixture correctly fails this semantic check.
        const n = target;
        pass = !!n && role(n) === 'list' && descendantsOf(n, nodes).some(child => role(child) === 'listitem');
        evidence.nodes = targets.map(nodeSummary);
        evidence.targetRole = n ? role(n) : null;
        break;
      }
      case 'tab-state': {
        const n = target;
        pass = !!n && role(n) === 'tab' && prop(n, 'selected') === true;
        evidence.nodes = targets.map(nodeSummary);
        break;
      }
      case 'disclosure-state': {
        const n = target;
        pass = !!n && role(n) === 'button' && prop(n, 'expanded') === true;
        evidence.nodes = targets.map(nodeSummary);
        break;
      }
      case 'dialog-name': {
        const n = target;
        pass = !!n && role(n) === 'dialog' && !!name(n);
        evidence.nodes = targets.map(nodeSummary);
        break;
      }
      case 'status-role': {
        const n = target;
        pass = !!n && ['status', 'alert'].includes(role(n));
        evidence.nodes = targets.map(nodeSummary);
        break;
      }
      default:
        return { observedResult: 'NOT_TESTABLE', evidence, notTestableReason: `No Accessibility Tree rule implemented for ${item.check}.` };
    }

    return { observedResult: pass ? 'PASS' : 'FAIL', evidence, notTestableReason: '' };
  } catch (error) {
    return { observedResult: 'NOT_TESTABLE', evidence: { method: 'Accessibility.getFullAXTree' }, notTestableReason: `CDP Accessibility Tree extraction failed: ${error.message}` };
  }
}

module.exports = { evaluateAccessibilityTree };
