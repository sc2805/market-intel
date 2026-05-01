import { useState, useEffect } from 'react';
import ImpactMap from './components/ImpactMap';
import ShockFeed from './components/ShockFeed';
import AnalystBrief from './components/AnalystBrief';
import StockPredictions from './components/StockPredictions';
import { useMarketData } from './hooks/useMarketData';
import { getNetSentiment } from './data/newsData';

const TABS = [
  { id: 'impact-map', label: 'Impact Map', icon: '◧' },
  { id: 'shock-feed', label: 'Shock Feed', icon: '⚡' },
  { id: 'analyst-brief', label: 'Analyst Brief', icon: '📋' },
  { id: 'stock-picks', label: 'Stock Picks', icon: '📈' },
];

const SOURCE_LABELS = { static: 'STATIC DATA', cached: 'CACHED', live: 'LIVE' };
const SOURCE_COLORS = { static: '#8888a0', cached: '#ffc832', live: '#30d158' };

function App() {
  const [activeTab, setActiveTab] = useState('impact-map');
  const [currentTime, setCurrentTime] = useState(new Date());

  const {
    news, predictions, sentiment: liveSentiment,
    loading, error, lastUpdated, dataSource, apiErrors, refresh
  } = useMarketData();

  const sentiment = liveSentiment || getNetSentiment(news);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sentimentClass = sentiment.label === 'RISK-OFF' ? 'risk-off' :
                         sentiment.label === 'RISK-ON' ? 'risk-on' : 'neutral';

  const handleStoryClick = () => {
    setActiveTab('impact-map');
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">MI</div>
            <div>
              <div className="logo-text">Market Intel</div>
              <div className="logo-subtitle">Global Intelligence Terminal</div>
            </div>
          </div>
          <div className="pulse-container">
            <div className="pulse" style={{
              background: loading ? '#ffc832' : SOURCE_COLORS[dataSource]
            }} />
            <span className="pulse-label" style={{ color: SOURCE_COLORS[dataSource] }}>
              {loading ? 'FETCHING…' : SOURCE_LABELS[dataSource]}
            </span>
          </div>
        </div>

        <div className="header-right">
          {/* Data source indicator */}
          {lastUpdated && (
            <div className="timestamp" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              Data: {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: loading ? 'var(--text-muted)' : 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px',
              borderRadius: 4, cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.2s', letterSpacing: 0.5
            }}
            title="Force refresh from API"
          >
            {loading ? '⟳ …' : '⟳ REFRESH'}
          </button>

          <div className="timestamp">
            {currentTime.toLocaleDateString('en-IN', {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
            })}
            {' '}
            {currentTime.toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            })}
            {' IST'}
          </div>
          <div className={`sentiment-badge ${sentimentClass}`}>
            <span style={{ fontSize: 8 }}>●</span>
            {sentiment.label} ({sentiment.score})
          </div>
        </div>
      </header>

      {/* Error bar */}
      {error && dataSource === 'static' && (
        <div style={{
          padding: '6px 24px', background: 'rgba(255, 200, 50, 0.08)',
          borderBottom: '1px solid rgba(255, 200, 50, 0.15)',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ffc832'
        }}>
          ⚠ API unavailable — showing static data.
          {apiErrors.length > 0 && ` (${apiErrors[0]})`}
          <button onClick={refresh} style={{
            marginLeft: 12, background: 'none', border: 'none',
            color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
            fontSize: 10, textDecoration: 'underline'
          }}>Retry</button>
        </div>
      )}

      {/* Nav Tabs */}
      <nav className="nav-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'impact-map' && <ImpactMap newsData={news} />}
        {activeTab === 'shock-feed' && <ShockFeed newsData={news} onStoryClick={handleStoryClick} />}
        {activeTab === 'analyst-brief' && <AnalystBrief newsData={news} />}
        {activeTab === 'stock-picks' && <StockPredictions newsData={news} predictions={predictions} />}
      </main>
    </div>
  );
}

export default App;
