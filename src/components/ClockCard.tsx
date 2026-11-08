import { Show, type Component } from 'solid-js';
import type { ResolvedTimeEntry, DstTransitionInfo } from '../services/timeEngine';
import AbbreviationPills from './AbbreviationPills';

export interface ClockCardProps {
  clock: ResolvedTimeEntry;
  index?: number;
  viewMode: 'list' | 'grid';
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnter?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onSelect?: () => void;
  onRemove?: () => void;
}

function formatCompactTransition(trans: DstTransitionInfo): string {
  const date = new Date(trans.timestamp_ms);
  const day = date.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  return `→ ${trans.abbrev_after} ${day} ${month}`;
}

export const ClockCard: Component<ClockCardProps> = props => {
  const clock = () => props.clock;
  const isList = () => props.viewMode === 'list';

  return (
    <article
      data-clock-card
      data-clock-id={clock().id}
      draggable={true}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragEnter={props.onDragEnter}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
      class={`group relative bg-surface-container border transition-all cursor-grab active:cursor-grabbing select-none shadow-xs hover:shadow-md ${
        props.isDragging
          ? 'opacity-35 scale-[0.98] border-dashed border-primary shadow-inner'
          : props.isDragOver
          ? 'border-primary ring-2 ring-primary ring-offset-2 scale-[1.01]'
          : 'border-outline-variant/40 hover:border-outline/80'
      } rounded-2xl ${
        isList()
          ? 'p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'
          : 'p-5 flex flex-col justify-between min-h-[170px]'
      }`}
      onClick={() => props.onSelect?.()}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect?.();
        }
      }}
      aria-label={`View details for ${clock().primary_label}`}
    >
      {/* Remove Button (Hover on desktop, accessible via aria) */}
      <button
        type="button"
        draggable={false}
        onClick={e => {
          e.stopPropagation();
          props.onRemove?.();
        }}
        onDragStart={e => {
          e.stopPropagation();
          e.preventDefault();
        }}
        class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface-variant transition-all cursor-pointer z-10"
        title={`Remove ${clock().primary_label}`}
        aria-label={`Remove ${clock().primary_label}`}
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Primary Info & Metadata */}
      <div class="flex flex-col gap-2 min-w-0 pr-6 sm:pr-0">
        <div class="flex items-center gap-2 flex-wrap">
          {/* Subtle Drag Grip Handle */}
          <div
            class="text-on-surface-variant/40 group-hover:text-on-surface-variant transition-colors p-0.5 -ml-1 rounded flex items-center shrink-0 cursor-grab"
            title="Drag to reorder"
            aria-hidden="true"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5" />
              <circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" />
              <circle cx="15" cy="19" r="1.5" />
            </svg>
          </div>

          <h2 class="text-base sm:text-lg font-mono font-bold text-on-surface tracking-tight truncate">
            {clock().primary_label}
          </h2>

          <Show when={clock().subtitle_context}>
            <span class="text-xs text-on-surface-variant/80 font-sans truncate opacity-85">
              {clock().subtitle_context}
            </span>
          </Show>

          <Show when={clock().kind === 'offset_group'}>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-secondary-container text-on-secondary-container border border-outline-variant/30">
              {clock().sibling_iana_zones.length} zones
            </span>
          </Show>

          <Show when={clock().kind === 'computed_expression'}>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-primary-container text-on-primary-container border border-outline-variant/30">
              Shifted Time
            </span>
          </Show>
        </div>

        {/* Offsets Triad & Abbreviations */}
        <div class="flex items-center gap-1.5 flex-wrap font-mono text-[11px] text-on-surface-variant">
          <span class="px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant/50">
            {clock().utc_offset_str}
          </span>
          <span class="px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant/50">
            {clock().gmt_offset_str}
          </span>
          <span
            class="px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant/50"
            title="Difference relative to your current local time"
          >
            {clock().local_offset_str}
          </span>

          <Show when={clock().abbreviations.length > 0}>
            <span class="opacity-40">•</span>
            <AbbreviationPills abbreviations={clock().abbreviations} size="xs" />
          </Show>

          {/* Compact DST Transition indicator */}
          <Show when={clock().uses_dst && clock().next_transition}>
            <span
              class="px-1.5 py-0.5 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface-variant flex items-center gap-1 text-[10px]"
              title={`Next DST transition: ${clock().next_transition?.abbrev_after} (${clock().next_transition?.iso_utc})`}
            >
              <span class="text-[9px] opacity-75">{clock().next_transition?.is_dst_after ? '☼' : '❄'}</span>
              <span>{formatCompactTransition(clock().next_transition!)}</span>
            </span>
          </Show>
        </div>
      </div>

      {/* Big Digital Clock & Day Offset */}
      <div
        class={`flex shrink-0 ${
          isList()
            ? 'items-baseline sm:items-end justify-between sm:justify-end gap-3 text-right'
            : 'mt-6 items-baseline justify-between pt-4 border-t border-outline-variant/20'
        }`}
      >
        <time class="text-3xl sm:text-4xl font-mono font-bold tracking-wider text-on-surface tabular-nums">
          {clock().formatted_time}
        </time>

        <Show when={clock().day_delta_from_local !== 0}>
          <span
            class="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-tertiary-container text-on-tertiary-container"
            title={`Date shifted ${clock().day_delta_from_local > 0 ? '+1' : '-1'} day relative to your local time`}
          >
            {clock().day_delta_from_local > 0 ? '+1d' : '-1d'}
          </span>
        </Show>
      </div>
    </article>
  );
};

export default ClockCard;
