import React, { useState, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { ShieldAlert, TrendingUp, AlertTriangle, List, RotateCw, Eye, Type, AlignLeft, Calendar, ArrowDownUp, XCircle, ServerCrash, ChevronLeft, ChevronRight, CloudAlert } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config';

const CHART_COLORS = ['#ef4444', '#f59e0b', '#00E5FF', '#2dd4bf', '#a855f7', '#fb7185'];

const StatWidget = ({ label, value, icon: Icon, color, delay }) => (
  <div className="widget-card animate-slide-up" style={{ padding: '24px', animationDelay: delay, position: 'relative' }}>
    {/* Glass Reflection Highlight */}
    <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: `linear-gradient(90deg, transparent, ${color}80, transparent)` }}></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
        <div style={{ fontSize: '32px', fontWeight: '900', color: '#f8fafc', marginTop: '8px', textShadow: `0 0 20px ${color}40` }}>{value}</div>
      </div>
      <div style={{ backgroundColor: `${color}15`, padding: '16px', borderRadius: '18px', border: `1px solid ${color}30`, boxShadow: `inset 0 0 15px ${color}10` }}>
        <Icon size={32} color={color} />
      </div>
    </div>
  </div>
);

const CustomDateInput = forwardRef(({ value, onClick, isFiltered }, ref) => (
    <button 
      className={`filter-chip ${isFiltered ? 'active-date' : ''}`} 
      style={{padding:'16px 18px'}}
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }} 
      ref={ref}
    >
      <Calendar size={16} />
      {value || 'Any Date'}
    </button>
  ));

