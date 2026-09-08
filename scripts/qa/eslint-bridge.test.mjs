import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ESLint as BaselineESLint } from 'eslint';
import config from '../../eslint.config.mjs';

// The candidate runtime is installed independently with strict peers. Plugins
// intentionally come from the app's unchanged dependency tree. This proves rule
// execution only, NOT that a combined ESLint 10/Next install is supported.
const runtime = process.env.RDD_ESLINT_BRIDGE_ROOT;
if (!runtime || !path.isAbsolute(runtime)) throw new Error('Set RDD_ESLINT_BRIDGE_ROOT to the absolute isolated runtime directory.');
const candidateRequire = createRequire(path.join(runtime, 'package.json'));
const { ESLint: CandidateESLint } = candidateRequire('eslint');
const { fixupConfigRules } = candidateRequire('@eslint/compat');
const root = fileURLToPath(new URL('../../', import.meta.url));
const filePath = path.join(root, 'app/profiles/[id]/page.tsx');
const baseline = new BaselineESLint({ cwd: root, overrideConfigFile: true, overrideConfig: config });
const candidate = new CandidateESLint({ cwd: root, overrideConfigFile: true, overrideConfig: fixupConfigRules(config) });

const reactFixtures = [
  ['react/display-name', 'export default () => <div />;', 'export default function Named() { return <div />; }'],
  ['react/jsx-key', 'export const rows = [<div />];', 'export const rows = [<div key="one" />];'],
  ['react/jsx-no-comment-textnodes', 'export const row = <div>/* comment */</div>;', 'export const row = <div>{/* comment */}</div>;'],
  ['react/jsx-no-duplicate-props', 'export const row = <div id="a" id="b" />;', 'export const row = <div id="a" />;'],
  ['react/jsx-no-undef', 'export const row = <Missing />;', 'const Found = () => <div />; export const row = <Found />;'],
  ['react/no-children-prop', 'export const row = <div children="text" />;', 'export const row = <div>text</div>;'],
  ['react/no-danger-with-children', 'export const row = <div dangerouslySetInnerHTML={{__html:"x"}}>text</div>;', 'export const row = <div dangerouslySetInnerHTML={{__html:"x"}} />;'],
  ['react/no-deprecated', 'import React from "react"; React.createClass({});', 'import React from "react"; export const row = React.createElement("div");'],
  ['react/no-direct-mutation-state', 'import React from "react"; export class Counter extends React.Component { click() { this.state.value = 1; } render() { return <div />; } }', 'import React from "react"; export class Counter extends React.Component { click() { this.setState({value:1}); } render() { return <div />; } }'],
  ['react/no-find-dom-node', 'import ReactDOM from "react-dom"; ReactDOM.findDOMNode(node);', 'export const row = <div />;'],
  ['react/no-is-mounted', 'import React from "react"; export class Counter extends React.Component { click() { this.isMounted(); } render() { return <div />; } }', 'import React from "react"; export class Counter extends React.Component { render() { return <div />; } }'],
  ['react/no-render-return-value', 'import ReactDOM from "react-dom"; export const instance = ReactDOM.render(<div />, container);', 'import ReactDOM from "react-dom"; ReactDOM.render(<div />, container);'],
  ['react/no-string-refs', 'import React from "react"; export class Counter extends React.Component { render() { return <div ref="item" />; } }', 'export const row = <div />;'],
  ['react/no-unescaped-entities', 'export const row = <div>don\'t</div>;', 'export const row = <div>don&apos;t</div>;'],
  ['react/require-render-return', 'import React from "react"; export class Counter extends React.Component { render() {} }', 'import React from "react"; export class Counter extends React.Component { render() { return <div />; } }'],
];
const otherFixtures = [
  ['import/no-anonymous-default-export', 'export default {value:1};', 'const named = {value:1}; export default named;'],
  ['jsx-a11y/alt-text', 'export const row = <img src="/x.png" />;', 'export const row = <img src="/x.png" alt="Dartboard" />;'],
  ['jsx-a11y/alt-text', 'import Image from "next/image"; export const row = <Image src="/x.png" width={10} height={10} />;', 'import Image from "next/image"; export const row = <Image src="/x.png" width={10} height={10} alt="Dartboard" />;'],
  ['jsx-a11y/aria-props', 'export const row = <div aria-bogus="true" />;', 'export const row = <div aria-hidden="true" />;'],
  ['jsx-a11y/aria-proptypes', 'export const row = <div aria-hidden="maybe" />;', 'export const row = <div aria-hidden="true" />;'],
  ['jsx-a11y/aria-unsupported-elements', 'export const row = <meta aria-label="title" />;', 'export const row = <meta name="title" />;'],
  ['jsx-a11y/role-has-required-aria-props', 'export const row = <div role="checkbox" />;', 'export const row = <div role="checkbox" aria-checked="false" />;'],
  ['jsx-a11y/role-supports-aria-props', 'export const row = <div role="button" aria-checked="true" />;', 'export const row = <div role="checkbox" aria-checked="true" />;'],
  ['react-hooks/rules-of-hooks', 'import {useState} from "react"; export function Example({ready}) { if (ready) { useState(0); } return <div />; }', 'import {useState} from "react"; export function Example() { const [value] = useState(0); return <div>{value}</div>; }'],
  ['react-hooks/exhaustive-deps', 'import {useEffect} from "react"; export function Example({name}) { useEffect(() => { console.log(name); }, []); return <div />; }', 'import {useEffect} from "react"; export function Example({name}) { useEffect(() => { console.log(name); }, [name]); return <div />; }'],
  ['react-hooks/set-state-in-effect', 'import {useEffect,useState} from "react"; export function Example({name}) { const [value,setValue] = useState(""); useEffect(() => { setValue(name); }, [name]); return <div>{value}</div>; }', 'export function Example({name}) { return <div>{name}</div>; }'],
  ['@next/next/no-img-element', 'export const row = <img src="/x.png" alt="Dartboard" />;', 'import Image from "next/image"; export const row = <Image src="/x.png" width={10} height={10} alt="Dartboard" />;'],
  ['@next/next/no-sync-scripts', 'export const row = <script src="/x.js" />;', 'export const row = <script src="/x.js" async />;'],
  ['@typescript-eslint/no-explicit-any', 'export const value: any = 1;', 'export const value: number = 1;'],
];

