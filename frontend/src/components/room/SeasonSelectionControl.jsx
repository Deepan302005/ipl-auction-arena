import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Users, Globe, Check, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

const ALL_IPL_SEASONS = [
  2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025, 2026
];

const PRESET_OPTIONS = [
  { id: 'all-time', label: 'All-Time IPL', range: '2008–2026', desc: 'All historical & current IPL stars' },
  { id: '2008-2015', label: 'Classic Era', range: '2008–2015', desc: 'Inaugural decade legends & heroes' },
  { id: '2016-2020', label: 'Golden Era', range: '2016–2020', desc: 'Peak franchise rivalries' },
  { id: '2021-2026', label: 'Modern IPL', range: '2021–2026', desc: 'Recent seasons, young guns & debutants' },
  { id: 'range', label: 'Custom Season Range', range: 'Start – End Year', desc: 'Select custom start and end seasons' },
  { id: 'individual', label: 'Select Individual Seasons', range: 'Multi-Select', desc: 'Pick exact IPL seasons e.g. 2011, 2018, 2025' }
];

export const SeasonSelectionControl = ({
  seasonMode = 'all-time',
  selectedStartSeason = 2008,
  selectedEndSeason = 2026,
  selectedSeasons = [],
  auctionPoolFilter = 'all',
  filterYoungOnly = false,
  filterUncappedOnly = false,
  filterNonDebutantsOnly = false,
  onChange,
  disabled = false
}) => {
  const [mode, setMode] = useState(seasonMode);
  const [startSeason, setStartSeason] = useState(selectedStartSeason || 2008);
  const [endSeason, setEndSeason] = useState(selectedEndSeason || 2026);
  const [individualSeasons, setIndividualSeasons] = useState(
    Array.isArray(selectedSeasons) && selectedSeasons.length > 0 ? selectedSeasons : [2024, 2025, 2026]
  );
  const [poolFilter, setPoolFilter] = useState(auctionPoolFilter || 'all');
  const [youngOnly, setYoungOnly] = useState(filterYoungOnly || false);
  const [uncappedOnly, setUncappedOnly] = useState(filterUncappedOnly || false);
  const [nonDebutantsOnly, setNonDebutantsOnly] = useState(filterNonDebutantsOnly || false);

  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Sync internal state if props change
  useEffect(() => {
    if (seasonMode && seasonMode !== mode) setMode(seasonMode);
    if (selectedStartSeason && selectedStartSeason !== startSeason) setStartSeason(selectedStartSeason);
    if (selectedEndSeason && selectedEndSeason !== endSeason) setEndSeason(selectedEndSeason);
    if (Array.isArray(selectedSeasons)) setIndividualSeasons(selectedSeasons);
    if (auctionPoolFilter && auctionPoolFilter !== poolFilter) setPoolFilter(auctionPoolFilter);
    if (filterYoungOnly !== undefined) setYoungOnly(filterYoungOnly);
    if (filterUncappedOnly !== undefined) setUncappedOnly(filterUncappedOnly);
    if (filterNonDebutantsOnly !== undefined) setNonDebutantsOnly(filterNonDebutantsOnly);
  }, [seasonMode, selectedStartSeason, selectedEndSeason, selectedSeasons, auctionPoolFilter, filterYoungOnly, filterUncappedOnly, filterNonDebutantsOnly]);

  // Fetch live eligible player preview count whenever settings change
  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const res = await api.previewPlayerPool({
          seasonMode: mode,
          selectedStartSeason: startSeason,
          selectedEndSeason: endSeason,
          selectedSeasons: individualSeasons,
          auctionPoolFilter: poolFilter,
          filterYoungOnly: youngOnly,
          filterUncappedOnly: uncappedOnly,
          filterNonDebutantsOnly: nonDebutantsOnly
        });
        if (active && res.success && res.breakdown) {
          setPreview(res.breakdown);
        }
      } catch (err) {
        // Fallback or silent handling
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    fetchPreview();
    return () => { active = false; };
  }, [mode, startSeason, endSeason, individualSeasons, poolFilter, youngOnly, uncappedOnly, nonDebutantsOnly]);

  // Notify parent of state changes
  const notifyChange = (newMode, newStart, newEnd, newIndividual, newPoolFilter, newYoung, newUncapped, newNonDebutants) => {
    if (onChange) {
      onChange({
        seasonMode: newMode,
        selectedStartSeason: Number(newStart),
        selectedEndSeason: Number(newEnd),
        selectedSeasons: newIndividual,
        auctionPoolFilter: newPoolFilter !== undefined ? newPoolFilter : poolFilter,
        filterYoungOnly: newYoung !== undefined ? newYoung : youngOnly,
        filterUncappedOnly: newUncapped !== undefined ? newUncapped : uncappedOnly,
        filterNonDebutantsOnly: newNonDebutants !== undefined ? newNonDebutants : nonDebutantsOnly
      });
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    notifyChange(newMode, startSeason, endSeason, individualSeasons, poolFilter, youngOnly, uncappedOnly, nonDebutantsOnly);
  };

  const handleStartChange = (val) => {
    const s = Number(val);
    const e = Math.max(s, endSeason);
    setStartSeason(s);
    setEndSeason(e);
    notifyChange(mode, s, e, individualSeasons, poolFilter, youngOnly, uncappedOnly, nonDebutantsOnly);
  };

  const handleEndChange = (val) => {
    const e = Number(val);
    const s = Math.min(e, startSeason);
    setStartSeason(s);
    setEndSeason(e);
    notifyChange(mode, s, e, individualSeasons, poolFilter, youngOnly, uncappedOnly, nonDebutantsOnly);
  };

  const toggleIndividualSeason = (year) => {
    let updated;
    if (individualSeasons.includes(year)) {
      if (individualSeasons.length === 1) return; // Prevent empty selection
      updated = individualSeasons.filter(y => y !== year);
    } else {
      updated = [...individualSeasons, year].sort((a, b) => a - b);
    }
    setIndividualSeasons(updated);
    notifyChange(mode, startSeason, endSeason, updated);
  };

  const selectAllSeasons = () => {
    setIndividualSeasons([...ALL_IPL_SEASONS]);
    notifyChange(mode, startSeason, endSeason, [...ALL_IPL_SEASONS]);
  };

  const clearToRecent = () => {
    const recent = [2024, 2025, 2026];
    setIndividualSeasons(recent);
    notifyChange(mode, startSeason, endSeason, recent);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-amber-400" />
          Select Player Seasons
        </label>
        {preview && (
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
            {loadingPreview ? (
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            ) : (
              <Users className="w-3 h-3 text-amber-400" />
            )}
            <span>{preview.total} Eligible Players</span>
          </span>
        )}
      </div>

      {/* Preset Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PRESET_OPTIONS.map((opt) => {
          const isSelected = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => handleModeChange(opt.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-600/25 border-amber-400 ring-1 ring-amber-400/60 text-white shadow-md'
                  : 'bg-navy-950/70 border-navy-800 text-slate-400 hover:text-white hover:border-slate-600'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-navy-900 border border-navy-700 text-slate-300">
                  {opt.range}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Mode 5: Custom Season Range Dropdowns */}
      {mode === 'range' && (
        <div className="p-3.5 bg-navy-950 border border-navy-800 rounded-xl space-y-2.5 animate-fade-in">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <span>Choose Season Range:</span>
            <span className="font-mono text-white bg-navy-900 px-2 py-0.5 rounded border border-navy-700">
              {startSeason} – {endSeason} ({endSeason - startSeason + 1} Seasons)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-semibold mb-1">
                Start Season
              </label>
              <select
                disabled={disabled}
                value={startSeason}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              >
                {ALL_IPL_SEASONS.map((yr) => (
                  <option key={yr} value={yr} disabled={yr > endSeason}>
                    {yr} {yr === 2008 ? '(Inaugural)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-semibold mb-1">
                End Season
              </label>
              <select
                disabled={disabled}
                value={endSeason}
                onChange={(e) => handleEndChange(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              >
                {ALL_IPL_SEASONS.map((yr) => (
                  <option key={yr} value={yr} disabled={yr < startSeason}>
                    {yr} {yr === 2026 ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Mode 6: Individual Seasons Multi-Select Chips */}
      {mode === 'individual' && (
        <div className="p-3.5 bg-navy-950 border border-navy-800 rounded-xl space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-bold text-amber-400">
              Select Specific IPL Seasons ({individualSeasons.length} selected):
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={selectAllSeasons}
                className="text-blue-400 hover:text-blue-300 font-semibold underline px-1"
              >
                Select All
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={clearToRecent}
                className="text-amber-400 hover:text-amber-300 font-semibold underline px-1"
              >
                Recent (2024-26)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-1.5">
            {ALL_IPL_SEASONS.map((yr) => {
              const isSelected = individualSeasons.includes(yr);
              return (
                <button
                  key={yr}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleIndividualSeason(yr)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                      : 'bg-navy-900/80 text-slate-400 border-navy-800 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-amber-300 shrink-0" />}
                  <span>{yr}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Auction Nominees & Pool Classification Filter */}
      <div className="p-3.5 bg-navy-950/90 border border-navy-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            Auction Nominee & Talent Filter
          </label>
          <span className="text-[11px] text-amber-400/90 font-medium">
            2008–2026 Historical Archives
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { id: 'all', label: 'All Players', desc: 'Debuts & Nominees' },
            { id: 'played-matches-only', label: 'Match Players Only', desc: 'IPL Debutants' },
            { id: 'nominees-only', label: 'Nominees Only', desc: 'Non-Debutants' },
            { id: 'young-uncapped', label: 'Young & Uncapped', desc: '≤23 Emerging' },
            { id: 'shortlisted-only', label: 'Shortlisted Only', desc: 'Auction Lists' },
            { id: 'sold-only', label: 'Sold Players Only', desc: 'Historical Buys' },
            { id: 'unsold-only', label: 'Unsold Players Only', desc: 'Historical Unsold' }
          ].map((item) => {
            const isSelected = poolFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setPoolFilter(item.id);
                  notifyChange(mode, startSeason, endSeason, individualSeasons, item.id, youngOnly, uncappedOnly, nonDebutantsOnly);
                }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/30 border-blue-400 text-white font-bold ring-1 ring-blue-400/50'
                    : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200'
                } disabled:opacity-50`}
              >
                <div className="font-bold text-xs truncate leading-tight">{item.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Granular Checkbox Toggles */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-navy-800/60 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
            <input
              type="checkbox"
              disabled={disabled}
              checked={youngOnly}
              onChange={(e) => {
                const checked = e.target.checked;
                setYoungOnly(checked);
                notifyChange(mode, startSeason, endSeason, individualSeasons, poolFilter, checked, uncappedOnly, nonDebutantsOnly);
              }}
              className="rounded bg-navy-900 border-navy-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Emerging Young (≤23 DOB)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
            <input
              type="checkbox"
              disabled={disabled}
              checked={uncappedOnly}
              onChange={(e) => {
                const checked = e.target.checked;
                setUncappedOnly(checked);
                notifyChange(mode, startSeason, endSeason, individualSeasons, poolFilter, youngOnly, checked, nonDebutantsOnly);
              }}
              className="rounded bg-navy-900 border-navy-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Uncapped Players Only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
            <input
              type="checkbox"
              disabled={disabled}
              checked={nonDebutantsOnly}
              onChange={(e) => {
                const checked = e.target.checked;
                setNonDebutantsOnly(checked);
                notifyChange(mode, startSeason, endSeason, individualSeasons, poolFilter, youngOnly, uncappedOnly, checked);
              }}
              className="rounded bg-navy-900 border-navy-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Include Non-Debutants</span>
          </label>
        </div>
      </div>

      {/* Live Pool Breakdown Summary Banner */}
      {preview && (
        <div className="p-3 bg-navy-950/80 border border-navy-800/80 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-slate-300 flex-wrap">
            <span>🇮🇳 Indian: <strong className="text-white">{preview.indian}</strong></span>
            <span>✈️ Overseas: <strong className="text-amber-400">{preview.overseas}</strong></span>
            {preview.uncapped !== undefined && (
              <span>⚡ Uncapped: <strong className="text-purple-300">{preview.uncapped}</strong></span>
            )}
            {preview.young !== undefined && (
              <span>🌟 Young (≤23): <strong className="text-amber-300">{preview.young}</strong></span>
            )}
            {preview.nonDebutants !== undefined && (
              <span>📋 Nominees: <strong className="text-sky-300">{preview.nonDebutants}</strong></span>
            )}
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="text-slate-400 hidden sm:inline">
              🏏 Batters: <strong className="text-slate-200">{preview.roles?.Batter || 0}</strong> • 
              Bowlers: <strong className="text-slate-200">{preview.roles?.Bowler || 0}</strong> • 
              All-Rounders: <strong className="text-slate-200">{preview.roles?.['All-Rounder'] || 0}</strong> • 
              Keepers: <strong className="text-slate-200">{preview.roles?.Wicketkeeper || 0}</strong>
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Deduplicated Pool
          </span>
        </div>
      )}
    </div>
  );
};
