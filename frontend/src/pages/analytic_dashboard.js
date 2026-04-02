import React, { useState, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { ShieldAlert, TrendingUp, AlertTriangle, List, RotateCw, Eye, Type, AlignLeft, Calendar, ArrowDownUp, XCircle, ServerCrash, ChevronLeft, ChevronRight } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { API_BASE_URL } from '../config';

const CHART_COLORS = ['#ef4444', '#f59e0b', '#38bdf8', '#2dd4bf', '#a855f7', '#fb7185'];

const StatWidget = ({ label, value, icon: Icon, color, delay }) => (
  <div className="widget-card animate-slide-up" style={{ padding: '24px', animationDelay: delay }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <div style={{ fontSize: '28px', fontWeight: '800', color: '#f8fafc', marginTop: '6px' }}>{value}</div>
      </div>
      <div style={{ backgroundColor: `${color}15`, padding: '14px', borderRadius: '14px', border: `1px solid ${color}30` }}>
        <Icon size={28} color={color} />
      </div>
    </div>
  </div>
);

const CustomDateInput = forwardRef(({ value, onClick, isFiltered }, ref) => (
    <button 
      className={`filter-chip ${isFiltered ? 'active-date' : ''}`} 
      style={{padding:'12px 16px'}}
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }} 
      ref={ref}
    >
      <Calendar size={14} />
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
      // Fetch a large chunk of data (e.g., 5000 items) from backend for accurate analytics
      const response = await fetch(`${API_BASE_URL}/api/hazards?limit=5000`);
      if (!response.ok) throw new Error("Network response was not ok");

      const result = await response.json(); 
      // Handle both raw array OR {data: [...]} object structures seamlessly
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
      <style>{`
        .dashboard-container {
          height: 100vh; width: 100%; background-color: #0f172a; font-family: system-ui, sans-serif; color: #f8fafc;
          display: flex; flex-direction: column; padding: 40px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden;
        }

        .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 32px; flex-shrink: 0; }
        .main-content-grid { display: grid; grid-template-columns: 1fr 380px; gap: 32px; flex: 1; min-height: 400px; }

        .widget-card {
          background-color: #16161a; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .widget-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(56, 189, 248, 0.12); border-color: rgba(56, 189, 248, 0.3); }

        /* --- MODERN CONTROLS STYLING --- */
        .controls-wrapper {
          display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center; justify-content: space-between;
        }
        
        .segmented-control { display: inline-flex; background-color: rgba(0,0,0,0.4); padding: 4px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .segment-btn { padding: 8px 16px; border-radius: 8px; border: none; background: transparent; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 6px; }
        .segment-btn:hover:not(.active) { color: #cbd5e1; }
        .segment-btn.active { background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }

        .filter-chip {
          position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background-color: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .filter-chip:hover { border-color: rgba(255,255,255,0.15); color: #cbd5e1; }
        .filter-chip.active-date { border-color: rgba(168, 85, 247, 0.4); color: #a855f7; background-color: rgba(168, 85, 247, 0.1); }
        .filter-chip.active-sort { border-color: rgba(45, 212, 191, 0.4); color: #2dd4bf; background-color: rgba(45, 212, 191, 0.1); }
        
        .clear-btn { background: transparent; border: none; color: #ef4444; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer; padding: 8px 12px; border-radius: 8px; transition: all 0.2s; opacity: 0.8; }
        .clear-btn:hover { opacity: 1; background: rgba(239, 68, 68, 0.1); }

        /* --- THEME OVERRIDES FOR REACT-DATEPICKER --- */
        .custom-dark-calendar {
          background-color: #16161a !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
          font-family: system-ui, sans-serif !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
          color: #f8fafc !important;
          font-size: 1.3rem !important;
        }
        .custom-dark-calendar .react-datepicker__day, 
        .custom-dark-calendar .react-datepicker__day-name { 
          width: 2.5rem !important; 
          line-height: 2.0rem !important; 
          margin: 0.5rem !important;
        }
        .custom-dark-calendar .react-datepicker__header {
          background-color: transparent !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          padding-top: 12px;
        }
        .custom-dark-calendar .react-datepicker__current-month { 
          color: #f8fafc !important; 
          font-weight: 700 !important; 
          font-size: 1.2rem !important; 
          padding-bottom: 8px;
        }
        .custom-dark-calendar .react-datepicker__day-name { color: #f8fafc !important; font-weight: 600 !important; }
        .custom-dark-calendar .react-datepicker__day { color: #94a3b8 !important; border-radius: 6px !important; transition: 0.2s; }
        .custom-dark-calendar .react-datepicker__day:hover { background-color: rgba(255,255,255,0.1) !important; color: #f8fafc !important; }
        .custom-dark-calendar .react-datepicker__day--selected { background-color: #a855f7 !important; color: #fff !important; font-weight: bold; }
        .custom-dark-calendar .react-datepicker__day--keyboard-selected { background-color: rgba(168, 85, 247, 0.4) !important; }
        .custom-dark-calendar .react-datepicker__triangle { display: none !important; } 
        .custom-dark-calendar .react-datepicker__navigation-icon::before { border-color: #94a3b8 !important; }
        .custom-dark-calendar .react-datepicker__navigation:hover *::before { border-color: #f8fafc !important; }

        /* Table Styles */
        .table-container { flex: 1; overflow-y: auto; padding: 0 24px 24px 24px; }
        .hazard-row { display: grid; grid-template-columns: 0.5fr 1.5fr 1fr 1fr; padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 13px; border-radius: 8px; transition: background-color 0.2s ease; align-items: center; }
        .hazard-row:not(.header-row):hover { background-color: rgba(56, 189, 248, 0.05); }

        .source-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .source-yolo { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
        .source-ocr { background: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.2); }

        .refresh-btn { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 10px 20px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .refresh-btn:hover:not(:disabled) { background: rgba(56, 189, 248, 0.2); transform: translateY(-2px); box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2); }
        .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background-color: #475569; }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }

        @media (max-width: 1200px) { .main-content-grid { grid-template-columns: 1fr; } .right-sidebar { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } }
        @media (max-width: 800px) { .right-sidebar { grid-template-columns: 1fr; } .controls-wrapper { flex-direction: column; align-items: flex-start; } }
      
        .status-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background-color: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.3s ease;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        @media (max-width: 800px) {
          .dashboard-header { flex-direction: column; align-items: flex-start; gap: 20px; }
          .header-actions { width: 100%; justify-content: space-between; }
        }

        .pagination-container {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background-color: rgba(0,0,0,0.2);
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .page-info {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 600;
        }
        .page-btn {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.1);
          color: #f8fafc;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          transition: all 0.2s;
        }
        .page-btn:hover:not(:disabled) {
          background: #334155;
          border-color: #38bdf8;
          color: #38bdf8;
        }
        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>

      {/* HEADER */}
      <header className="dashboard-header animate-slide-up" style={{ 
        marginBottom: '32px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexShrink: 0, 
        animationDelay: '0.1s' 
      }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-1px', margin: 0, color: '#f8fafc' }}>
            Safety Intelligence
          </h1>
          <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '15px' }}>
            Spatial hazards and environmental text warnings.
          </p>
        </div>
        
        <div className="header-actions">
          {/* Host Connection Indicator */}
          <div className="status-badge" style={{ 
            borderColor: isLoading ? 'rgba(161, 159, 159, 0.2)' : isOffline ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            boxShadow: isLoading ? 'rgba(161, 159, 159, 0.2)' : isOffline ? '0 0 15px rgba(239, 68, 68, 0.05)' : '0 0 15px rgba(34, 197, 94, 0.05)'
          }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isLoading? '#808080' : isOffline ? '#ef4444' : '#22c55e',
              boxShadow: `0 0 8px ${ isLoading? '#808080' : isOffline ? '#ef4444' : '#22c55e'}`
            }} />
            <span style={{ 
              fontSize: '11px', 
              fontWeight: '700', 
              color: isLoading? '#808080' : isOffline ? '#ef4444' : '#22c55e', 
              textTransform: 'uppercase', 
              letterSpacing: '1px' 
            }}>
              {isLoading ? 'Connecting ...' : isOffline ? ' Host Offline' : 'Host Online'}
            </span>
          </div>

          <button className="refresh-btn" onClick={fetchHazards} disabled={isLoading}>
            <RotateCw size={18} className={isLoading ? 'spinning' : ''} />
            {isLoading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* TOP STATS */}
      <div className="analytics-grid">
        <StatWidget label="Filtered Events" value={isLoading ? "..." : totalIncidents} icon={ShieldAlert} color="#38bdf8" delay="0.1s" />
        <StatWidget label="Physical Hazards" value={isLoading ? "..." : physicalHazards.length} icon={Eye} color="#f59e0b" delay="0.2s" />
        <StatWidget label="Critical Alerts" value={isLoading ? "..." : criticalCount} icon={AlertTriangle} color="#ef4444" delay="0.3s" />
      </div>

      <div className="main-content-grid">
        
        <div className="widget-card animate-slide-up" style={{ minHeight: '500px', animationDelay: '0.4s', overflow: 'hidden', padding: 0 }}>
          
          <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <List size={20} color="#38bdf8" />
            <span style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.5px' }}>Event Stream</span>
          </div>
          
          <div className="controls-wrapper">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="segmented-control">
                <button className={`segment-btn ${filterSource === 'ALL' ? 'active' : ''}`} onClick={() => setFilterSource('ALL')}>All Sources</button>
                <button className={`segment-btn ${filterSource === 'YOLO' ? 'active' : ''}`} onClick={() => setFilterSource('YOLO')}><Eye size={12}/> Spatial</button>
                <button className={`segment-btn ${filterSource === 'OCR' ? 'active' : ''}`} onClick={() => setFilterSource('OCR')}><Type size={12}/> Text</button>
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
                <ArrowDownUp size={14} style={{ transform: sortOrder === 'ASC' ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}
              </button>
            </div>

            {isFiltering && (
              <button onClick={clearFilters} className="clear-btn">
                <XCircle size={14} /> Clear Filters
              </button>
            )}
          </div>
          
          <div className="table-container custom-scroll" style={{ paddingTop: '12px' }}>
            <div className="hazard-row header-row" style={{ color: '#64748b', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
              <span>Source</span>
              <span>Detected Detail</span>
              <span>GPS Coordinates</span>
              <span>Timestamp</span>
            </div>
            
            {isLoading && hazards.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                <RotateCw size={24} className="spinning" style={{ marginBottom: '12px', opacity: 0.5 }} />
                <br/>Fetching telemetry from cloud...
              </div>
            ) : isOffline ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ef4444', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ServerCrash size={32} opacity={0.8} />
                Cannot connect to host server. Please verify backend is running.
              </div>
            ) : paginatedHazards.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ShieldAlert size={32} opacity={0.5} />
                {isFiltering ? "No logs match your current filters." : "No logs found in Supabase. Coast is clear!"}
              </div>
            ) : (
              paginatedHazards.map((h) => (
                <div key={h.id} className="hazard-row">
                  <span>
                    {h.source === 'YOLO' 
                      ? <span className="source-badge source-yolo"><Eye size={12}/> SPATIAL</span>
                      : <span className="source-badge source-ocr"><Type size={12}/> TEXT</span>
                    }
                  </span>
                  <span style={{ color: '#f8fafc', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: h.severity === 'CRITICAL' ? '#ef4444' : '#38bdf8', boxShadow: `0 0 8px ${h.severity === 'CRITICAL' ? '#ef4444' : '#38bdf8'}` }} />
                    {h.cleanName}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '12px' }}>
                    {h.latitude ? h.latitude.toFixed(4) : '0.0000'}°, {h.longitude ? h.longitude.toFixed(4) : '0.0000'}°
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '12px' }}>{new Date(h.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              ))
            )}
          </div>

          {/* Render pagination only if there are items */}
          {totalIncidents > 0 && (
            <div className="pagination-container">
              <button 
                className="page-btn" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              
              <div className="page-info">
                Page {currentPage} of {totalPages}
              </div>
              
              <button 
                className="page-btn" 
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= totalPages || isLoading}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: DUAL CHARTS SIDEBAR */}
        <div className="right-sidebar custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingRight: '8px' }}>
          
          <div className="widget-card animate-slide-up" style={{ padding: '24px', animationDelay: '0.5s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <TrendingUp size={20} color="#f59e0b" />
              <span style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>Spatial Hazards</span>
            </div>
            
            {physicalHazards.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <svg width="120" height="120" viewBox="0 0 42 42">
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
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc' }}>{physicalHazards.length}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {donutData.slice(0,4).map((data, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: data.color, flexShrink: 0 }} />
                        <span style={{ color: '#cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</span>
                      </div>
                      <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{Math.round(data.percent)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No spatial hazards for this filter.</div>
            )}
          </div>

          <div className="widget-card animate-slide-up" style={{ padding: '24px', animationDelay: '0.6s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <AlignLeft size={20} color="#a855f7" />
              <span style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>Text Warnings</span>
            </div>

            {ocrSigns.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {barData.map((data, i) => (
                  <div key={i} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{data.name}</span>
                      <span style={{ color: '#a855f7' }}>{data.count}x</span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: '#020617', borderRadius: '10px' }}>
                      <div style={{ height: '100%', width: `${data.percent}%`, backgroundColor: '#a855f7', borderRadius: '10px', boxShadow: '0 0 10px rgba(168, 85, 247, 0.4)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No text warnings for this filter.</div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default AnalyticDashboard;