// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';
import { expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file)
      : file.endsWith('.tsx') && !file.includes('.test.') ? [file] : [];
  });
}
const consumers = [...sourceFiles('app'), ...sourceFiles('components')]
  .filter(file => readFileSync(file, 'utf8').includes('<PageHeader'));

it('keeps every page-header consumer on the common outer frame in all render states', () => {
  const violations: string[] = [];
  for (const file of consumers) {
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === 'main') {
        const attribute = node.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(tree) === 'className');
        if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isStringLiteral(attribute.initializer) || !attribute.initializer.text.split(' ').includes('rdd-page-shell'))
          violations.push(`${file}:${tree.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  expect(consumers).toEqual(expect.arrayContaining([join('app', 'stats', 'layout.tsx'), join('app', 'league-night', 'page.tsx')]));
  expect(violations).toEqual([]);
});

it('prevents per-page title-size variants from returning', () => {
  const violations: string[] = [];
  for (const file of consumers) {
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === 'PageHeader'
        && node.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(tree) === 'size')) violations.push(file);
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  expect(violations).toEqual([]);
});

it('keeps outer geometry in the shared rule rather than domain stylesheets', () => {
  const shells = new Set(['.page-shell', '.stats-page-shell', '.matches-page', '.directory-page', '.account-profile-page', '.account-page', '.utility-consistent', '.player-page', '.change-log-page', '.change-log-consistent', '.account-consistent', '.invite-consistent', '.invite-shell', '.solo-shell', '.planning-page', '.night-shell--consistent', '.rr-shell', '.rr-shell.rr-consistent', '.board-page', '.board-consistent']);
  const violations: string[] = [];
  for (const file of ['app/globals.css', 'app/solo/solo.css', 'app/league-night/night-consistency.css', 'app/league-night/plan/planning.css', 'components/rivalries/rivalries.css']) {
    postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
      if (shells.has(rule.selector)) rule.walkDecls(declaration => {
        if (/^(width|max-width|margin|padding|padding-inline|padding-block|gap)$/.test(declaration.prop)) violations.push(`${file}: ${rule.selector} ${declaration.prop}`);
      });
    });
  }
  expect(violations).toEqual([]);
});
