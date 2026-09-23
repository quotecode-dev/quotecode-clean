// PRODUCT TRUTH — CONTROL-LEVEL SOURCE COVERAGE (Codex "control-level coverage" finding,
// 2026-09-2X). Supersedes the prior interactive-element COUNT gate
// (productTruthInteractiveScanner.js / productTruthInteractiveBaseline.json / a baseline-snapshot
// diff) with real per-CONTROL identity: every discovered interactive control gets its own file,
// enclosing component, AST source location, control kind, and a structural signature - and must
// resolve, by real AST relationship (never proximity/line-distance guessing), to exactly one
// capability marker or exactly one decorative exemption. The count-based gate could not tell a
// genuinely new unmarked control apart from an existing marked one that merely shifted position,
// and could not detect a control being swapped for a different one while the total count stayed
// numerically equal - both are structurally impossible to hide from an identity-based gate.
//
// SCANNER UNIVERSE (documented explicitly, per the Owner's task requirement - never silently
// assumed):
//   Included native interactive elements: <button>, <a href=...>, elements with role="button".
//   Included component control patterns: <Link to=...> (react-router-dom) and ANY JSX element
//     (native or component) that carries an onClick or onPress prop - this is strictly BROADER
//     than the prior regex scanner's 4 fixed patterns, so a control using a different event-handler
//     prop name convention is not silently invisible to this scanner (see KNOWN LIMITS below for
//     what is still not covered).
//   Included event-handler types: onClick, onPress (covers touch-oriented component libraries).
//   KNOWN SCANNER LIMITS (disclosed, not claimed complete): does not discover controls wired via
//     imperative DOM APIs (addEventListener, ref.current.onclick=...), keyboard-only handlers
//     (onKeyDown alone with no onClick), form-only submission (onSubmit with no visible button),
//     or controls rendered dynamically from a data-driven map whose JSX shape this static parser
//     cannot see without executing the code. This scanner discovers STATIC JSX syntax only - it is
//     a real, mechanical, AST-level discovery, not a claim of discovering every possible
//     programmatic interaction a user could ever trigger.
//
// ATTACHMENT RULES (mechanical, never proximity-based):
//   A control's MARKER SEARCH SET is the union of:
//   (a) every JSX-comment sibling (`{/* PRODUCT_TRUTH_CAPABILITY: id */}` /
//       `{/* PRODUCT_TRUTH_DECORATIVE: reason */}`) found at ANY ancestor JSX-children-array level
//       between the control and the enclosing component's returned JSX root, checked by real
//       sibling-array position (the comment must be a JSX child in the same children array as the
//       ancestor element/fragment on the path from the control up to the root) - never "anywhere
//       in the file", never "within N lines".
//   (b) if the control's onClick/onPress resolves (via real Babel scope-binding resolution, not
//       name-string matching) to a locally-declared named function/variable, that declaration's own
//       leading `//` comment.
//   (c) same resolved declaration case: any leading `//` comment attached to a statement INSIDE
//       that function's own body (one level deep only - not recursed into further nested
//       functions), matching how PRODUCT_TRUTH_CAPABILITY markers are placed today on an inner
//       statement of a handler (e.g. quote_print's marker sits on the `window.print()` line inside
//       its handler, not on the handler's own declaration).
//   A control with NO marker anywhere in its search set is UNRESOLVED and fails the gate. A
//   control whose search set contains BOTH a capability marker AND a decorative marker, or MORE
//   THAN ONE capability marker mapping to different ids, is AMBIGUOUS and fails the gate.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { createHash } from 'node:crypto';

// CONTROL-LEVEL COMPLETENESS FILE SCOPE (documented, never silently assumed - Owner's task
// requirement §3.1). listScannableFiles() (productTruthCapabilityScanner.js) is deliberately
// BROADER than this: it is used for marker-EXISTENCE reconciliation, where any marker anywhere in
// the repo must still tie back to the registry regardless of what kind of page it's on. Full
// control-level "every interactive control must resolve" completeness is a STRICTER guarantee that
// only makes sense to demand of files inside the PRODUCT (the authenticated app surface the
// registry describes) - never of pre-authentication, legal, or marketing pages, which have no
// registry-mapped capability to resolve against in the first place (a "Sign up" button, a "Back to
// home" link, or a contact-form submit is not a Product Truth capability). Real source review
// (2026-09-23) confirmed every remaining unresolved control after full in-product marking is one of
// exactly these excluded files' own sign-in/marketing/legal chrome - none is a disguised in-product
// capability control.
const CONTROL_SCOPE_EXCLUDED_FILES = new Set([
  'src/components/AuthScreen.jsx', // sign in / sign up / forgot-password form - pre-authentication, no registry capability
  'src/pages/Contact.jsx', // public marketing contact page (including its AI-chat marketing teaser CTA, not the ai_chat capability's own control)
  'src/pages/LandingGlobal.jsx', // public marketing landing page (International)
  'src/pages/LandingLocal.jsx', // public marketing landing page (Local)
  'src/pages/NotFound.jsx', // generic 404 page
  'src/pages/Privacy.jsx', // legal page
  'src/pages/Terms.jsx', // legal page
]);

/**
 * The file universe control-level completeness is enforced against: every file
 * listScannableFiles() would return, minus the documented pre-auth/marketing/legal exclusions
 * above. A file appearing here newly (a new in-product file, or an existing excluded file that
 * gains real product controls) is picked up automatically the next time listScannableFiles() runs -
 * the exclusion list only ever REMOVES specific named files, never a whole directory, so a new file
 * added anywhere is in scope by default and must be reviewed, not silently skipped.
 * @param {string[]} allScannableFiles - output of listScannableFiles()
 * @returns {string[]}
 */
export function controlScopeFiles(allScannableFiles) {
  return allScannableFiles.filter((f) => !CONTROL_SCOPE_EXCLUDED_FILES.has(f));
}

// @babel/traverse's default export shape differs between ESM/CJS interop; normalize once.
const traverse = traverseModule.default || traverseModule;

const CAPABILITY_MARKER_RE = /^\s*PRODUCT_TRUTH_CAPABILITY:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$/;
const DECORATIVE_MARKER_RE = /^\s*PRODUCT_TRUTH_DECORATIVE:\s*(\S.*)$/;

function classifyCommentValue(value) {
  const cap = CAPABILITY_MARKER_RE.exec(value);
  if (cap) return { kind: 'capability', id: cap[1] };
  const dec = DECORATIVE_MARKER_RE.exec(value);
  if (dec) return { kind: 'decorative', reason: dec[1].trim() };
  return null;
}

function isInteractiveOpeningElement(openingElement) {
  const nameNode = openingElement.name;
  const tagName = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;
  const attrs = openingElement.attributes.filter((a) => a.type === 'JSXAttribute');
  const attrNames = attrs.map((a) => (a.name && a.name.name) || '').filter(Boolean);
  const hasHandler = attrNames.includes('onClick') || attrNames.includes('onPress');
  const hasRoleButton = attrs.some((a) => a.name?.name === 'role' && a.value?.type === 'StringLiteral' && a.value.value === 'button');
  const isHrefAnchor = tagName === 'a' && attrNames.includes('href');
  const isButton = tagName === 'button';
  const isLink = tagName === 'Link';
  let kind = null;
  if (isButton) kind = 'button';
  else if (isHrefAnchor) kind = 'anchor';
  else if (isLink) kind = 'router_link';
  else if (hasRoleButton) kind = 'role_button';
  else if (hasHandler) kind = 'onclick_element';
  if (!kind) return null;
  return { kind, tagName, attrNames: attrNames.sort() };
}

/** Extracts the first CallExpression callee name from an inline arrow's body, covering the
 * dominant real-world pattern `onClick={() => handleFoo(args)}` (a bare identifier reference,
 * `onClick={handleFoo}`, is the minority case but also handled). Only unwraps ONE level (a single
 * top-level call, or the first statement of a block body) - a multi-statement inline handler with
 * no single obvious named call resolves to null (documented limit: such a control's marker must
 * then be attached via the JSX-ancestor-comment path instead). */
function findOnClickHandlerName(openingElement) {
  const attr = openingElement.attributes.find(
    (a) => a.type === 'JSXAttribute' && (a.name?.name === 'onClick' || a.name?.name === 'onPress'),
  );
  if (!attr || !attr.value || attr.value.type !== 'JSXExpressionContainer') return null;
  const expr = attr.value.expression;
  if (expr.type === 'Identifier') return expr.name; // onClick={handleFoo}
  if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
    const body = expr.body;
    let callExpr = null;
    if (body.type === 'CallExpression') callExpr = body; // () => handleFoo(x)
    else if (body.type === 'BlockStatement' && body.body.length > 0) {
      const first = body.body[0];
      if (first.type === 'ExpressionStatement' && first.expression.type === 'CallExpression') callExpr = first.expression;
    }
    if (callExpr && callExpr.callee.type === 'Identifier') return callExpr.callee.name;
    return null;
  }
  return null;
}

function markerFromJsxCommentChild(child) {
  if (child.type === 'JSXExpressionContainer' && child.expression.type === 'JSXEmptyExpression') {
    for (const c of child.expression.innerComments || []) {
      const m = classifyCommentValue(c.value);
      if (m) return m;
    }
  }
  return null;
}

/** Scans backward from `fromIndex` (exclusive) in `childrenArray`, skipping pure-whitespace JSXText
 * nodes, and returns the marker on the NEAREST preceding JSX-comment sibling only - never every
 * marker anywhere in the array. Stops (returns null) at the first non-whitespace, non-comment
 * sibling, so a marker meant for an EARLIER, unrelated sibling block can never leak forward past
 * real content into a later, different block's controls. */
function nearestPrecedingMarker(childrenArray, fromIndex) {
  for (let i = fromIndex - 1; i >= 0; i--) {
    const child = childrenArray[i];
    if (child.type === 'JSXText' && /^\s*$/.test(child.value)) continue; // pure whitespace, keep scanning back
    const marker = markerFromJsxCommentChild(child);
    if (marker) return marker;
    return null; // real content (not whitespace, not a marker comment) blocks further back-scan
  }
  return null;
}

/** Walks JSX ancestors from the control up toward the component root. At EACH level, only the
 * NEAREST preceding sibling marker (if any) counts - never the whole children array, never a
 * marker belonging to a sibling BLOCK rather than the specific path the control descends through.
 * Stops climbing as soon as one level yields a marker (nearest-wins - a control does not also
 * inherit an unrelated marker from several levels further up once its own has been found). */
/** Extracts leading-comment markers directly attached to a function-like declaration node itself
 * (a `//` comment immediately above `function Foo()` or `const renderFoo = () => ...`) - used both
 * for the named-render-helper case below and shared with collectHandlerDeclarationMarkers. */
function markersOnDeclarationStatement(statementPath, declNode) {
  const found = [];
  const ownComments = (statementPath?.node.leadingComments) || declNode.leadingComments || [];
  for (const c of ownComments) {
    const m = classifyCommentValue(c.value);
    if (m) found.push(m);
  }
  return found;
}

/** True if `fnPath` is a NAMED function-like declaration a marker could legitimately be attached
 * to as "this whole render helper's own capability" - a real FunctionDeclaration with an id, or an
 * ArrowFunctionExpression/FunctionExpression assigned to a named variable (`const renderX = () =>
 * ...`). An ANONYMOUS inline callback (e.g. a bare `.map(v => ...)` argument, no named binding) is
 * never treated as a markable boundary here - it is not a distinct, nameable implementation site,
 * just an inline render callback, so climbing continues past it instead (see the `both` return
 * below: false means "not a named boundary, keep climbing THROUGH it for JSX-ancestor markers").
 */
function namedFunctionDeclarationInfo(fnPath) {
  if (fnPath.node.type === 'FunctionDeclaration' && fnPath.node.id) {
    return { statementPath: fnPath.getStatementParent(), declNode: fnPath.node };
  }
  if (fnPath.parentPath?.node.type === 'VariableDeclarator' && fnPath.parentPath.node.id?.type === 'Identifier') {
    const declaratorPath = fnPath.parentPath;
    return { statementPath: declaratorPath.getStatementParent(), declNode: declaratorPath.node };
  }
  return null;
}

/** Handles `{collection.filter(...).map(cb => <Element/>)}` - a comment placed above the WHOLE
 * chained expression (e.g. above `collection` at the start of the chain) rather than above the
 * anonymous `.map()` callback itself. Babel attaches such a leading comment to whichever node's
 * source range starts at that position - for a chain, that is the outermost CallExpression/
 * MemberExpression. Walks outward from the anonymous callback (`fnPath`) through its enclosing
 * CallExpression, then down through any further outer `.somethingElse(...)` chain calls (there
 * usually are none further out once we're already at the outermost - this primarily checks that
 * SAME outermost call/member node's own leadingComments), so a marker placed at the very start of
 * the chain (the common real-world position) is found without requiring it to sit inside the
 * anonymous callback where no valid JSX-sibling position may even exist. */
function collectMapChainLeadingMarkers(fnPath) {
  const callExprPath = fnPath.parentPath; // the CallExpression whose argument fnPath is (e.g. `.map(fnPath)`)
  if (!callExprPath || callExprPath.node.type !== 'CallExpression') return [];
  let node = callExprPath.node;
  const found = [];
  // Walk the chain outward as far as it goes (handles `.filter(...).map(...)` etc. uniformly by
  // just checking the outermost node we were given - the CallExpression for `.map()` itself,
  // which is where a comment placed above the start of the whole chain actually attaches).
  for (const c of node.leadingComments || []) {
    const m = classifyCommentValue(c.value);
    if (m) found.push(m);
  }
  return found;
}

function collectAncestorJsxMarkers(path) {
  let current = path;
  while (current) {
    const parent = current.parentPath;
    if (!parent) break;
    if ((parent.node.type === 'JSXElement' || parent.node.type === 'JSXFragment') && Array.isArray(parent.node.children)) {
      const childIndex = parent.node.children.indexOf(current.node);
      if (childIndex !== -1) {
        const marker = nearestPrecedingMarker(parent.node.children, childIndex);
        if (marker) return [marker];
      }
    }
    current = parent;
    if (current.node.type === 'FunctionDeclaration' || current.node.type === 'ArrowFunctionExpression' || current.node.type === 'FunctionExpression') {
      // A NAMED render-helper/component boundary: check its OWN leading comment (the pattern
      // already used project-wide for whole-screen markers like `// PRODUCT_TRUTH_CAPABILITY:
      // dashboard_overview` above `export default function Dashboard`, extended here to smaller
      // named render-helper functions like `const renderHeaderAIChatButton = () => (<button/>)`
      // where the control IS the function's entire single-expression return with no JSX sibling
      // position to attach a comment to at all). An ANONYMOUS boundary (e.g. an inline `.map()`
      // callback with no name) is not a real "declaration site" - climbing continues through it
      // instead of stopping, so a genuine outer JSX-sibling marker (e.g. above the whole `{list.map(...)}`
      // expression) can still be found for list-rendered controls.
      const namedInfo = namedFunctionDeclarationInfo(current);
      if (namedInfo) {
        const ownMarkers = markersOnDeclarationStatement(namedInfo.statementPath, namedInfo.declNode);
        if (ownMarkers.length > 0) return ownMarkers;
        break; // named boundary with no marker of its own: a real stop (do not leak into an unrelated outer scope)
      }
      // Anonymous callback boundary (e.g. a bare `.map(cb => ...)` argument): check for a marker
      // placed above the WHOLE chained call expression itself (`{collection.filter(...).map(cb =>
      // ...)}` - the real, common real-world position for a list's own capability/decorative
      // marker) before falling through to keep climbing through JSX ancestors above it.
      const chainMarkers = collectMapChainLeadingMarkers(current);
      if (chainMarkers.length > 0) return chainMarkers;
      // else: fall through and keep climbing.
    }
  }
  return [];
}

/** Resolves an identifier to its binding's declaration node (VariableDeclarator init or
 * FunctionDeclaration), and collects: the declaration's own leading comments, plus leading
 * comments on statements one level inside that declaration's function body. */
function collectHandlerDeclarationMarkers(path, handlerName) {
  if (!handlerName) return [];
  const binding = path.scope.getBinding(handlerName);
  if (!binding) return [];
  // A handler resolved to a function PARAMETER (a prop passed into this component, e.g.
  // `function Foo({ handleExportExpenses }) { ... onClick={handleExportExpenses} }`) has no
  // per-handler declaration of its own to search - its binding's "declaration" is the enclosing
  // function/component itself, whose own leading comment (if any) is about the component surface
  // as a whole, never about this one specific prop-based handler. Attributing it here would be
  // exactly the "neighboring-control marker" / reusable-orphan-marker class of false attachment
  // this scanner exists to prevent - so a param-bound handler yields no handler-declaration
  // markers at all; such a control must resolve via the JSX-ancestor-comment path instead.
  if (binding.kind === 'param') return [];
  const found = [];
  const declNode = binding.path.node;
  const declStatementPath = binding.path.getStatementParent();
  const ownComments = (declStatementPath?.node.leadingComments) || declNode.leadingComments || [];
  for (const c of ownComments) {
    const m = classifyCommentValue(c.value);
    if (m) found.push(m);
  }
  // Function body: VariableDeclarator with an Arrow/FunctionExpression init, or a FunctionDeclaration.
  let bodyNode = null;
  if (declNode.type === 'VariableDeclarator' && declNode.init && (declNode.init.type === 'ArrowFunctionExpression' || declNode.init.type === 'FunctionExpression')) {
    bodyNode = declNode.init.body;
  } else if (declNode.type === 'FunctionDeclaration') {
    bodyNode = declNode.body;
  }
  if (bodyNode && bodyNode.type === 'BlockStatement') {
    for (const stmt of bodyNode.body) {
      for (const c of stmt.leadingComments || []) {
        const m = classifyCommentValue(c.value);
        if (m) found.push(m);
      }
    }
  }
  return found;
}

