import { useState, useEffect } from 'react';
import ImpactMap from './components/ImpactMap';
import ShockFeed from './components/ShockFeed';
import AnalystBrief from './components/AnalystBrief';
import StockPredictions from './components/StockPredictions';
import { newsData, getNetSentiment } from './data/newsData';

const TABS = [
  { id: 'impact-map', label: 'Impact Map', icon: '◧' },
  { id: 'shock-feed', label: 'Shock Feed', icon: '⚡' },
  { id: 'analyst-brief', label: 'Analyst Brief', icon: '📋' },
  { id: 'stock-picks', label: 'Stock Picks', icon: '📈' },
];

function App() {
  const [activeTab, setActiveTab] = useState('impact-map');
  const [currentTime, setCurrentTime] = useState(new Date());
  const sentiment = getNetSentiment(newsData);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sentimentClass = sentiment.label === 'RISK-OFF' ? 'risk-off' : 
                         sentiment.label === 'RISK-ON' ? 'risk-on' : 'neutral';

  const handleStoryClick = (story) => {
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
            <div className="pulse" />
            <span className="pulse-label">Live</span>
          </div>
        </div>

        <div className="header-right">
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
            <span style={{ fontSize: 8 }}>{sentiment.label === 'RISK-OFF' ? '●' : '●'}</span>
            {sentiment.label} ({sentiment.score})
          </div>
        </div>
      </header>

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
        {activeTab === 'impact-map' && <ImpactMap />}
        {activeTab === 'shock-feed' && <ShockFeed onStoryClick={handleStoryClick} />}
        {activeTab === 'analyst-brief' && <AnalystBrief />}
        {activeTab === 'stock-picks' && <StockPredictions />}
      </main>
    </div>
  );
}

export default App;
