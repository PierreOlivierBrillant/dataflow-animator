/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, downloadJson, serializeSpec } from './json';
import type { DataFlowSpec } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('serializeSpec', () => {
  it('formats the spec as indented JSON', () => {
    const spec: DataFlowSpec = { nodes: [], packets: [], timeline: [] };
    expect(serializeSpec(spec)).toBe(
      '{\n  "nodes": [],\n  "packets": [],\n  "timeline": []\n}'
    );
  });
});

describe('copyText', () => {
  it('delegates to navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });
});

describe('downloadJson', () => {
  it('creates a .json anchor, clicks it and revokes the URL', () => {
    const createUrl = vi.fn(() => 'blob:fake');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    downloadJson('{}');

    expect(createUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');
    expect(document.querySelector('a')).toBeNull();
  });
});
