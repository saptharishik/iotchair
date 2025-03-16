import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, query, orderByKey, get } from 'firebase/database';
import { database } from '../../config/firebase';

const ChairActivityLog = () => {
  const { chairId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateEvents, setDateEvents] = useState([]);
  const [searchDate, setSearchDate] = useState('');
  const [chairInfo, setChairInfo] = useState(null);
  const [sittingTime, setSittingTime] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  // Check if dark mode preference is stored in localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);
  
  // Toggle dark mode and save preference to localStorage
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  }

  // Format date for display
  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Load chair info and reports
  useEffect(() => {
    // Get chair info
    const chairRef = ref(database, `chairs/${chairId}`);
    onValue(chairRef, (snapshot) => {
      if (snapshot.exists()) {
        setChairInfo(snapshot.val());
      } else {
        setError('Chair not found');
      }
    }, (error) => {
      setError('Failed to load chair data: ' + error.message);
    });

    // Get all reports organized by date
    const reportsRef = query(ref(database, `chairs/${chairId}/reports`), orderByKey());
    onValue(reportsRef, (snapshot) => {
      if (snapshot.exists()) {
        const reports = snapshot.val();
        const reportDates = Object.keys(reports).sort().reverse(); // Sort dates in descending order
        
        const formattedReports = reportDates.map(date => {
          const reportData = reports[date];
          const summary = reportData.summary || {};
          const eventCount = reportData.events ? Object.keys(reportData.events).length : 0;
          
          return {
            date,
            formattedDate: formatDate(date),
            totalMinutes: summary.totalMinutes || 0,
            positionChanges: summary.positionChanges || 0,
            eventCount,
            rawData: reportData
          };
        });
        
        setDailyReports(formattedReports);
        
        // If no date is selected, select the most recent date
        if (!selectedDate && formattedReports.length > 0) {
          setSelectedDate(formattedReports[0].date);
          loadDateDetails(formattedReports[0].date, reports[formattedReports[0].date]);
          
          // Set the sitting time for the most recent date
          if (reports[formattedReports[0].date] && reports[formattedReports[0].date].summary) {
            setSittingTime(reports[formattedReports[0].date].summary.totalMinutes || 0);
          }
        }
      }
      setLoading(false);
    }, (error) => {
      setError('Failed to load reports: ' + error.message);
      setLoading(false);
    });
  }, [chairId, selectedDate]);

  // Load details for a specific date
  const loadDateDetails = (date, reportData) => {
    if (!reportData || !reportData.events) {
      setDateEvents([]);
      return;
    }

    const events = reportData.events;
    const eventKeys = Object.keys(events);
    
    // Convert events object to array and sort by timestamp (now in descending order - newest first)
    const eventArray = eventKeys.map(key => ({
      id: key,
      ...events[key]
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    setDateEvents(eventArray);
  };

  // Handle date selection
  const handleDateSelect = (date, reportData) => {
    setSelectedDate(date);
    loadDateDetails(date, reportData);
    
    // Update sitting time to match the selected report's data
    if (reportData && reportData.summary && reportData.summary.totalMinutes !== undefined) {
      setSittingTime(reportData.summary.totalMinutes);
    } else {
      // If no summary data exists, set sitting time to 0
      setSittingTime(0);
    }
  };

  // Handle date search
  const handleSearch = () => {
    if (!searchDate) return;
    
    // Find the report that matches the search date
    const matchingReport = dailyReports.find(report => report.date === searchDate);
    
    if (matchingReport) {
      setSelectedDate(matchingReport.date);
      loadDateDetails(matchingReport.date, matchingReport.rawData);
      
      // Update sitting time for the searched date
      if (matchingReport.rawData && matchingReport.rawData.summary) {
        setSittingTime(matchingReport.rawData.summary.totalMinutes || 0);
      }
    } else {
      setError(`No data found for ${formatDate(searchDate)}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // Get icon for event type
  const getEventIcon = (eventType) => {
    switch(eventType) {
      case 'sittingStart': return '🪑';
      case 'sittingSession': return '⏱️';
      case 'positionChange': return '↔️';
      case 'hydrationReminder': return '💧';
      case 'hydrationDismissed': return '🚫';
      default: return '📝';
    }
  };

  // Get event description
  const getEventDescription = (event) => {
    switch(event.type) {
      case 'sittingStart':
        return `Started sitting session`;
      case 'sittingSession':
        return `Completed sitting session`;
      case 'positionChange':
        return `Changed position`;
      case 'hydrationReminder':
        return `Hydration reminder`;
      case 'hydrationDismissed':
        return 'Dismissed hydration reminder';
      default:
        return `${event.type} event`;
    }
  };

  // Calculate daily statistics
  const calculateDailyStats = (events) => {
    const stats = {
      positionChanges: 0,
      hydrationReminders: 0
    };

    events.forEach(event => {
      switch(event.type) {
        case 'positionChange':
          stats.positionChanges++;
          break;
        case 'hydrationReminder':
          stats.hydrationReminders++;
          break;
      }
    });

    return stats;
  };

  // Format duration in hours and minutes
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  };

  // Calculate statistics for the selected date
  const stats = selectedDate && dateEvents.length > 0 ? calculateDailyStats(dateEvents) : null;

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950' 
        : 'bg-gradient-to-br from-blue-100 to-indigo-100'
    }`}>
      <div className={`w-full max-w-6xl px-8 py-10 mx-4 rounded-xl shadow-lg transition-colors duration-300 ${
        darkMode 
          ? 'bg-gray-900 text-gray-100 border border-gray-800' 
          : 'bg-white text-gray-800 border border-gray-100'
      }`}>
        {/* Dark Mode Toggle */}
        <div className="absolute top-4 right-4">
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-full transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' 
                : 'bg-gray-200 text-indigo-600 hover:bg-gray-300'
            }`}
            aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Logo and Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-4 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
              </svg>
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Chair #{chairId} Activity Log
              </h1>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                Smart Chair Monitoring System
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/chair/${chairId}`)} 
            className={`px-4 py-2.5 text-white rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              darkMode 
                ? 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-500' 
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            } shadow`}
          >
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Monitor
            </div>
          </button>
        </div>
  
        {error && (
          <div className={`border-l-4 border-red-500 px-5 py-4 rounded-lg mb-6 shadow-sm ${
            darkMode ? 'bg-red-900 bg-opacity-30 text-red-300' : 'bg-red-100 text-red-700'
          }`}>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mr-3 ${
                darkMode ? 'text-red-400' : 'text-red-500'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}
  
        {chairInfo && (
          <div className={`mb-6 p-5 rounded-lg border shadow-sm ${
            darkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <h2 className={`text-xl font-semibold mb-3 flex items-center ${
              darkMode ? 'text-gray-100' : 'text-gray-800'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                darkMode ? 'text-blue-400' : 'text-blue-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Chair Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className={`p-3 rounded-lg border shadow-sm ${
                darkMode 
                  ? 'bg-gray-900 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}>
                <p className={darkMode ? 'text-sm text-gray-400 mb-1' : 'text-sm text-gray-500 mb-1'}>Name</p>
                <p className={darkMode ? 'font-medium text-gray-100' : 'font-medium text-gray-800'}>
                  {chairInfo.name || `Chair #${chairId}`}
                </p>
              </div>
              <div className={`p-3 rounded-lg border shadow-sm ${
                darkMode 
                  ? 'bg-gray-900 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}>
                <p className={darkMode ? 'text-sm text-gray-400 mb-1' : 'text-sm text-gray-500 mb-1'}>
                  Usage for Selected Date
                </p>
                <p className={darkMode ? 'font-medium text-gray-100' : 'font-medium text-gray-800'}>
                  {formatDuration(sittingTime)}
                </p>
              </div>
            </div>
          </div>
        )}
  
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left column - Date list and search */}
          <div className="w-full md:w-1/3">
            <div className={`border shadow-md rounded-lg p-5 mb-6 ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Date Search
              </h2>
              <div className="flex gap-3 mb-1">
                <input 
                  type="date" 
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className={`flex-grow py-2.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200' 
                      : 'bg-gray-50 border border-gray-200 text-gray-800'
                  }`}
                />
                <button 
                  onClick={handleSearch}
                  className={`px-4 py-2.5 rounded-lg shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 text-white ${
                    darkMode 
                      ? 'bg-green-700 hover:bg-green-800 focus:ring-green-500' 
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
  
            <div className={`border shadow-md rounded-lg p-5 ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Daily Reports
              </h2>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className={`w-12 h-12 border-4 rounded-full animate-spin ${
                    darkMode
                      ? 'border-gray-700 border-t-blue-400'
                      : 'border-blue-200 border-t-blue-600'
                  }`}></div>
                  <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading reports...
                  </p>
                </div>
              ) : dailyReports.length === 0 ? (
                <div className={`py-10 text-center rounded-lg border ${
                  darkMode
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mx-auto mb-3 ${
                    darkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className={`font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    No activity data available
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto pr-1 space-y-3">
                  {dailyReports.map(report => (
                    <div 
                      key={report.date}
                      onClick={() => handleDateSelect(report.date, report.rawData)}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md border ${
                        selectedDate === report.date 
                          ? darkMode
                            ? 'border-blue-600 bg-blue-900 bg-opacity-30'
                            : 'border-blue-500 bg-blue-50'
                          : darkMode
                            ? 'border-gray-700 hover:border-blue-600 bg-gray-800'
                            : 'border-gray-200 hover:border-blue-300 bg-gray-50'
                      }`}
                    >
                      <p className={`font-medium ${
                        darkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>{report.formattedDate}</p>
                      <div className="flex justify-between mt-2 text-sm">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${
                            darkMode ? 'text-blue-400' : 'text-blue-500'
                          }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                            Usage: {formatDuration(report.totalMinutes)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${
                            darkMode ? 'text-blue-400' : 'text-blue-500'
                          }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                            Events: {report.eventCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
  
          {/* Right column - Selected date details */}
          <div className="w-full md:w-2/3">
            {selectedDate ? (
              <div className={`border shadow-md rounded-lg p-5 ${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <h2 className={`text-xl font-semibold mb-5 flex items-center ${
                  darkMode ? 'text-gray-100' : 'text-gray-800'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                    darkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Activity for {formatDate(selectedDate)}
                </h2>
                
                {stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                    <div className={`p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                      darkMode
                        ? 'bg-blue-900 bg-opacity-20 border-blue-800'
                        : 'bg-blue-50 border-blue-100'
                    }`}>
                      <div className="flex items-start">
                        <div className={`mr-3 p-2 rounded-full ${
                          darkMode
                            ? 'bg-blue-800 text-blue-300'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${
                            darkMode ? 'text-blue-300' : 'text-blue-600'
                          }`}>Total Sitting Time</p>
                          <p className={`text-2xl font-bold ${
                            darkMode ? 'text-blue-100' : 'text-blue-800'
                          }`}>{formatDuration(sittingTime)}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                      darkMode
                        ? 'bg-purple-900 bg-opacity-20 border-purple-800'
                        : 'bg-purple-50 border-purple-100'
                    }`}>
                      <div className="flex items-start">
                        <div className={`mr-3 p-2 rounded-full ${
                          darkMode
                            ? 'bg-purple-800 text-purple-300'
                            : 'bg-purple-100 text-purple-600'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${
                            darkMode ? 'text-purple-300' : 'text-purple-600'
                          }`}>Position Changes</p>
                          <p className={`text-2xl font-bold ${
                            darkMode ? 'text-purple-100' : 'text-purple-800'
                          }`}>{stats.positionChanges}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                      darkMode
                        ? 'bg-amber-900 bg-opacity-20 border-amber-800'
                        : 'bg-amber-50 border-amber-100'
                    }`}>
                      <div className="flex items-start">
                        <div className={`mr-3 p-2 rounded-full ${
                          darkMode
                            ? 'bg-amber-800 text-amber-300'
                            : 'bg-amber-100 text-amber-600'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${
                            darkMode ? 'text-amber-300' : 'text-amber-600'
                          }`}>Hydration Reminders</p>
                          <p className={`text-2xl font-bold ${
                            darkMode ? 'text-amber-100' : 'text-amber-800'
                          }`}>{stats.hydrationReminders}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-semibold text-lg flex items-center ${
                    darkMode ? 'text-gray-100' : 'text-gray-800'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                      darkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Event Timeline
                  </h3>
                </div>
                
                {dateEvents.length === 0 ? (
                  <div className={`py-10 text-center rounded-lg border ${
                    darkMode
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mx-auto mb-3 ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className={`font-medium ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>No detailed events available for this date</p>
                  </div>
                ) : (
                  <div className={`relative pl-10 max-h-[500px] overflow-y-auto pr-2 space-y-5 ${
                    darkMode ? 'border-l-2 border-blue-800' : 'border-l-2 border-blue-200'
                  }`}>
                    {dateEvents.map((event) => (
                      <div key={event.id} className="relative">
                        <div className={`absolute -left-[21px] w-10 h-10 flex items-center justify-center rounded-full shadow-sm ${
                          darkMode
                            ? 'bg-gray-800 border-2 border-blue-700'
                            : 'bg-white border-2 border-blue-300'
                        }`}>
                          <span>{getEventIcon(event.type)}</span>
                        </div>
                        <div className={`p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-200 ${
                          darkMode
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <p className={`text-sm mb-2 ${
                            darkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>{formatTime(event.timestamp)}</p>
                          <p className={`font-medium ${
                            darkMode ? 'text-gray-200' : 'text-gray-800'
                          }`}>{getEventDescription(event)}</p>
                          
                          {/* Additional event details */}
                          {event.type === 'sittingSession' && (
                            <div className={`mt-3 text-sm p-3 rounded-lg border shadow-inner ${
                              darkMode
                                ? 'bg-gray-900 border-gray-700 text-gray-400'
                                : 'bg-white border-gray-100 text-gray-600'
                            }`}>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <p><span className={`font-medium ${
                                  darkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>Started:</span> {formatTime(event.startTime)}</p>
                                <p><span className={`font-medium ${
                                  darkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>Ended:</span> {formatTime(event.endTime)}</p>
                                <p><span className={`font-medium ${
                                  darkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>Position:</span> {event.position}</p>
                                <p><span className={`font-medium ${
                                  darkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>Position changes:</span> {event.positionChanges || 0}</p>
                              </div>
                            </div>
                          )}
                          
                          {event.type === 'positionChange' && (
                            <div className={`mt-3 text-sm flex items-center gap-2 p-3 rounded-lg border shadow-inner ${
                              darkMode
                                ? 'bg-gray-900 border-gray-700 text-gray-400'
                                : 'bg-white border-gray-100 text-gray-600'
                            }`}>
                              <span className={`font-medium ${
                                darkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>{event.oldPosition}</span>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${
                                darkMode ? 'text-blue-400' : 'text-blue-500'
                              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                              <span className={`font-medium ${
                                darkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>{event.newPosition}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={`border shadow-md rounded-lg p-8 flex flex-col items-center justify-center h-96 ${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 mb-4 ${
                  darkMode ? 'text-gray-600' : 'text-gray-300'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className={`text-lg text-center ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>Select a date from the list to view activity details</p>
                <p className={`text-sm mt-2 text-center ${
                  darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>Or use the date search to find specific records</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChairActivityLog;