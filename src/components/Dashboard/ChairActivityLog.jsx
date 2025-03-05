import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, query, orderByKey,get } from 'firebase/database';
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
  const [sittingTime,setSittingtTime] = useState(0);


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
        }
      }
      setLoading(false);
    }, (error) => {
      setError('Failed to load reports: ' + error.message);
      setLoading(false);
    });
  }, [chairId]);

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
  };

  // Handle date search
  const handleSearch = () => {
    if (!searchDate) return;
    
    // Find the report that matches the search date
    const matchingReport = dailyReports.find(report => report.date === searchDate);
    
    if (matchingReport) {
      setSelectedDate(matchingReport.date);
      loadDateDetails(matchingReport.date, matchingReport.rawData);
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
        return `Started sitting session in ${event.position || 'unknown'} position`;
      case 'sittingSession':
        return `Completed sitting session (${parseFloat(event.duration).toFixed(1)} minutes)`;
      case 'positionChange':
        return `Changed position from ${event.from} to ${event.to}`;
      case 'hydrationReminder':
        return `Hydration reminder after ${parseFloat(event.sittingDuration).toFixed(1)} minutes of sitting`;
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

  const stats = selectedDate && dateEvents.length > 0 ? calculateDailyStats(dateEvents) : null;
  const TimeRef = ref(database, `chairs/${chairId}/reports/${selectedDate}/prev_timer`);

    get(TimeRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                setSittingtTime(snapshot.val()); // Update state with retrieved value
                console.log("Previous Timer:", snapshot.val());
            } else {
                console.log("No previous timer found!");
            }
        })
        .catch((error) => {
            console.error("Error retrieving previous timer:", error);
        });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-100">
      <div className="w-full max-w-6xl px-8 py-10 mx-4 bg-white rounded-xl shadow-lg">
        {/* Logo and Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Chair #{chairId} Activity Log</h1>
              <p className="text-gray-600">Smart Chair Monitoring System</p>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/chair/${chairId}`)} 
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Back to Monitor
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-sm">
            {error}
          </div>
        )}

        {chairInfo && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold mb-2 text-gray-800">Chair Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 ">Name</p>
                <p className="font-medium text-black" >{chairInfo.name || `Chair #${chairId}`}</p>
              </div>
              {/* <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium text-black">{chairInfo.location || 'Not specified'}</p>
              </div> */}
              <div>
                <p className="text-sm text-gray-500">Total Usage</p>
                <p className="font-medium text-black">{formatDuration(chairInfo.minutes || 0)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left column - Date list and search */}
          <div className="w-full md:w-1/3">
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Date Search</h2>
              <div className="flex gap-2 mb-4">
                <input 
                  type="date" 
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="flex-grow border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <button 
                  onClick={handleSearch}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Daily Reports</h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : dailyReports.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">No activity data available</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto pr-1">
                  {dailyReports.map(report => (
                    <div 
                      key={report.date}
                      onClick={() => handleDateSelect(report.date, report.rawData)}
                      className={`p-3 mb-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${selectedDate === report.date ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <p className="font-medium text-gray-800">{report.formattedDate}</p>
                      <div className="flex justify-between mt-2 text-sm text-gray-600">
                        <p>Usage: {formatDuration(report.totalMinutes)}</p>
                        <p>Events: {report.eventCount}</p>
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
              <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Activity for {formatDate(selectedDate)}
                </h2>
                
                {stats && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                      <p className="text-sm text-blue-600">Total Sitting Time</p>
                      <p className="text-xl font-bold text-blue-800">{sittingTime.toFixed(2)}</p>
                    </div>
                    {/* <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm">
                      <p className="text-sm text-green-600">Sitting Sessions</p>
                      <p className="text-xl font-bold text-green-800">{stats.sittingSessions}</p>
                    </div> */}
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 shadow-sm">
                      <p className="text-sm text-purple-600">Position Changes</p>
                      <p className="text-xl font-bold text-purple-800">{stats.positionChanges}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 shadow-sm">
                      <p className="text-sm text-amber-600">Hydration Reminders</p>
                      <p className="text-xl font-bold text-amber-800">{stats.hydrationReminders}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg text-gray-800">Event Timeline</h3>
                  {/* <div className="text-sm text-gray-500">Showing newest events first</div> */}
                </div>
                
                {dateEvents.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-gray-500">No detailed events available for this date</p>
                  </div>
                ) : (
                  <div className="relative pl-8 border-l-2 border-blue-200 max-h-[500px] overflow-y-auto pr-2">
                    {dateEvents.map((event) => (
                      <div key={event.id} className="mb-6 relative">
                        <div className="absolute -left-10 w-7 h-7 flex items-center justify-center rounded-full bg-white border-2 border-blue-300 shadow-sm">
                          <span>{getEventIcon(event.type)}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                          <p className="text-sm text-gray-500 mb-1">{formatTime(event.timestamp)}</p>
                          <p className="font-medium text-gray-800">{getEventDescription(event)}</p>
                          
                          {/* Additional event details */}
                          {event.type === 'sittingSession' && (
                            <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                              <p>Started: {formatTime(event.startTime)}</p>
                              <p>Ended: {formatTime(event.endTime)}</p>
                              <p>Position: {event.position}</p>
                              <p>Position changes: {event.positionChanges || 0}</p>
                            </div>
                          )}
                          
                          {event.type === 'positionChange' && (
                            <div className="mt-2 text-sm flex items-center gap-2 text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                              <span className="font-medium">{event.from}</span>
                              <span>➡️</span>
                              <span className="font-medium">{event.to}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-4 flex items-center justify-center h-64">
                <p className="text-lg text-gray-500">Select a date to view activity details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChairActivityLog;