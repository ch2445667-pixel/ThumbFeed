import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatShortViews } from './formatViews';

describe('formatShortViews', () => {
  it('abbreviates raw integers into K, M, and B', () => {
    assert.equal(formatShortViews('2488161'), '2.5M');
    assert.equal(formatShortViews(1000000), '1M');
    assert.equal(formatShortViews('48200'), '48.2K');
    assert.equal(formatShortViews('16400'), '16.4K');
    assert.equal(formatShortViews('1000'), '1K');
    assert.equal(formatShortViews('950'), '950');
    assert.equal(formatShortViews('1420000000'), '1.4B');
  });

  it('parses comma-formatted and "views"-suffixed strings', () => {
    assert.equal(formatShortViews('2,488,161 views'), '2.5M');
    assert.equal(formatShortViews('16,400 View'), '16.4K');
    assert.equal(formatShortViews('1,500K views'), '1.5M');
  });

  it('normalizes lowercase and full-word suffixes', () => {
    assert.equal(formatShortViews('2.5m'), '2.5M');
    assert.equal(formatShortViews('450k'), '450K');
    assert.equal(formatShortViews('2.0M'), '2M');
    assert.equal(formatShortViews('3.4 million views'), '3.4M');
    assert.equal(formatShortViews('125 thousand'), '125K');
    assert.equal(formatShortViews('1.2 billion'), '1.2B');
  });

  it('handles empty or non-numeric inputs safely', () => {
    assert.equal(formatShortViews(''), '');
    assert.equal(formatShortViews('   '), '');
    assert.equal(formatShortViews(null), '');
    assert.equal(formatShortViews(undefined), '');
    assert.equal(formatShortViews('N/A'), '');
  });
});
