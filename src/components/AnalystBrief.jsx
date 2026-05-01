import { newsData, getTopStories, getNetSentiment, getImpactMagnitude } from '../data/newsData';

export default function AnalystBrief() {
  const topStories = getTopStories(newsData, 3);
  const sentiment = getNetSentiment(newsData);
  const totalMagnitude = newsData.reduce((sum, s) => sum + getImpactMagnitude(s), 0);

  const sentimentClass = sentiment.label === 'RISK-OFF' ? 'risk-off' : 
                         sentiment.label === 'RISK-ON' ? 'risk-on' : 'neutral';

  return (
    <div className="analyst-brief">
      <div className="brief-header">
        <div className="brief-eyebrow">Global Markets Intelligence Desk</div>
        <div className="brief-title">3 Things That Matter Before<br />Your Morning Meeting</div>
        <div className="brief-date">
          May 1, 2026 — Pre-Market Brief | {newsData.length} Stories Analyzed
        </div>
      </div>

      {topStories.map((story, index) => (
        <div key={story.id} className="brief-story">
          <div className="brief-story-number">{index + 1}</div>
          <div className="brief-story-headline">{story.headline}</div>
          <div className="brief-story-source">
            {story.source} • {story.type} • Impact Magnitude: {getImpactMagnitude(story)}
          </div>
          
          <div className="brief-section-label">Analysis</div>
          <div className="brief-analysis">{story.analysis}</div>
          
          <div className="brief-section-label">Action Items</div>
          <ul className="brief-actions">
            {story.analyst_brief.split(/\d+\)\s*/).filter(Boolean).map((item, i) => (
              <li key={i}>{item.trim()}</li>
            ))}
          </ul>
        </div>
      ))}

      <div className="brief-footer">
        <div>
          <div className="brief-footer-label">Net Market Sentiment</div>
          <div className={`brief-footer-value ${sentimentClass}`}>
            {sentiment.label === 'RISK-OFF' ? '◉ ' : sentiment.label === 'RISK-ON' ? '◉ ' : '◎ '}
            {sentiment.label}
          </div>
        </div>

        <div className="brief-footer-stat">
          <div className="brief-footer-stat-value">{sentiment.score}</div>
          <div className="brief-footer-stat-label">Net Score</div>
        </div>

        <div className="brief-footer-stat">
          <div className="brief-footer-stat-value">{sentiment.average}</div>
          <div className="brief-footer-stat-label">Avg/Cell</div>
        </div>

        <div className="brief-footer-stat">
          <div className="brief-footer-stat-value">{totalMagnitude}</div>
          <div className="brief-footer-stat-label">Total Magnitude</div>
        </div>

        <div className="brief-footer-stat">
          <div className="brief-footer-stat-value">{newsData.length}</div>
          <div className="brief-footer-stat-label">Stories Tracked</div>
        </div>
      </div>
    </div>
  );
}