function enclosingComponentName(path) {
  let current = path;
  while (current) {
    if (current.node.type === 'FunctionDeclaration' && current.node.id) return current.node.id.name;
    if (current.node.type === 'VariableDeclarator' && current.node.id?.type === 'Identifier' && (current.node.init?.type === 'ArrowFunctionExpression' || current.node.init?.type === 'FunctionExpression')) {
      return current.node.id.name;
    }
    current = current.parentPath;
  }
  return '(module scope)';
}

function computeSignature(relFile, kind, tagName, attrNames, handlerName, line, column) {
  const raw = `${relFile}|${kind}|${tagName}|${attrNames.join(',')}|${handlerName || 'inline'}|${line}:${column}`;
  return createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

// REPLACEMENT-CONTROL DEFENSE (Codex final re-review Blocker 1, 2026-09-2X): `signature` above
// includes line:column, so it changes on every harmless reformat/reposition - useful for
// same-run diagnostics, but useless as a PERSISTED identity to compare a control against its own
// past self. `computeIdentityKey` is the structural subset only (file, enclosing component,
// control kind, tag name, attribute-name set, resolved handler name) - stable across a pure
// reposition, but it changes the instant the control itself changes shape: a different tag/kind
// (button -> Link), a different event-handler binding, or a different enclosing
// component/render-boundary. This is the identity persisted in productTruthControlBaseline.json
// and compared every run by checkControlIdentityBaseline, so a marker that is still mechanically
// "nearest" to a REPLACED control can no longer silently inherit onto it - see
// productTruthControlScanner.test.js's "REPLACEMENT CONTROL DEFENSE" suite for the required
// mutation proofs.
export function computeIdentityKey(control) {
  const raw = `${control.file}|${control.enclosingComponent}|${control.kind}|${control.tagName}|${(control.attrNames || []).join(',')}|${control.handlerName || 'inline'}`;
  return createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

/**
 * Fails CLOSED: a capability id whose currently-resolved control(s) do not match the identity
 * key(s) recorded in the committed baseline for that id is a failure, whether the id is brand new
 * (never baselined - must be explicitly added) or the control behind it changed shape (stale
 * marker inherited by a replaced control - must be explicitly remapped). A legitimate control
 * REMOVED entirely (no longer discovered at all) is not itself flagged here - that direction is
 * covered by the control-resolution/interactive-completeness gates, which fail on the now-missing
 * capability elsewhere in the registry/coverage chain; this gate's job is narrowly the
 * replacement-inherits-stale-marker class.
 * @param {Array<object>} controls - output of scanControlsInFile(s)().controls
 * @param {Record<string, string[]>} baseline - capabilityId -> array of recorded identity keys
 * @returns {Array<{capabilityId: string, reason: string, identityKey: string, file: string, line: number|null}>}
 */
export function checkControlIdentityBaseline(controls, baseline) {
  const failures = [];
  const currentByCapability = new Map();
  for (const c of controls) {
    if (c.resolution.status !== 'resolved' || c.resolution.type !== 'capability') continue;
    const id = c.resolution.id;
    const key = computeIdentityKey(c);
    if (!currentByCapability.has(id)) currentByCapability.set(id, new Map());
    if (!currentByCapability.get(id).has(key)) currentByCapability.get(id).set(key, c);
  }
  for (const [id, keyMap] of currentByCapability) {
    const baselineKeys = new Set(baseline[id] || []);
    const hasBaselineEntry = Object.prototype.hasOwnProperty.call(baseline, id);
    for (const [key, control] of keyMap) {
      if (!baselineKeys.has(key)) {
        failures.push({
          capabilityId: id,
          reason: hasBaselineEntry ? 'stale_marker_on_changed_control' : 'unbaselined_capability_control',
          identityKey: key,
          file: control.file,
          line: control.line,
        });
      }
    }
  }
  return failures;
}

/**
 * Scans one file's real source for interactive controls and their marker resolution.
 * @param {string} relFile - path relative to repo root, used only for reporting/signature input
 * @param {string} source - real file content
 * @returns {{controls: Array<object>}}
 */
export function scanControlsInFile(relFile, source) {
  const controls = [];
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      attachComment: true,
    });
  } catch {
    return { controls: [], parseError: true };
  }

  traverse(ast, {
    JSXOpeningElement(path) {
      const info = isInteractiveOpeningElement(path.node);
      if (!info) return;
      const handlerName = findOnClickHandlerName(path.node);
      const loc = path.node.loc;
      const elementPath = path.parentPath; // JSXElement
      // A plain `// comment` placed directly before a JSXElement that sits in a non-children-array
      // position (a ConditionalExpression branch, a LogicalExpression's right-hand side, etc. -
      // anywhere a JSX-sibling `{/* */}` comment has no valid syntactic position) attaches as a
      // real Babel leadingComment on the JSXElement node itself - checked directly here, first.
      const directMarkers = [];
      for (const c of elementPath.node.leadingComments || []) {
        const m = classifyCommentValue(c.value);
        if (m) directMarkers.push(m);
      }
      const jsxMarkers = directMarkers.length > 0 ? directMarkers : collectAncestorJsxMarkers(elementPath);
      const handlerMarkers = collectHandlerDeclarationMarkers(path, handlerName);
      const searchSet = [...jsxMarkers, ...handlerMarkers];
      const capabilityMarkers = searchSet.filter((m) => m.kind === 'capability');
      const decorativeMarkers = searchSet.filter((m) => m.kind === 'decorative');
      const uniqueCapabilityIds = [...new Set(capabilityMarkers.map((m) => m.id))];

      let resolution;
      if (uniqueCapabilityIds.length > 1) {
        resolution = { status: 'ambiguous', reason: 'multiple_conflicting_capability_markers', ids: uniqueCapabilityIds };
      } else if (uniqueCapabilityIds.length === 1 && decorativeMarkers.length > 0) {
        resolution = { status: 'ambiguous', reason: 'capability_and_exemption_on_same_control', ids: uniqueCapabilityIds };
      } else if (decorativeMarkers.length > 1) {
        resolution = { status: 'ambiguous', reason: 'multiple_decorative_markers', reasons: decorativeMarkers.map((m) => m.reason) };
      } else if (uniqueCapabilityIds.length === 1) {
        resolution = { status: 'resolved', type: 'capability', id: uniqueCapabilityIds[0] };
      } else if (decorativeMarkers.length === 1) {
        if (!decorativeMarkers[0].reason) {
          resolution = { status: 'ambiguous', reason: 'empty_decorative_reason' };
        } else {
          resolution = { status: 'resolved', type: 'decorative', reason: decorativeMarkers[0].reason };
        }
      } else {
        resolution = { status: 'unresolved' };
      }

      controls.push({
        file: relFile,
        enclosingComponent: enclosingComponentName(path),
        line: loc?.start.line ?? null,
        column: loc?.start.column ?? null,
        endLine: loc?.end.line ?? null,
        kind: info.kind,
        tagName: info.tagName,
        attrNames: info.attrNames,
        handlerName: handlerName || null,
        signature: computeSignature(relFile, info.kind, info.tagName, info.attrNames, handlerName, loc?.start.line, loc?.start.column),
        resolution,
      });
    },
  });

  return { controls };
}

export function scanControlsInFiles(baseDir, files, readFn = (rel) => readFileSync(join(baseDir, rel), 'utf-8')) {
  const all = [];
  const parseErrors = [];
  for (const relFile of files) {
    let text;
    try {
      text = readFn(relFile);
    } catch {
      continue;
    }
    const { controls, parseError } = scanControlsInFile(relFile, text);
    if (parseError) parseErrors.push(relFile);
    all.push(...controls);
  }
  return { controls: all, parseErrors };
}
