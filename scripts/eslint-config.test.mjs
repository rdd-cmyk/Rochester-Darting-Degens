// @vitest-environment node
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';

it('lints dynamic profile routes with Hooks checks enabled', async () => {
  const eslint = new ESLint();
  const filePath = 'app/profiles/[id]/page.tsx';
  expect(await eslint.isPathIgnored(filePath)).toBe(false);
  const config = await eslint.calculateConfigForFile(filePath);
  expect(config.rules['react-hooks/set-state-in-effect'][0]).toBe(2);
  expect(config.rules['react-hooks/exhaustive-deps'][0]).toBeGreaterThan(0);
  const [result] = await eslint.lintText(`
    import { useEffect, useState } from 'react';
    export default function Profile({ name }: { name: string }) {
      const [value, setValue] = useState('');
      useEffect(() => { setValue(name); }, []);
      return <p>{value}</p>;
    }
  `, { filePath });
  expect(result.messages.map(message => message.ruleId)).toEqual(expect.arrayContaining([
    'react-hooks/set-state-in-effect', 'react-hooks/exhaustive-deps',
  ]));
}, 15000);
