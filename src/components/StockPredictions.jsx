import { useState } from 'react';
import {
  getRecommendationColor,
  getRecommendationIcon,
  getConfidenceColor
} from '../data/stockPredictions';

const FILTER_OPTIONS = ['ALL', 'STRONG BUY', 'BUY', 'HOLD', 'SELL', 'AVOID'];

function ConfidenceBar({ value }) {
  const color = getConfidenceColor(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden'
      }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, fontWeight: 600 }}>
        {value}%
      </span>
    </div>
  );
}

function StockCard({ stock, onExpand, isExpanded, newsData }) {
  const recColor = getRecommendationColor(stock.recommendation);
  const recIcon = getRecommendationIcon(stock.recommendation);
  const isBullish = stock.recommendation.includes('BUY');
  const isBearish = stock.recommendation === 'SELL' || stock.recommendation === 'AVOID';

  const linkedStories = (stock.linkedHeadlines || [])
    .map(id => newsData.find(n => n.id === id))
    .filter(Boolean);

  const cmp = stock.cmp || 0;
  const targetMid = stock.targetRange ? (stock.targetRange[0] + stock.targetRange[1]) / 2 : cmp;
  const upside = cmp > 0 ? ((targetMid - cmp) / cmp * 100).toFixed(1) : '0.0';
  const stopLoss = stock.stopLoss || 0;
  const riskReward = cmp - stopLoss > 0 ? ((targetMid - cmp) / (cmp - stopLoss)).toFixed(1) : 'N/A';
  const maxDownside = cmp > 0 ? ((stopLoss - cmp) / cmp * 100).toFixed(1) : '0.0';

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => onExpand(stock.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 120px 1fr 100px 100px',
          gap: 16,
          padding: '16px 20px',
          background: 'var(--bg-card)',
          border: `1px solid ${isExpanded ? recColor : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          alignItems: 'center',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--bg-card-hover)';
          e.currentTarget.style.transform = 'translateX(4px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--bg-card)';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {stock.ticker}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {stock.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: 0.5 }}>
            {stock.exchange} • {stock.sector}
          </div>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 20,
          background: `${recColor}18`, border: `1px solid ${recColor}40`,
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: recColor, letterSpacing: 0.5, justifySelf: 'start'
        }}>
          {recIcon} {stock.recommendation}
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>CMP</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>₹{cmp.toLocaleString()}</div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Target</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: isBullish ? '#5cd97a' : isBearish ? '#ff6b6b' : 'var(--text-primary)' }}>
              ₹{stock.targetRange?.[0]?.toLocaleString()} – {stock.targetRange?.[1]?.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Upside</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: isBullish ? '#5cd97a' : isBearish ? '#ff6b6b' : 'var(--text-primary)' }}>
              {isBullish ? '+' : ''}{upside}%
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Confidence</div>
          <ConfidenceBar value={stock.confidence} />
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
          {stock.timeframe}
        </div>
      </div>

      {isExpanded && (
        <div style={{
          margin: '4px 0 0 0', padding: 24,
          background: 'var(--bg-card)', border: `1px solid ${recColor}40`,
          borderRadius: 'var(--radius-md)', animation: 'slideUp 0.2s ease'
        }}>
          <div style={{
            display: 'flex', gap: 32, marginBottom: 20, padding: '12px 16px',
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)'
          }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Stop Loss</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#ff6b6b' }}>₹{stopLoss.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Risk/Reward</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{riskReward}x</div>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Max Downside</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#ff8f8f' }}>{maxDownside}%</div>
            </div>
          </div>

          <div className="brief-section-label">Reasoning</div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)',
            lineHeight: 1.7, marginBottom: 16, padding: '12px',
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
            borderLeft: `2px solid ${recColor}`
          }}>
            {stock.reasoning}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div className="brief-section-label">Catalysts ▲</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(stock.catalysts || []).map((c, i) => (
                  <li key={i} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5cd97a',
                    padding: '4px 8px', background: 'rgba(92, 217, 122, 0.08)',
                    borderRadius: 4, borderLeft: '2px solid #5cd97a'
                  }}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="brief-section-label" style={{ color: '#ff6b6b' }}>Risks ▼</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(stock.risks || []).map((r, i) => (
                  <li key={i} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff8f8f',
                    padding: '4px 8px', background: 'rgba(255, 107, 107, 0.08)',
                    borderRadius: 4, borderLeft: '2px solid #ff6b6b'
                  }}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {linkedStories.length > 0 && (
            <>
              <div className="brief-section-label">Linked News Drivers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {linkedStories.map(story => (
                  <div key={story.id} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
                    padding: '6px 10px', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--accent)'
                  }}>
                    <span style={{ color: 'var(--accent)', marginRight: 8 }}>#{story.id}</span>
                    {story.headline}
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {story.source}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockPredictions({ newsData, predictions }) {
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('confidence');

  if (!predictions || predictions.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: 40, textAlign: 'center' }}>No predictions available</div>;
  }

  const filtered = filter === 'ALL'
    ? predictions
    : predictions.filter(s => s.recommendation === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === 'upside') {
      const upsideA = a.cmp > 0 ? ((a.targetRange[0] + a.targetRange[1]) / 2 - a.cmp) / a.cmp : 0;
      const upsideB = b.cmp > 0 ? ((b.targetRange[0] + b.targetRange[1]) / 2 - b.cmp) / b.cmp : 0;
      return upsideB - upsideA;
    }
    return 0;
  });

  const buyCount = predictions.filter(s => s.recommendation?.includes('BUY')).length;
  const sellCount = predictions.filter(s => s.recommendation === 'SELL' || s.recommendation === 'AVOID').length;
  const holdCount = predictions.filter(s => s.recommendation === 'HOLD').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)' }}>
            Stock Predictions — Indian Market
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Derived from {newsData?.length || 0} analyzed headlines • {predictions.length} stocks covered
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, background: 'rgba(48, 209, 88, 0.12)', color: '#30d158', border: '1px solid rgba(48, 209, 88, 0.2)' }}>{buyCount} BUY</div>
          <div style={{ padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, background: 'rgba(255, 200, 50, 0.12)', color: '#ffc832', border: '1px solid rgba(255, 200, 50, 0.2)' }}>{holdCount} HOLD</div>
          <div style={{ padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, background: 'rgba(255, 45, 85, 0.12)', color: '#ff2d55', border: '1px solid rgba(255, 45, 85, 0.2)' }}>{sellCount} SELL/AVOID</div>
        </div>
      </div>

      <div style={{
        padding: '8px 14px', background: 'rgba(255, 200, 50, 0.06)',
        border: '1px solid rgba(255, 200, 50, 0.15)', borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
        marginBottom: 16, letterSpacing: 0.3
      }}>
        ⚠ DISCLAIMER: AI-generated analysis based on news impact scoring. NOT financial advice. Always consult a SEBI-registered investment advisor.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTER_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setFilter(opt)} style={{
              padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
              border: `1px solid ${filter === opt ? getRecommendationColor(opt === 'ALL' ? '' : opt) || 'var(--accent)' : 'var(--border)'}`,
              background: filter === opt ? `${getRecommendationColor(opt === 'ALL' ? '' : opt) || 'var(--accent)'}18` : 'var(--bg-card)',
              color: filter === opt ? getRecommendationColor(opt === 'ALL' ? '' : opt) || 'var(--accent)' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s'
            }}>{opt}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginRight: 4 }}>Sort:</span>
          {['confidence', 'upside'].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{
              padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 10,
              border: `1px solid ${sortBy === s ? 'var(--accent)' : 'var(--border)'}`,
              background: sortBy === s ? 'var(--accent-dim)' : 'var(--bg-card)',
              color: sortBy === s ? 'var(--accent)' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', textTransform: 'capitalize'
            }}>{s === 'upside' ? 'Upside %' : s}</button>
          ))}
        </div>
      </div>

      {sorted.map(stock => (
        <StockCard
          key={stock.id}
          stock={stock}
          newsData={newsData || []}
          isExpanded={expandedId === stock.id}
          onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
        />
      ))}
    </div>
  );
}
