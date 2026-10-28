import { describe, expect, it } from 'vitest';
import { withBasePath, BASE_PATH } from '../lib/base-path';

describe('base path', () => {
  it('is empty by default so the app serves from the domain root', () => {
    expect(BASE_PATH).toBe('');
    expect(withBasePath('/api/clients')).toBe('/api/clients');
  });

  it('leaves relative and absolute URLs alone', () => {
    expect(withBasePath('api/clients')).toBe('api/clients');
    expect(withBasePath('https://example.com/x')).toBe('https://example.com/x');
  });
});
