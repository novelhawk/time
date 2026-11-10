import { For, type Component } from 'solid-js';
import type { AbbreviationBadge, DstTransitionInfo } from '../services/timeEngine';

export interface AbbreviationPillsProps {
  abbreviations?: AbbreviationBadge[];
  nextTransition?: DstTransitionInfo | null;
  class?: string;
  size?: 'xs' | 'sm';
}

function formatTransitionDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  const day = date.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  return `${day} ${month}`;
}

export const AbbreviationPills: Component<AbbreviationPillsProps> = props => {
  const sizeClasses = () => (props.size === 'xs' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-0.5 gap-1.5');

  return (
    <div class={`inline-flex flex-wrap items-center gap-1.5 ${props.class ?? ''}`}>
      <For each={props.abbreviations ?? []}>
        {badge => {
          // 1. Year-round / Generic (e.g., PT, UTC, JST, IST)
          if (badge.is_year_round) {
            return (
              <span
                class={`inline-flex items-center rounded-md border border-outline bg-surface-container-high text-on-surface font-medium transition-colors select-none ${sizeClasses()}`}
                title={`${badge.full_name} • Year-round`}
              >
                <span class="w-1.5 h-1.5 rounded-full bg-outline" aria-hidden="true" />
                <span class="font-mono tracking-tight">{badge.code}</span>
              </span>
            );
          }

          // 2. Active Seasonal / DST-dependent (e.g., PST in winter, PDT in summer)
          if (badge.is_currently_active) {
            const isDaylight = badge.kind === 'daylight_seasonal';
            return (
              <span
                class={`inline-flex items-center rounded-md border-dashed border-primary bg-primary-container/40 text-on-primary-container font-medium transition-colors select-none ${sizeClasses()}`}
                title={`${badge.full_name} • Active Seasonal (${isDaylight ? 'Daylight Saving Time' : 'Standard Time'})`}
              >
                <span
                  class={`w-1.5 h-1.5 rounded-full ${isDaylight ? 'bg-primary animate-pulse' : 'bg-primary'}`}
                  aria-hidden="true"
                />
                <span class="font-mono tracking-tight">{badge.code}</span>
                <span class="text-[9px] opacity-75">{isDaylight ? '☼' : '❄'}</span>
              </span>
            );
          }

          // 3. Inactive Seasonal (e.g., PDT during winter, CEST during winter)
          const isDaylight = badge.kind === 'daylight_seasonal';
          const isUpcoming = props.nextTransition && props.nextTransition.abbrev_after === badge.code;
          const tooltip = isUpcoming
            ? `${badge.full_name} • Active on ${formatTransitionDate(props.nextTransition!.timestamp_ms)}`
            : `${badge.full_name} • Inactive (${isDaylight ? 'Daylight Saving Time' : 'Standard Time'})`;

          return (
            <span
              class={`inline-flex items-center rounded-md border-dashed border-outline-variant bg-surface-container-low/50 text-on-surface-variant/70 opacity-50 hover:opacity-80 transition-opacity select-none ${sizeClasses()}`}
              title={tooltip}
            >
              <span class="w-1.5 h-1.5 rounded-full border border-outline-variant" aria-hidden="true" />
              <span class="font-mono tracking-tight opacity-75">{badge.code}</span>
            </span>
          );
        }}
      </For>
    </div>
  );
};

export default AbbreviationPills;