function AnalyticDashboard() {
  const [hazards, setHazards] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const [filterSource, setFilterSource] = useState('ALL'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [sortOrder, setSortOrder] = useState('DESC'); 
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;

  // 1. Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSource, filterDate, sortOrder]);

  const fetchHazards = useCallback(async () => {
    setLoading(true);
    setIsOffline(false);
    try {
      // 1. Get the secure session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active user session found.");
      }

      // 2. Attach the token to the fetch headers
      const response = await fetch(`${API_BASE_URL}/api/hazards?limit=5000`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`, // <--- THIS FIXES THE 401 ERROR
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error("Network response was not ok");

      const result = await response.json(); 
      const dataArray = Array.isArray(result) ? result : (result.data || []);
      
      const processedData = dataArray.map(h => {
        const rawType = h.hazard_type || "UNKNOWN";
        const isSign = rawType.startsWith("SIGN:");
        return {
          ...h,
          source: isSign ? 'OCR' : 'YOLO',
          cleanName: isSign ? rawType.replace("SIGN:", "").trim() : rawType.split(" at ")[0].trim(),
          localDate: new Date(h.timestamp).toLocaleDateString('en-CA') 
        };
      });
      setHazards(processedData);
    } catch (err) {
      console.error("Failed to load hazard analytics:", err);
      setHazards([]);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHazards();
  }, [fetchHazards]);

  // 2. Filter the ENTIRE dataset based on user controls
  const filteredAndSortedHazards = useMemo(() => {
    return hazards
      .filter(h => filterSource === 'ALL' || h.source === filterSource)
      .filter(h => filterDate === '' || h.localDate === filterDate)
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
      });
  }, [hazards, filterSource, filterDate, sortOrder]);

  // 3. Slice the filtered dataset to ONLY 100 items for the DOM
  const paginatedHazards = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedHazards.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredAndSortedHazards, currentPage]);

  // 4. Analytics are calculated based on the FULL filtered dataset
  const totalIncidents = filteredAndSortedHazards.length;
  const totalPages = Math.ceil(totalIncidents / PAGE_SIZE) || 1;
  const physicalHazards = filteredAndSortedHazards.filter(h => h.source === 'YOLO');
  const ocrSigns = filteredAndSortedHazards.filter(h => h.source === 'OCR');
  const criticalCount = filteredAndSortedHazards.filter(h => h.severity === 'CRITICAL').length;

  const hazardCounts = physicalHazards.reduce((acc, curr) => {
      acc[curr.cleanName] = (acc[curr.cleanName] || 0) + 1;
      return acc;
  }, {});

  const signCounts = ocrSigns.reduce((acc, curr) => {
      acc[curr.cleanName] = (acc[curr.cleanName] || 0) + 1;
      return acc;
  }, {});

  let cumulativePercent = 0;
  const donutData = Object.entries(hazardCounts)
    .sort((a, b) => b[1] - a[1]) 
    .map(([name, count], index) => {
      const percent = (count / (physicalHazards.length || 1)) * 100;
      const offset = 100 - cumulativePercent + 25; 
      cumulativePercent += percent;
      return { name, count, percent, offset, color: CHART_COLORS[index % CHART_COLORS.length] };
    });

  const barData = Object.entries(signCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({
      name, count, percent: (count / (ocrSigns.length || 1)) * 100
    }));

  const clearFilters = () => {
    setFilterSource('ALL');
    setFilterDate('');
    setSortOrder('DESC');
    setCurrentPage(1);
  };

  const isFiltering = filterSource !== 'ALL' || filterDate !== '';

  return (
    <div className="dashboard-container custom-scroll">

      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '70vh', height: '70vh', background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '-20%', right: '-5%', width: '60vh', height: '60vh', background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>

      <style>{`
        :root { --bg-card: rgba(15, 23, 42, 0.3); --text-primary: #f8fafc; --text-secondary: #94a3b8; --border-color: rgba(255,255,255,0.08); --accent-blue: #00E5FF; }

        .dashboard-container {
          height: 100vh; width: 100%; background: transparent; font-family: 'Inter', system-ui, sans-serif; color: var(--text-primary);
          display: flex; flex-direction: column; padding: 40px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden;
        }

        .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px; margin-bottom: 40px; flex-shrink: 0; }
        .main-content-grid { display: grid; grid-template-columns: 1fr 380px; gap: 32px; flex: 1; min-height: 400px; }

        /* Glassmorphism Cards */
        .widget-card {
          background: var(--bg-card); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border-radius: 24px; border: 1px solid var(--border-color); display: flex; flex-direction: column; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.4); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .widget-card:hover { transform: translateY(-4px); box-shadow: 0 25px 50px rgba(0, 229, 255, 0.15); border-color: rgba(0, 229, 255, 0.3); }

        /* --- MODERN CONTROLS STYLING --- */
        .controls-wrapper {
          display: flex; flex-wrap: wrap; gap: 16px; padding: 20px 32px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center; justify-content: space-between;
        }
        
        .segmented-control { display: inline-flex; background-color: rgba(0,0,0,0.3); padding: 6px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
        .segment-btn { padding: 10px 18px; border-radius: 12px; border: none; background: transparent; color: #64748b; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 8px; letter-spacing: 0.5px;}
        .segment-btn:hover:not(.active) { color: #f8fafc; background: rgba(255,255,255,0.05); }
        .segment-btn.active { background-color: var(--accent-blue); color: #070b14; box-shadow: 0 6px 15px rgba(0, 229, 255, 0.4); font-weight: 900; }

        .filter-chip {
          position: relative; display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px; background-color: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; color: #94a3b8; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); letter-spacing: 0.5px;
        }
        .filter-chip:hover { border-color: rgba(255,255,255,0.2); color: #f8fafc; }
        .filter-chip.active-date { border-color: rgba(168, 85, 247, 0.5); color: #fff; background-color: rgba(168, 85, 247, 0.2); box-shadow: 0 0 15px rgba(168, 85, 247, 0.2); }
        .filter-chip.active-sort { border-color: rgba(45, 212, 191, 0.5); color: #fff; background-color: rgba(45, 212, 191, 0.2); box-shadow: 0 0 15px rgba(45, 212, 191, 0.2); }
        
        .clear-btn { background: transparent; border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; cursor: pointer; padding: 10px 16px; border-radius: 12px; transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.5px;}
        .clear-btn:hover { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }

        /* --- THEME OVERRIDES FOR REACT-DATEPICKER --- */
        .custom-dark-calendar {
          background: rgba(15,23,42,0.95) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 20px !important;
          font-family: system-ui, sans-serif !important;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6) !important;
          color: #f8fafc !important;
          font-size: 1.3rem !important;
          padding: 10px !important;
        }
        .custom-dark-calendar .react-datepicker__day, 
        .custom-dark-calendar .react-datepicker__day-name { width: 2.5rem !important; line-height: 2.0rem !important; margin: 0.5rem !important; }
        .custom-dark-calendar .react-datepicker__header { background-color: transparent !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; padding-top: 12px; }
        .custom-dark-calendar .react-datepicker__current-month { color: #f8fafc !important; font-weight: 800 !important; font-size: 1.2rem !important; padding-bottom: 8px; }
        .custom-dark-calendar .react-datepicker__day-name { color: #94a3b8 !important; font-weight: 700 !important; }
        .custom-dark-calendar .react-datepicker__day { color: #cbd5e1 !important; border-radius: 8px !important; transition: 0.2s; font-weight: 500; }
        .custom-dark-calendar .react-datepicker__day:hover { background-color: rgba(255,255,255,0.1) !important; color: #f8fafc !important; }
        .custom-dark-calendar .react-datepicker__day--selected { background-color: #a855f7 !important; color: #fff !important; font-weight: 900 !important; box-shadow: 0 4px 10px rgba(168, 85, 247, 0.4); }
        .custom-dark-calendar .react-datepicker__day--keyboard-selected { background-color: rgba(168, 85, 247, 0.2) !important; }
        .custom-dark-calendar .react-datepicker__triangle { display: none !important; } 
        .custom-dark-calendar .react-datepicker__navigation-icon::before { border-color: #94a3b8 !important; border-width: 2px !important; }
        .custom-dark-calendar .react-datepicker__navigation:hover *::before { border-color: #f8fafc !important; }

        /* Table Styles */
        .table-container { flex: 1; overflow-y: auto; padding: 0 32px 32px 32px; }
        .hazard-row { display: grid; grid-template-columns: 0.5fr 1.5fr 1fr 1fr; padding: 18px 16px; border-bottom: 1px solid rgba(255,255,255,0.02); font-size: 14px; border-radius: 12px; transition: all 0.2s ease; align-items: center; }
        .hazard-row:not(.header-row):hover { background-color: rgba(0, 229, 255, 0.05); box-shadow: inset 3px 0 0 0 var(--accent-blue); transform: translateX(4px); }

        .source-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 900; letter-spacing: 1px; }
        .source-yolo { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
        .source-ocr { background: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.2); }

        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background-color: #475569; }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }

        @media (max-width: 1200px) { .main-content-grid { grid-template-columns: 1fr; } .right-sidebar { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } }
        @media (max-width: 800px) { .right-sidebar { grid-template-columns: 1fr; } .controls-wrapper { flex-direction: column; align-items: flex-start; } }
      
        .status-badge {
          display: flex; align-items: center; gap: 10px; padding: 10px 20px;
          background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px);
          border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s ease;
        }

        .header-actions { display: flex; align-items: center; gap: 16px; }
        
        .pagination-container {
          display: flex; justify-content: center; align-items: center; gap: 24px; padding: 24px;
          background-color: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);
        }
        .page-info { font-size: 13px; color: #cbd5e1; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
        .page-btn {
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc;
          padding: 10px 20px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 800; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px;
        }
        .page-btn:hover:not(:disabled) { background: rgba(0, 229, 255, 0.1); border-color: var(--accent-blue); color: var(--accent-blue); box-shadow: 0 0 15px rgba(0, 229, 255, 0.2); transform: translateY(-2px); }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>

      {/* HEADER */}
      <header className="dashboard-header animate-slide-up" style={{ 
        marginBottom: '40px', display: 'flex', justifyContent: 'space-between', 
        alignItems: 'center', flexShrink: 0, animationDelay: '0.1s', zIndex: 10 
      }}>
        <div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', letterSpacing: '-1.5px', margin: 0, color: '#f8fafc' }}>
            Safety <span style={{ color: '#00E5FF' }}>Intelligence</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', color: '#94a3b8' }}>
            <CloudAlert size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 'clamp(12px, 2vw, 14px)', fontWeight: '600' }}>Spatial Hazards And Environmental Text Warnings</span>
          </div>
        </div>
        
        <div className="header-actions">
          {/* Host Connection Indicator */}
          <div className="status-badge" style={{ 
            borderColor: isLoading ? 'rgba(161, 159, 159, 0.2)' : isOffline ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ 
              width: '8px', height: '8px', borderRadius: '50%', 
              backgroundColor: isLoading? '#808080' : isOffline ? '#ef4444' : '#10b981',
              boxShadow: `0 0 10px ${ isLoading? '#808080' : isOffline ? '#ef4444' : '#10b981'}`
            }} />
            <span style={{ fontSize: '11px', fontWeight: '900', color: isLoading? '#808080' : isOffline ? '#ef4444' : '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {isLoading ? 'Connecting ...' : isOffline ? ' Host Offline' : 'Host Online'}
            </span>
          </div>
        </div>
      </header>

      {/* TOP STATS */}
      <div className="analytics-grid">
        <StatWidget label="Filtered Events" value={isLoading ? "..." : totalIncidents} icon={ShieldAlert} color="#00E5FF" delay="0.1s" />
        <StatWidget label="Physical Hazards" value={isLoading ? "..." : physicalHazards.length} icon={Eye} color="#f59e0b" delay="0.2s" />
        <StatWidget label="Critical Alerts" value={isLoading ? "..." : criticalCount} icon={AlertTriangle} color="#ef4444" delay="0.3s" />
      </div>

      <div className="main-content-grid">
        
        <div className="widget-card animate-slide-up" style={{ minHeight: '500px', animationDelay: '0.4s', overflow: 'hidden', padding: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)', zIndex: 10 }}></div>
          
          <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <List size={20} color="#00E5FF" />
            <span style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '15px', letterSpacing: '1px' }}>Event Stream</span>
          </div>
          
          <div className="controls-wrapper">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="segmented-control">
                <button className={`segment-btn ${filterSource === 'ALL' ? 'active' : ''}`} onClick={() => setFilterSource('ALL')}>ALL SOURCES</button>
                <button className={`segment-btn ${filterSource === 'YOLO' ? 'active' : ''}`} onClick={() => setFilterSource('YOLO')}><Eye size={14}/> SPATIAL</button>
                <button className={`segment-btn ${filterSource === 'OCR' ? 'active' : ''}`} onClick={() => setFilterSource('OCR')}><Type size={14}/> TEXT</button>
              </div>

              {/* Date picker */}
              <DatePicker
                selected={filterDate ? new Date(filterDate) : null}
                onChange={(date) => {
                  setIsCalendarOpen(false);
                  if (date) {
                    const offset = date.getTimezoneOffset();
                    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                    setFilterDate(localDate.toISOString().split('T')[0]);
                  } else {
                    setFilterDate('');
                  }
                }}
                open={isCalendarOpen}
                onClickOutside={() => setIsCalendarOpen(false)}
                onInputClick={() => setIsCalendarOpen(!isCalendarOpen)}
                dateFormat="yyyy-MM-dd"
                calendarClassName="custom-dark-calendar"
                popperPlacement="bottom-start"
                customInput={<CustomDateInput isFiltered={!!filterDate} />}
              />

              <button className="filter-chip active-sort" onClick={() => setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')} title="Toggle Sort Order">
                <ArrowDownUp size={16} style={{ transform: sortOrder === 'ASC' ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {sortOrder === 'DESC' ? 'NEWEST FIRST' : 'OLDEST FIRST'}
              </button>
            </div>

            {isFiltering && (
              <button onClick={clearFilters} className="clear-btn">
                <XCircle size={16} /> CLEAR FILTERS
              </button>
            )}
          </div>
          
          <div className="table-container custom-scroll" style={{ paddingTop: '16px' }}>
            <div className="hazard-row header-row" style={{ color: '#64748b', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Source</span>
              <span>Detected Detail</span>
              <span>GPS Coordinates</span>
              <span>Timestamp</span>
            </div>
            
            {isLoading && hazards.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
                <RotateCw size={32} className="spinning" style={{ marginBottom: '16px', opacity: 0.5, color: '#00E5FF' }} />
                <br/>SYNCING TELEMETRY...
              </div>
            ) : isOffline ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#ef4444', fontSize: '15px', fontWeight: '700', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <ServerCrash size={40} opacity={0.8} />
                CANNOT CONNECT TO HOST SERVER.
              </div>
            ) : paginatedHazards.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b', fontSize: '15px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <ShieldAlert size={40} opacity={0.5} />
                {isFiltering ? "NO LOGS MATCH YOUR CURRENT FILTERS." : "NO HAZARDS DETECTED IN DATABASE."}
              </div>
            ) : (
              paginatedHazards.map((h) => (
                <div key={h.id} className="hazard-row">
                  <span>
                    {h.source === 'YOLO' 
                      ? <span className="source-badge source-yolo"><Eye size={14}/> SPATIAL</span>
                      : <span className="source-badge source-ocr"><Type size={14}/> TEXT</span>
                    }
                  </span>
                  <span style={{ color: '#f8fafc', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: h.severity === 'CRITICAL' ? '#ef4444' : '#00E5FF', boxShadow: `0 0 10px ${h.severity === 'CRITICAL' ? '#ef4444' : '#00E5FF'}` }} />
                    {h.cleanName}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: '13px' }}>
                    {h.latitude ? h.latitude.toFixed(4) : '0.0000'}°, {h.longitude ? h.longitude.toFixed(4) : '0.0000'}°
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>{new Date(h.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              ))
            )}
          </div>

          {totalIncidents > 0 && (
            <div className="pagination-container">
              <button 
                className="page-btn" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft size={16} /> PREV
              </button>
              
              <div className="page-info">
                PAGE {currentPage} OF {totalPages}
              </div>
              
              <button 
                className="page-btn" 
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= totalPages || isLoading}
              >
                NEXT <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: DUAL CHARTS SIDEBAR */}
        <div className="right-sidebar custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingRight: '8px' }}>
          
          <div className="widget-card animate-slide-up" style={{ padding: '32px', animationDelay: '0.5s' }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <TrendingUp size={20} color="#f59e0b" />
              <span style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '1px' }}>Spatial Hazards</span>
            </div>
            
            {physicalHazards.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <svg width="160" height="160" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                    {donutData.map((data, i) => (
                      <circle key={i} cx="21" cy="21" r="15.915" fill="transparent" stroke={data.color} strokeWidth="6" 
                        strokeDasharray={`${data.percent} ${100 - data.percent}`} 
                        strokeDashoffset={data.offset}
                        style={{ transition: 'stroke-dasharray 1s ease-out' }}
                      />
                    ))}
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#f8fafc' }}>{physicalHazards.length}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {donutData.slice(0,4).map((data, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: data.color, flexShrink: 0, boxShadow: `0 0 10px ${data.color}80` }} />
                        <span style={{ color: '#cbd5e1', fontWeight: '700', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.5px' }}>{data.name}</span>
                      </div>
                      <span style={{ color: '#f8fafc', fontWeight: '900' }}>{Math.round(data.percent)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>No spatial hazards detected.</div>
            )}
          </div>

          <div className="widget-card animate-slide-up" style={{ padding: '32px', animationDelay: '0.6s' }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <AlignLeft size={20} color="#a855f7" />
              <span style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '1px' }}>Text Warnings</span>
            </div>

            {ocrSigns.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {barData.map((data, i) => (
                  <div key={i} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{data.name}</span>
                      <span style={{ color: '#a855f7' }}>{data.count} DETECTIONS</span>
                    </div>
                    <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '10px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                      <div style={{ height: '100%', width: `${data.percent}%`, backgroundColor: '#a855f7', borderRadius: '10px', boxShadow: '0 0 15px rgba(168, 85, 247, 0.6)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>No text warnings detected.</div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default AnalyticDashboard;