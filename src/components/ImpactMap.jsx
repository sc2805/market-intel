import { useState } from 'react';
import { computeAggregateImpacts, getImpactMagnitude } from '../data/newsData';

function getScoreClass(score) {
  if (score <= -5) return 'cell-severe-negative';
  if (score <= -3) return 'cell-significant-negative';
  if (score < 0) return 'cell-mild-negative';
  if (score === 0) return 'cell-neutral';
  if (score <= 1) return 'cell-mild-positive';
  if (score <= 3) return 'cell-significant-positive';
  return 'cell-strong-positive';
}

function getArrow(score) {
  if (score <= -3) return '▼▼';
  if (score < 0) return '▼';
  if (score === 0) return '—';
  if (score <= 3) return '▲';
  return '▲▲';
}

function formatLabel(key) {
  return key.replace(/_/g, ' ');
}

function HeatmapGrid({ data, className }) {
  return (
    <div className={`heatmap-grid ${className}`}>
      {Object.entries(data).map(([key, score]) => (
        <div key={key} className={`heatmap-cell ${getScoreClass(score)}`}>
          <span className="cell-label">{formatLabel(key)}</span>
          <span className="cell-score">{score > 0 ? `+${score}` : score}</span>
          <span className="cell-arrow">{getArrow(score)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ImpactMap({ newsData: stories }) {
  const [selectedStory, setSelectedStory] = useState(null);
  const [showAggregate, setShowAggregate] = useState(true);

  if (!stories || stories.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: 40, textAlign: 'center' }}>No data available</div>;
  }

  const sortedStories = [...stories].sort((a, b) => getImpactMagnitude(b) - getImpactMagnitude(a));

  const currentImpacts = showAggregate
    ? computeAggregateImpacts(stories)
    : selectedStory
    ? selectedStory.impacts
    : computeAggregateImpacts(stories);

  const handleStoryClick = (story) => {
    setShowAggregate(false);
    setSelectedStory(story);
  };

  const handleAggregateClick = () => {
    setShowAggregate(true);
    setSelectedStory(null);
  };

  return (
    <div className="impact-map">
      <div className="map-controls">
        <div className="map-controls-left">
          <button
            className={`aggregate-btn ${showAggregate ? 'active' : ''}`}
            onClick={handleAggregateClick}
          >
            ◉ Aggregate View
          </button>
          <div className="story-filter-chips">
            {sortedStories.map(story => (
              <button
                key={story.id}
                className={`story-chip ${!showAggregate && selectedStory?.id === story.id ? 'active' : ''}`}
                onClick={() => handleStoryClick(story)}
                title={story.headline}
              >
                {story.headline.substring(0, 35)}…
              </button>
            ))}
          </div>
        </div>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: '#ff2d55' }} />
            <span>-5</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: '#ff6b6b' }} />
            <span>-3</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: '#3a3a4a' }} />
            <span>0</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: '#5cd97a' }} />
            <span>+3</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: '#30d158' }} />
            <span>+5</span>
          </div>
        </div>
      </div>

      {!showAggregate && selectedStory && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--accent-dim)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255, 200, 50, 0.2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--accent)'
        }}>
          Showing impact for: <strong>{selectedStory.headline}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>
            Source: {selectedStory.source} | Type: {selectedStory.type}
          </span>
        </div>
      )}

      <div className="heatmap-section">
        <div className="heatmap-title">Markets</div>
        <HeatmapGrid data={currentImpacts.markets} className="markets" />
      </div>

      <div className="heatmap-section">
        <div className="heatmap-title">Sectors</div>
        <HeatmapGrid data={currentImpacts.sectors} className="sectors" />
      </div>

      <div className="heatmap-section">
        <div className="heatmap-title">Asset Classes</div>
        <HeatmapGrid data={currentImpacts.assets} className="assets" />
      </div>
    </div>
  );
}
