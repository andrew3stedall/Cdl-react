import { X } from 'lucide-react';
import { useId } from 'react';

import './player-chart-detail-dialog.css';

export interface PlayerChartDetailRow {
  label: string;
  points?: string;
  value?: string;
}

export interface PlayerChartDetailSection {
  title: string;
  rows: PlayerChartDetailRow[];
}

export interface PlayerChartDetailSummaryItem {
  label: string;
  value: string;
}

export function PlayerChartDetailDialog({
  kind,
  onClose,
  sections,
  subtitle,
  summary,
  title,
}: {
  kind: 'form' | 'opponent';
  onClose: () => void;
  sections: PlayerChartDetailSection[];
  subtitle: string;
  summary: PlayerChartDetailSummaryItem[];
  title: string;
}) {
  const titleId = useId();

  return (
    <div className="player-chart-detail-layer" data-chart-detail-kind={kind}>
      <button aria-label="Close chart detail" className="player-chart-detail-backdrop" onClick={onClose} type="button" />
      <section aria-labelledby={titleId} aria-modal="true" className="player-chart-detail" role="dialog">
        <span aria-hidden="true" className="player-chart-detail__handle" />
        <header className="player-chart-detail__header">
          <div>
            <p className="player-chart-detail__eyebrow">Fixture detail</p>
            <h2 id={titleId}>{title}</h2>
            <p className="player-chart-detail__subtitle">{subtitle}</p>
          </div>
          <button aria-label="Close chart detail" className="player-profile__icon-button" onClick={onClose} type="button">
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="player-chart-detail__summary">
          {summary.map((item) => (
            <div className="player-chart-detail__summary-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="player-chart-detail__sections">
          {sections.map((section) => (
            <section className="player-chart-detail__section" key={section.title}>
              <h3>{section.title}</h3>
              {section.rows.length > 0 ? (
                <ul>
                  {section.rows.map((row, index) => (
                    <li key={`${row.label}-${index}`}>
                      {row.points ? <strong>{row.points}</strong> : null}
                      <span>{row.label}</span>
                      {row.value ? <small>{row.value}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="player-chart-detail__empty">No recorded returns in this category.</p>
              )}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
