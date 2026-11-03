'use client';

import { setRoadmapCapacityAction } from '@/app/roadmap/actions';
import type { CapacitySnapshot } from '@/lib/roadmapCapacity';

export function RoadmapCapacity({ snap }: { snap: CapacitySnapshot }) {
  return (
    <section className="panel roadmap-capacity" style={{ marginBottom: '0.75rem' }}>
      <div className="panel-head">
        <span>Capacity</span>
        <span className={snap.over ? 'tag tag--error' : 'muted'}>
          {snap.committed}/{snap.capacityPerWeek} pts · {snap.loadPct}%
        </span>
      </div>
      <div className="panel-body roadmap-capacity-body">
        <div className="roadmap-capacity-meter" role="img" aria-label={`Load ${snap.loadPct}%`}>
          <div
            className={`roadmap-capacity-fill${snap.over ? ' is-over' : ''}`}
            style={{ width: `${Math.min(100, snap.loadPct)}%` }}
          />
        </div>
        <p className="muted roadmap-capacity-hint">
          Baseline {snap.capacityPerWeek} pts/week vs {snap.committed} committed (
          {snap.openCount} open · through {snap.weekEnd}).
        </p>
        <form action={setRoadmapCapacityAction} className="roadmap-capacity-form">
          <label htmlFor="roadmap-cap">
            Pts / week
            <input
              id="roadmap-cap"
              name="capacity"
              type="number"
              min={1}
              max={500}
              defaultValue={snap.capacityPerWeek}
            />
          </label>
          <button type="submit" className="btn-secondary">
            Set baseline
          </button>
        </form>
      </div>
    </section>
  );
}
