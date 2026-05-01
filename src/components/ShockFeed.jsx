import { useState } from 'react';
import { newsData, getImpactMagnitude, getStoriesByImpact } from '../data/newsData';

function getMarketTags(impacts) {
  const tags = [];
  Object.entries(impacts.markets).forEach(([key, score]) => {
    if (score !== 0) {
      tags.push({ name: key.replace(/_/g, ' '), score, type: score > 0 ? 'positive' : 'negative' });
    }
  });
  // Sort by absolute value so most impacted markets show first
  return tags.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

function getMagnitudePercent(magnitude, maxMagnitude) {
  return Math.min((magnitude / maxMagnitude) * 100, 100);
}

function getMagnitudeColor(magnitude) {
  if (magnitude >= 60) return '#ff2d55';
  if (magnitude >= 40) return '#ff6b6b';
  if (magnitude >= 20) return '#ffc832';
  return '#5cd97a';
}

export default function ShockFeed({ onStoryClick }) {
  const sorted = getStoriesByImpact(newsData);
  const maxMagnitude = getImpactMagnitude(sorted[0]);
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="shock-feed">
      <div className="shock-feed-header">
        <div className="shock-feed-title">Shock Feed — Ranked by Impact Magnitude</div>
        <div className="feed-count">{sorted.length} stories tracked</div>
      </div>

      {sorted.map((story, index) => {
        const magnitude = getImpactMagnitude(story);
        const marketTags = getMarketTags(story.impacts);
        const pct = getMagnitudePercent(magnitude, maxMagnitude);
        const color = getMagnitudeColor(magnitude);
        const isExpanded = expandedId === story.id;

        return (
          <div key={story.id}>
            <div
              className="story-card"
              onClick={() => {
                setExpandedId(isExpanded ? null : story.id);
                if (onStoryClick) onStoryClick(story);
              }}
            >
              <div className="story-rank">
                <span className="rank-number">#{index + 1}</span>
                <span className="rank-label">Impact</span>
              </div>

              <div className="story-content">
                <div className="story-headline">{story.headline}</div>
                <div className="story-meta">
                  <span className="story-source">{story.source}</span>
                  <span className="story-type-tag">{story.type}</span>
                </div>
                <div className="story-market-tags">
                  {marketTags.slice(0, 6).map(tag => (
                    <span key={tag.name} className={`market-tag ${tag.type}`}>
                      {tag.name} {tag.score > 0 ? `+${tag.score}` : tag.score}
                    </span>
                  ))}
                </div>
              </div>

              <div className="story-impact-bar">
                <span className="impact-magnitude" style={{ color }}>
                  {magnitude}
                </span>
                <span className="impact-label">Total Impact</span>
                <div className="magnitude-bar">
                  <div
                    className="magnitude-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="modal-content" style={{
                margin: '4px 0 8px 76px',
                maxWidth: 'calc(100% - 76px)',
                animation: 'slideUp 0.2s ease'
              }}>
                <div className="brief-section-label">Analysis</div>
                <div className="modal-analysis" style={{ margin: '0 0 16px 0' }}>
                  {story.analysis}
                </div>
                <div className="brief-section-label">Analyst Action Items</div>
                <ul className="brief-actions">
                  {story.analyst_brief.split(/\d+\)\s*/).filter(Boolean).map((item, i) => (
                    <li key={i}>{item.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
