import { X } from 'lucide-react';
import { useEffect, useId } from 'react';

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

  useEffect(() => {
    const documentElement = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      documentElement.style.overflow = previousDocumentOverflow;
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      window.scrollTo(scrollX, scrollY);
    };
  }, []);

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

        <div className="player-chart-detail__body">
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
                      <li className={kind === 'form' ? 'player-chart-detail__row--form' : undefined} key={`${row.label}-${index}`}>
                        {kind === 'form' ? (
                          <>
                            <span className="player-chart-detail__row-label">{row.label}</span>
                            {row.value ? <small className="player-chart-detail__row-value">{row.value}</small> : null}
                            {row.points ? <strong className={row.points.startsWith('-') ? 'is-negative' : undefined}>{row.points}</strong> : null}
                          </>
                        ) : (
                          <>
                            {row.points ? <strong>{row.points}</strong> : null}
                            <span>{row.label}</span>
                            {row.value ? <small>{row.value}</small> : null}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="player-chart-detail__empty">No recorded returns in this category.</p>
                )}
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