async function targetMessages(linter, source, ruleId) {
  const [result] = await linter.lintText(source, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter(message => message.ruleId === ruleId)
    .map(({ ruleId, messageId, severity }) => ({ ruleId, messageId, severity }));
}

it('loads the exact candidate without replacing the installed baseline', () => {
  expect(BaselineESLint.version).toBe('9.39.5');
  expect(CandidateESLint.version).toBe('10.10.0');
  expect(candidateRequire(path.join(runtime, 'node_modules/@eslint/compat/package.json')).version).toBe('2.1.1');
});

it('preserves every effective rule/severity/option and Next settings on TSX and JS', async () => {
  for (const target of [filePath, path.join(root, 'lib/matchState.js')]) {
    const before = await baseline.calculateConfigForFile(target);
    const after = await candidate.calculateConfigForFile(target);
    // ESLint 10 materializes defaults even on disabled core no-unused-vars.
    // Compare all severities and enabled options; disabled options do not run.
    const effective = rules => Object.fromEntries(Object.entries(rules).map(([key, value]) => [key, value[0] === 0 ? [0] : value]));
    expect(effective(after.rules)).toEqual(effective(before.rules));
    expect(after.settings).toEqual(before.settings);
    expect(after.languageOptions.parser.meta).toEqual(before.languageOptions.parser.meta);
  }
  expect(await candidate.isPathIgnored(filePath)).toBe(false);
  for (const ignored of ['.next/cache/probe.js', 'coverage/probe.js', 'out/probe.js']) {
    expect(await candidate.isPathIgnored(path.join(root, ignored))).toBe(true);
  }
});

it('accounts for all enabled React, import and accessibility rules', async () => {
  const resolved = await baseline.calculateConfigForFile(filePath);
  const enabled = Object.keys(resolved.rules).filter(key => /^(react|import|jsx-a11y)\//.test(key) && resolved.rules[key][0] !== 0).sort();
  expect([...new Set([...reactFixtures, ...otherFixtures].map(row => row[0])
    .filter(key => /^(react|import|jsx-a11y)\//.test(key)))].concat(['react/jsx-uses-react', 'react/jsx-uses-vars']).sort()).toEqual(enabled);
});

describe.each([...reactFixtures, ...otherFixtures])('%s', (ruleId, invalid, valid) => {
  it('reports the deliberate defect at the same severity as ESLint 9', async () => {
    const expected = await targetMessages(baseline, invalid, ruleId);
    expect(expected.length).toBeGreaterThan(0);
    expect(await targetMessages(candidate, invalid, ruleId)).toEqual(expected);
  });
  it('accepts the corrected counterpart under both engines', async () => {
    expect(await targetMessages(baseline, valid, ruleId)).toEqual([]);
    expect(await targetMessages(candidate, valid, ruleId)).toEqual([]);
  });
});

const jsxUsageSource = 'import React from "react"; const Part = () => <div />; export const row = <Part />;';

it('preserves combined JSX usage handling without hiding actually unused variables', async () => {
  // This checks the combined stack, not these two rules independently: the
  // TypeScript parser/core also tracks JSX bindings (see the mutation below).
  for (const linter of [baseline, candidate]) {
    expect(await targetMessages(linter, jsxUsageSource, '@typescript-eslint/no-unused-vars')).toEqual([]);
    expect(await targetMessages(linter, `${jsxUsageSource} const unused = 1;`, '@typescript-eslint/no-unused-vars')).toHaveLength(1);
  }
});

it('records redundant JSX tracking without removing either rule from the real config', async () => {
  const ruleIds = ['react/jsx-uses-react', 'react/jsx-uses-vars'];
  // Diagnostic mutation only. The config-parity test above covers the real
  // candidate; neither disabling override is written to eslint.config.mjs.
  const off = { rules: Object.fromEntries(ruleIds.map(ruleId => [ruleId, 'off'])) };
  for (const [Engine, base, real] of [[BaselineESLint, config, baseline], [CandidateESLint, fixupConfigRules(config), candidate]]) {
    const realConfig = await real.calculateConfigForFile(filePath);
    for (const ruleId of ruleIds) expect(realConfig.rules[ruleId][0]).toBe(2);
    const mutated = new Engine({ cwd: root, overrideConfigFile: true, overrideConfig: [...base, off] });
    expect(await targetMessages(mutated, jsxUsageSource, '@typescript-eslint/no-unused-vars')).toEqual([]);
    expect(await targetMessages(mutated, `${jsxUsageSource} const unused = 1;`, '@typescript-eslint/no-unused-vars')).toHaveLength(1);
  }
});

it('lints the same complete repository corpus cleanly with no disabled rules', async () => {
  const before = await baseline.lintFiles(['.']);
  const after = await candidate.lintFiles(['.']);
  expect(after.map(row => row.filePath).sort()).toEqual(before.map(row => row.filePath).sort());
  expect(after.some(row => row.filePath === filePath)).toBe(true);
  expect(after.length).toBeGreaterThanOrEqual(66);
  for (const results of [before, after]) {
    expect(results.flatMap(row => row.messages.map(message => ({ file: row.filePath, rule: message.ruleId, message: message.message })))).toEqual([]);
  }
});
