import { describe, it, expect } from 'vitest';
import { render } from 'solid-js/web';
import AbbreviationPills from './AbbreviationPills';
import type { AbbreviationBadge } from '../services/timeEngine';

describe('AbbreviationPills', () => {
  it('renders year-round, active seasonal, and inactive seasonal badges with visual distinctions', () => {
    const badges: AbbreviationBadge[] = [
      {
        code: 'PT',
        full_name: 'Pacific Time',
        kind: 'generic_year_round',
        is_currently_active: true,
        is_year_round: true,
      },
      {
        code: 'PST',
        full_name: 'Pacific Standard Time',
        kind: 'standard_seasonal',
        is_currently_active: true,
        is_year_round: false,
      },
      {
        code: 'PDT',
        full_name: 'Pacific Daylight Time',
        kind: 'daylight_seasonal',
        is_currently_active: false,
        is_year_round: false,
      },
    ];

    const container = document.createElement('div');
    render(() => <AbbreviationPills abbreviations={badges} />, container);

    const pills = container.querySelectorAll('span.font-mono');
    expect(pills.length).toBe(3);
    expect(pills[0].textContent).toBe('PT');
    expect(pills[1].textContent).toBe('PST');
    expect(pills[2].textContent).toBe('PDT');

    // 1. PT: solid high-contrast pill
    const ptParent = pills[0].closest('span.inline-flex');
    expect(ptParent?.className).toContain('border-outline');
    expect(ptParent?.className).toContain('bg-surface-container-high');
    expect(ptParent?.className).not.toContain('border-dashed');

    // 2. PST: active seasonal pill with dashed primary border
    const pstParent = pills[1].closest('span.inline-flex');
    expect(pstParent?.className).toContain('border-dashed');
    expect(pstParent?.className).toContain('border-primary');
    expect(pstParent?.className).toContain('bg-primary-container/40');

    // 3. PDT: inactive seasonal pill (dimmed/muted)
    const pdtParent = pills[2].closest('span.inline-flex');
    expect(pdtParent?.className).toContain('border-dashed');
    expect(pdtParent?.className).toContain('border-outline-variant');
    expect(pdtParent?.className).toContain('opacity-50');
  });
});
