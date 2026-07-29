import { describe, expect, it } from 'vitest';
import { toStyleMap } from './styleMap';

describe('toStyleMap', () => {
  it('passes undefined through', () => {
    expect(toStyleMap(undefined)).toBeUndefined();
  });

  it('kebab-cases camelCase property names', () => {
    expect(toStyleMap({ backgroundColor: 'red' })).toEqual({
      'background-color': 'red',
    });
  });

  it('leaves already-kebab custom properties alone', () => {
    expect(toStyleMap({ '--rdfa-scale': '2' } as never)).toEqual({
      '--rdfa-scale': '2',
    });
  });

  it('gives a vendor-prefixed name its leading dash', () => {
    expect(toStyleMap({ WebkitMaskImage: 'none' } as never)).toEqual({
      '-webkit-mask-image': 'none',
    });
  });

  it('appends px to a dimensional number', () => {
    expect(toStyleMap({ marginTop: 12 })).toEqual({ 'margin-top': '12px' });
  });

  it('leaves unitless numbers bare', () => {
    expect(toStyleMap({ opacity: 0.5, zIndex: 3, lineHeight: 1.4 })).toEqual({
      opacity: '0.5',
      'z-index': '3',
      'line-height': '1.4',
    });
  });

  it('stringifies non-numeric values', () => {
    expect(toStyleMap({ height: '50vh' })).toEqual({ height: '50vh' });
  });

  it('drops null, undefined and false entries the way React does', () => {
    expect(
      toStyleMap({
        height: undefined,
        width: null as never,
        border: false as never,
        color: 'red',
      })
    ).toEqual({ color: 'red' });
  });

  it('keeps a zero, which is a meaningful value', () => {
    expect(toStyleMap({ marginTop: 0 })).toEqual({ 'margin-top': '0px' });
  });
});
