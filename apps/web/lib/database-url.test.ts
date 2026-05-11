import { describe, it, expect } from 'vitest';
import { parseDatabaseUrl, isSupabaseDirectUrl } from './database-url';

describe('isSupabaseDirectUrl', () => {
  it('identifies valid direct URLs without port', () => {
    const url = new URL('postgresql://postgres:password@db.abcdefghijklmnop.supabase.co/postgres');
    expect(isSupabaseDirectUrl(url)).toBe(true);
  });

  it('identifies valid direct URLs with port 5432', () => {
    const url = new URL('postgresql://postgres:password@db.abcdefghijklmnop.supabase.co:5432/postgres');
    expect(isSupabaseDirectUrl(url)).toBe(true);
  });

  it('returns false for direct URLs with wrong port', () => {
    const url = new URL('postgresql://postgres:password@db.abcdefghijklmnop.supabase.co:6543/postgres');
    expect(isSupabaseDirectUrl(url)).toBe(false);
  });

  it('returns false for pooler URLs', () => {
    const url = new URL('postgresql://postgres:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');
    expect(isSupabaseDirectUrl(url)).toBe(false);
  });

  it('returns false for other URLs', () => {
    const url = new URL('postgresql://postgres:password@localhost:5432/mydb');
    expect(isSupabaseDirectUrl(url)).toBe(false);
  });
});

describe('parseDatabaseUrl', () => {
  it('sets pathname to /postgres for direct URLs if it is different', () => {
    const rawUrl = 'postgresql://postgres:password@db.abcdefghijklmnop.supabase.co/mydb';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.pathname).toBe('/postgres');
  });

  it('leaves pathname as /postgres for direct URLs if it is already correct', () => {
    const rawUrl = 'postgresql://postgres:password@db.abcdefghijklmnop.supabase.co/postgres';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.pathname).toBe('/postgres');
  });

  it('sets pathname to /postgres for pooler URLs if it is different', () => {
    const rawUrl = 'postgresql://postgres:password@aws-0-eu-central-1.pooler.supabase.com/mydb';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.pathname).toBe('/postgres');
  });

  it('adds pgbouncer=true and connection_limit=1 for pooler URLs on port 6543', () => {
    const rawUrl = 'postgresql://postgres:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.searchParams.get('pgbouncer')).toBe('true');
    expect(parsed.searchParams.get('connection_limit')).toBe('1');
  });

  it('does not overwrite existing pgbouncer and connection_limit params', () => {
    const rawUrl = 'postgresql://postgres:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=false&connection_limit=5';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.searchParams.get('pgbouncer')).toBe('false');
    expect(parsed.searchParams.get('connection_limit')).toBe('5');
  });

  it('does not add pooler params for direct URLs on port 5432', () => {
    const rawUrl = 'postgresql://postgres:password@db.abcdefghijklmnop.supabase.co:5432/postgres';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.searchParams.has('pgbouncer')).toBe(false);
    expect(parsed.searchParams.has('connection_limit')).toBe(false);
  });

  it('leaves non-Supabase URLs unchanged', () => {
    const rawUrl = 'postgresql://postgres:password@localhost:5432/mydb?schema=public';
    const parsed = parseDatabaseUrl(rawUrl);
    expect(parsed.pathname).toBe('/mydb');
    expect(parsed.searchParams.get('schema')).toBe('public');
    expect(parsed.searchParams.has('pgbouncer')).toBe(false);
  });

  it('throws an error for invalid URLs', () => {
    expect(() => parseDatabaseUrl('not-a-url')).toThrow();
  });
});
