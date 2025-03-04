import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { database } from '../../config/firebase';

const ChairMonitor = () => {
  const { chairId } = useParams();
  const navigate = useNavigate();
  const [chairData, setChairData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHydrationAlert, setShowHydrationAlert] = useState(false);
  
  // State for critical values
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [currentSessionMinutes, setCurrentSessionMinutes] = useState(0);
  const [positionChanges, setPositionChanges] = useState(0);
  
  // Refs for tracking
  const sittingStartTimeRef = useRef(0);
  const prevMinutesRef = useRef(0);
  const currentMinutesRef = useRef(0);
  const positionChangesRef = useRef(0);
  const lastPositionRef = useRef(null);
  const currentStateRef = useRef(null);
  const sittingTimerRef = useRef(null);
  const firebaseStateRef = useRef(null);
  const processingStateChangeRef = useRef(false);
  const timerIntervalRef = useRef(null);
 
  useEffect(() => {
    // Immediately clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  
    const chairStateRef = ref(database, `chairs/${chairId}/chairState`);
    
    const unsubscribeState = onValue(chairStateRef, (stateSnapshot) => {
      const chairState = stateSnapshot.val();
  
      console.log('Chair State:', chairState);
  
      // Comprehensive interval stopping
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
  
      // Reset timer logic
      if (chairState !== 'sitting') {
        // Accumulate previous time
        if (currentMinutesRef.current > 0) {
          prevMinutesRef.current += currentMinutesRef.current;
          setTotalMinutes(prevMinutesRef.current);
          
          const chairRef = ref(database, `chairs/${chairId}`);
          update(chairRef, {
            prev_timer: prevMinutesRef.current,
            current_timer: 0
          });
        }
  
        // Explicitly reset current timer
        currentMinutesRef.current = 0;
        setCurrentSessionMinutes(0);
  
        // Additional safeguard: ensure no interval is running
        console.log('Stopping timer due to non-sitting state');
      }
  
      // Only start timer for sitting state
      if (chairState === 'sitting') {
        timerIntervalRef.current = setInterval(() => {
          currentMinutesRef.current += (1/60);
          setCurrentSessionMinutes(currentMinutesRef.current);
  
          const chairRef = ref(database, `chairs/${chairId}`);
          update(chairRef, {
            current_timer: currentMinutesRef.current
          }).catch(err => {
            console.error("Error updating current minutes:", err);
          });
        }, 1000);
      }
    });
  
    return () => {
      unsubscribeState();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [chairId]);
  // Update current minutes in Firebase
  const updateCurrentMinutesInFirebase = (minutes) => {
    const chairRef = ref(database, `chairs/${chairId}`);
    update(chairRef, {
      current_timer: minutes
    }).catch(err => {
      console.error("Error updating current minutes:", err);
    });
  };

  // Set hydration reminder
  const setHydrationReminder = () => {
    if (sittingTimerRef.current) {
      clearTimeout(sittingTimerRef.current);
    }
    
    sittingTimerRef.current = setTimeout(() => {
      setShowHydrationAlert(true);
      
      // Update hydration status in Firebase
      const hydrationRef = ref(database, `chairs/${chairId}/hydration`);
      set(hydrationRef, 1);
      
      // Record hydration reminder in reports
      addToReports({
        type: 'hydrationReminder',
        sittingDuration: currentMinutesRef.current.toFixed(2)
      });
    }, 5 * 60 * 1000); // 5 minutes
  };

 
  // Update previous and current minutes in Firebase
  
  // Dismiss hydration alert
  const dismissHydrationAlert = () => {
    setShowHydrationAlert(false);
    
    // Update hydration status in Firebase
    const hydrationRef = ref(database, `chairs/${chairId}/hydration`);
    set(hydrationRef, 0);
    
    // Record hydration dismissal in reports
    addToReports({
      type: 'hydrationDismissed'
    });
    
    // Reset timer for next alert
    if (sittingTimerRef.current) {
      clearTimeout(sittingTimerRef.current);
    }
    
    // Set next reminder
    setHydrationReminder();
  };

  // Update position changes in Firebase
  const updatePositionChanges = (changes) => {
    const chairRef = ref(database, `chairs/${chairId}`);
    
    // Update Firebase with position changes
    update(chairRef, {
      positionChanges: changes
    }).catch(err => {
      console.error("Error updating position changes:", err);
    });
  };

  // Update chair state in Firebase to track transitions
  const updateChairState = async (newState) => {
    try {
      const chairStateRef = ref(database, `chairs/${chairId}/chairState`);
      await set(chairStateRef, newState);
      firebaseStateRef.current = newState;
      console.log(`Updated chair state in Firebase to: ${newState}`);
    } catch (err) {
      console.error("Error updating chair state:", err);
    }
  };

  // Add to reports with simplified date-based structure
  const addToReports = async (data) => {
    // Get current date formatted as YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0]; 
    
    try {
      // Reference to the reports location for this chair and date
      const reportsRef = ref(database, `chairs/${chairId}/reports/${today}/events`);
      
      // Push new report data with timestamp
      const newReportRef = push(reportsRef);
      
      await set(newReportRef, {
        timestamp: new Date().toISOString(),
        ...data
      });
      
      // For sittingSession events, update today's total minutes
      if (data.type === 'sittingSession' && data.duration) {
        // Update summary in Firebase
        const summaryRef = ref(database, `chairs/${chairId}/reports/${today}/summary`);
        update(summaryRef, {
          totalMinutes: prevMinutesRef.current
        });
      }
      
      console.log(`Added report: ${data.type}`, data);
    } catch (err) {
      console.error("Error adding report:", err);
    }
  };

  // Handle state changes
  const handleStateChange = async (newState, position) => {
    // Prevent concurrent state changes
    if (processingStateChangeRef.current) {
      console.log("Already processing a state change, skipping...");
      return;
    }
    
    processingStateChangeRef.current = true;
    
    console.log("Handling state change:", { 
      currentState: currentStateRef.current,
      newState, 
      position,
      firebaseState: firebaseStateRef.current
    });

    try {
      // Check if position changed without state change
      if (currentStateRef.current === newState && lastPositionRef.current !== position && newState === 'sitting') {
        // Increment position change counter
        positionChangesRef.current += 1;
        setPositionChanges(positionChangesRef.current);
        
        // Update position changes in Firebase
        updatePositionChanges(positionChangesRef.current);
        
        // Log position change
        addToReports({
          type: 'positionChange',
          oldPosition: lastPositionRef.current,
          newPosition: position,
          timestamp: new Date().toISOString()
        });
        
        // Update current position
        lastPositionRef.current = position;
        processingStateChangeRef.current = false;
        return;
      }
      
      // If state is the same as what's in Firebase, don't process again
      if (newState === firebaseStateRef.current && currentStateRef.current === newState) {
        lastPositionRef.current = position;
        processingStateChangeRef.current = false;
        return;
      }
      
      // Now handle actual state transitions
      
      // Step 1: End previous state if different
      if (currentStateRef.current && currentStateRef.current !== newState) {
        console.log(`Ending state: ${currentStateRef.current}`);
        
        // Handle specific end state actions
        if (currentStateRef.current === 'sitting') {
          // Person was sitting but is now leaving
          
          addToReports({
            type: 'personLeft',
            timestamp: new Date().toISOString()
          });
        } 
        else if (currentStateRef.current === 'objectPlaced') {
          addToReports({
            type: 'objectRemoved',
            timestamp: new Date().toISOString()
          });
        }
        else if (currentStateRef.current === 'absent') {
          addToReports({
            type: 'emptyRemoved',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Step 2: Start new state
      console.log(`Starting state: ${newState}`);
      
      if (newState === 'sitting') {
        // Start a new sitting session
        
        addToReports({
          type: 'personSitting',
          position: position,
          timestamp: new Date().toISOString()
        });
      } 
      else if (newState === 'objectPlaced') {
        addToReports({
          type: 'objectPlaced',
          timestamp: new Date().toISOString()
        });
      } 
      else if (newState === 'absent') {
        addToReports({
          type: 'empty',
          timestamp: new Date().toISOString()
        });
      }
      
      // Update current state locally
      currentStateRef.current = newState;
      lastPositionRef.current = position;
      
      // Update state in Firebase
      await updateChairState(newState);
      
    } catch (error) {
      console.error("Error in state transition:", error);
    } finally {
      processingStateChangeRef.current = false;
    }
  };

  // Determine chair state based on sensor data
  const determineChairState = (data) => {
    if (!data) return { state: 'unknown', position: 'Unknown' };
    
    const { leftarm, rightarm, leftleg, rightleg, weight } = data;
    const allSensorsActive = leftarm > 0 && rightarm > 0 && leftleg > 0 && rightleg > 0;
    const anySensorActive = leftarm > 0 || rightarm > 0 || leftleg > 0 || rightleg > 0;
    
    // Empty chair - no weight
    if (weight <= 0) {
      return { state: 'absent', position: 'Empty' };
    }
    
    // Object placed - weight but no sensors active
    if (weight > 0 && !anySensorActive) {
      return { state: 'objectPlaced', position: 'Object Placed' };
    }
    
    // Person sitting - weight and sensors active
    if (weight > 0 && anySensorActive) {
      // Determine position
      let position = 'Irregular';
      
      if (allSensorsActive) {
        position = 'Balanced';
      } else if (leftarm > 0 && leftleg > 0 && (rightarm <= 0 || rightleg <= 0)) {
        position = 'Leaning Left';
      } else if (rightarm > 0 && rightleg > 0 && (leftarm <= 0 || leftleg <= 0)) {
        position = 'Leaning Right';
      } else if ((leftarm <= 0 && rightarm <= 0) && (leftleg > 0 && rightleg > 0)) {
        position = 'Forward Slouch';
      } else if ((leftarm > 0 && rightarm > 0) && (leftleg <= 0 && rightleg <= 0)) {
        position = 'Slouching Back';
      }
      
      return { state: 'sitting', position };
    }
    
    return { state: 'unknown', position: 'Unknown' };
  };

  // Setup chair monitoring
  useEffect(() => {
    // Setup hydration reminder timer ref
    sittingTimerRef.current = null;
    
    // Check initial chair state from Firebase
    const checkInitialState = async () => {
      try {
        // Check chair state
        const chairStateRef = ref(database, `chairs/${chairId}/chairState`);
        const snapshot = await get(chairStateRef);
        
        if (snapshot.exists()) {
          const storedState = snapshot.val();
          firebaseStateRef.current = storedState;
          currentStateRef.current = storedState;
        } else {
          // Initialize if not exists
          await set(chairStateRef, 'absent');
          firebaseStateRef.current = 'absent';
          currentStateRef.current = 'absent';
        }
        
        // Load chair data (prev timer, current timer, position changes)
        const chairDataRef = ref(database, `chairs/${chairId}`);
        const dataSnapshot = await get(chairDataRef);
        
        if (dataSnapshot.exists()) {
          const chairData = dataSnapshot.val();
          
          // Load previous timer value
          if (chairData.prev_timer !== undefined) {
            prevMinutesRef.current = parseFloat(chairData.prev_timer);
            setTotalMinutes(prevMinutesRef.current);
          } else {
            // Initialize if not exists
            const chairRef = ref(database, `chairs/${chairId}`);
            update(chairRef, { prev_timer: 0 });
            prevMinutesRef.current = 0;
          }
          
          // Load current timer value
          if (chairData.current_timer !== undefined) {
            currentMinutesRef.current = parseFloat(chairData.current_timer);
            setCurrentSessionMinutes(currentMinutesRef.current);
          } else {
            // Initialize if not exists
            const chairRef = ref(database, `chairs/${chairId}`);
            update(chairRef, { current_timer: 0 });
            currentMinutesRef.current = 0;
          }
          
          // Load position changes
          if (chairData.positionChanges !== undefined) {
            positionChangesRef.current = parseInt(chairData.positionChanges);
            setPositionChanges(positionChangesRef.current);
          }
          
          // Check if there's an active sitting timer
          if (chairData.sittingTimer && chairData.sittingTimer.isActive && chairData.sittingTimer.startTime) {
            const startTime = new Date(chairData.sittingTimer.startTime);
            sittingStartTimeRef.current = startTime;
       
            
            // Start timer UI update and Firebase update
            timerIntervalRef.current = setInterval(() => {
              if (sittingStartTimeRef.current) {
                const elapsedTime = (new Date() - sittingStartTimeRef.current) / (1000 * 60);
                const currentMins = parseFloat(elapsedTime.toFixed(2));
                
                // Update local state
                // currentMinutesRef.current = currentMins;
                // setCurrentSessionMinutes(currentMins);
                
                // Update Firebase current timer every second
                // updateCurrentMinutesInFirebase(currentMins);
              }
            }, 1000);
            
            // Set hydration reminder
            setHydrationReminder();
          }
        } else {
          // Initialize chair data if it doesn't exist
          const chairRef = ref(database, `chairs/${chairId}`);
          update(chairRef, { 
            prev_timer: 0,
            current_timer: 0,
            positionChanges: 0
          });
          
          prevMinutesRef.current = 0;
          currentMinutesRef.current = 0;
          positionChangesRef.current = 0;
        }
      } catch (err) {
        console.error("Error loading chair data:", err);
      }
    };
    
    checkInitialState();
    
    // Monitor chair data
    const chairRef = ref(database, `chairs/${chairId}`);
    
    const unsubscribe = onValue(chairRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Skip processing if we're already handling a state change
        if (processingStateChangeRef.current) {
          console.log("Skipping sensor data update - already processing state change");
          return;
        }
        
        // Determine chair state from sensors
        const { state, position } = determineChairState(data);
        
        // Handle state changes
        handleStateChange(state, position);
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Process the data for display
        const processedData = {
          ...data,
          chairState: state,
          sittingPosition: position,
          isOccupied: state === 'sitting' || state === 'objectPlaced',
          isPersonSitting: state === 'sitting',
          isObjectPlaced: state === 'objectPlaced',
          isEmpty: state === 'absent',
          
          // Time tracking
          prevTimer: prevMinutesRef.current, // Previous accumulated minutes
          currentTimer: currentMinutesRef.current, // Current session minutes
          totalMinutes: prevMinutesRef.current + currentMinutesRef.current, // Total (prev + current)
          
          positionChanges: positionChangesRef.current,
          
          showHydrationAlert: showHydrationAlert,
          today: today // Include today's date
        };

        setChairData(processedData);
      } else {
        setError('Chair not found');
      }
      setLoading(false);
    }, (error) => {
      setError('Failed to load chair data: ' + error.message);
      setLoading(false);
    });
    
    // Load today's report data
    loadReportData();
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      
      // Stop sitting timer if active
      
      
      // Clear timers
      if (sittingTimerRef.current) {
        clearTimeout(sittingTimerRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Reset hydration status
      const hydrationRef = ref(database, `chairs/${chairId}/hydration`);
      set(hydrationRef, 0);
    };
  }, [chairId]);
  
  // Load report data
   const loadReportData = async () => {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Ensure today's reports summary exists
      const reportsRef = ref(database, `chairs/${chairId}/reports/${today}/summary`);
      const reportsSnapshot = await get(reportsRef);
      
      if (!reportsSnapshot.exists()) {
        // Initialize summary if it doesn't exist
        set(reportsRef, {
          totalMinutes: prevMinutesRef.current,
          date: today
        });
      }
    } catch (err) {
      console.error("Error loading report data:", err);
    }
  };

  // Navigate to activity log
  const navigateToActivityLog = () => {
    navigate(`/chair-activity/${chairId}`);
  };
  // Render the component
  if (loading) {
    return<div className="fixed inset-0 bg-white flex items-center justify-center z-50">
    <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
  </div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!chairData) {
    return <div className="no-data">No chair data available</div>;
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-100">
      <div className="w-full max-w-4xl px-8 py-10 mx-4 bg-white rounded-xl shadow-lg">
        {/* Logo and Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Chair #{chairId} Monitor</h1>
              <p className="text-gray-600">Smart Chair Monitoring System</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              onClick={navigateToActivityLog}
            >
              View Activity Log
            </button>
            <button
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => navigate('/chair-selection')}
            >
              Back to Chairs
            </button>
          </div>
        </div>
        
        {/* Login Time Info */}
        {chairData?.loginTime && (
          <div className="mb-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Session started:</span> {new Date(chairData.loginTime).toLocaleString()}
            </p>
          </div>
        )}
        
        {/* Hydration Alert */}
        {showHydrationAlert && chairData?.isPersonSitting && (
          <div className="mb-6 p-4 bg-blue-100 border-l-4 border-blue-500 rounded-lg flex items-start justify-between">
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-blue-700">
                <span className="font-bold">Hydration Reminder:</span> You've been sitting for 0.1+ minutes. Consider getting up for a water break.
              </p>
            </div>
            <button 
              onClick={dismissHydrationAlert}
              className="ml-4 text-blue-500 hover:text-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading chair data...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="py-8">
            <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-lg">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
            <div className="text-center">
              <button
                className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => navigate('/chair-selection')}
              >
                Return to Chair Selection
              </button>
            </div>
          </div>
        ) : (
          /* Chair Data Display */
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Occupancy and Weight Card */}
              <div className="p-6 bg-white rounded-lg shadow border border-gray-100">
                <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Chair Status
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-600">Occupancy</p>
                    <div className="mt-4 flex flex-col items-center">
                      {chairData.isOccupied ? (
                        chairData.isPersonSitting ? (
                          /* Person sitting icon */
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="7" r="4" />
                            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                            <rect x="8" y="15" width="8" height="6" rx="1" />
                          </svg>
                        ) : (
                          /* Box/object icon */
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8l9-4 9 4z" />
                            <path d="M12 4v16M3 8h18" />
                          </svg>
                        )
                      ) : (
                        /* Empty chair icon */
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="11" width="12" height="10" rx="2" />
                          <path d="M5 19h14M10 5v6M14 5v6" />
                        </svg>
                      )}
                      <p className="mt-2 text-lg font-medium text-gray-800">
                        {chairData.isOccupied ? 
                          chairData.isPersonSitting ? 'Person Sitting' : 'Object Placed' 
                          : 'Empty'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-600">Weight</p>
                    <div className="mt-4 flex flex-col items-center">
                      <div className="relative w-24 h-24 flex items-center justify-center rounded-full bg-blue-100 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500 absolute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        <p className="text-xl font-bold text-blue-800 z-10">
                          {chairData.weight || '0'}
                        </p>
                      </div>
                      <p className="text-base text-gray-600">kg</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sitting Position Card */}
              <div className="p-6 bg-white rounded-lg shadow border border-gray-100">
                <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Sitting Position
                </h2>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  {chairData.isPersonSitting ? (
                    <div className="flex flex-col items-center">
                      {/* Visual representation of sitting position */}
                      <div className="w-40 h-40 relative bg-blue-50 rounded-lg mb-4 flex items-center justify-center">
                        {/* Chair outline */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32 text-blue-200" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="25" y="60" width="50" height="30" rx="2" />
                          <path d="M30 60 V40 H70 V60" />
                          <path d="M30 50 H70" />
                        </svg>
                        
                        {/* Person representation based on sensor data */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-28 h-28 absolute" viewBox="0 0 100 100">
                          {/* Head */}
                          <circle cx="50" cy="35" r="10" fill={chairData.isPersonSitting ? "#3B82F6" : "transparent"} />
                          
                          {/* Torso */}
                          <path d={`M50 45 L50 ${chairData.sittingPosition === 'Forward Slouch' ? '75' : '65'}`} stroke="#3B82F6" strokeWidth="4" />
                          
                          {/* Left arm */}
                          <path d={`M50 50 L${chairData.leftarm ? '30' : '40'} ${chairData.leftarm ? '45' : '55'}`} stroke={chairData.leftarm ? "#3B82F6" : "#93C5FD"} strokeWidth="4" />
                          
                          {/* Right arm */}
                          <path d={`M50 50 L${chairData.rightarm ? '70' : '60'} ${chairData.rightarm ? '45' : '55'}`} stroke={chairData.rightarm ? "#3B82F6" : "#93C5FD"} strokeWidth="4" />
                          
                          {/* Left leg */}
                          <path d={`M50 65 L${chairData.leftleg ? '40' : '45'} 85`} stroke={chairData.leftleg ? "#3B82F6" : "#93C5FD"} strokeWidth="4" />
                          
                          {/* Right leg */}
                          <path d={`M50 65 L${chairData.rightleg ? '60' : '55'} 85`} stroke={chairData.rightleg ? "#3B82F6" : "#93C5FD"} strokeWidth="4" />
                        </svg>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-lg font-medium text-gray-800 mb-2">
                          {chairData.sittingPosition || 'Normal'}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 justify-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${chairData.leftarm ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                            Left Arm {chairData.leftarm ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${chairData.rightarm ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                            Right Arm {chairData.rightarm ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${chairData.leftleg ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                            Left Leg {chairData.leftleg ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${chairData.rightleg ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                            Right Leg {chairData.rightleg ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      
                      {chairData.positionWarning && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-sm text-yellow-700">{chairData.positionWarning}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                      <p className="text-gray-500">No sitting position data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Usage Statistics Card */}
            <div className="p-6 bg-white rounded-lg shadow border border-gray-100">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Usage Statistics
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-600">Current session</p>
                  <div className="mt-2 flex items-end">
                    <p className="text-2xl font-semibold text-blue-600">
                      {currentSessionMinutes.toFixed(2)}
                    </p>
                    <span className="text-sm font-normal text-gray-600 ml-1 mb-1">mins</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((chairData.hours || 0) * 10, 100)}%` }}></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-600">Today's sitting time</p>
                  <div className="mt-2 flex items-end">
                    <p className="text-2xl font-semibold text-blue-600">
                      {totalMinutes.toFixed(2)}
                    </p>
                    <span className="text-sm font-normal text-gray-600 ml-1 mb-1">mins</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((chairData.avgDailyHours || 3.5) * 10, 100)}%` }}></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm text-gray-600">Position Changes</p>
                  <div className="mt-2 flex items-end">
                    <p className="text-2xl font-semibold text-blue-600">
                      {chairData.positionChanges || 0}
                    </p>
                    <span className="text-sm font-normal text-gray-600 ml-1 mb-1">today</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((chairData.positionChanges || 0) * 5, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recommendations */}
<div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
  <h2 className="mb-4 text-lg font-semibold text-blue-800 flex items-center">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    Health Recommendations
  </h2>
  
  <div className="space-y-4">

{chairData.isPersonSitting && chairData.minutes > 120 && (
  <div className="flex items-start">
    <div className="flex-shrink-0 bg-blue-200 rounded-full p-2 mr-3">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div>
      <h3 className="text-md font-medium text-blue-800">Take a Break</h3>
      <p className="text-sm text-blue-700">You've been sitting for {chairData.minutes} minutes today. Consider taking a 5-minute break to stretch and move around.</p>
    </div>
  </div>
)}
    
    {chairData.isPersonSitting && chairData.positionChanges < 5 && chairData.hours > 1 && (
      <div className="flex items-start">
        <div className="flex-shrink-0 bg-blue-200 rounded-full p-2 mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <h3 className="text-md font-medium text-blue-800">Change Position</h3>
          <p className="text-sm text-blue-700">Try to shift positions more frequently. Aim for at least 8-10 position changes per hour to improve circulation.</p>
        </div>
      </div>
    )}
    
    {chairData.positionWarning && (
      <div className="flex items-start">
        <div className="flex-shrink-0 bg-blue-200 rounded-full p-2 mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-md font-medium text-blue-800">Improve Posture</h3>
          <p className="text-sm text-blue-700">{chairData.positionWarning} A balanced posture can reduce strain on your back and neck.</p>
        </div>
      </div>
    )}
    
    {chairData.avgDailyHours > 5 && (
      <div className="flex items-start">
        <div className="flex-shrink-0 bg-blue-200 rounded-full p-2 mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-md font-medium text-blue-800">Reduce Sitting Time</h3>
          <p className="text-sm text-blue-700">Your average daily sitting time of {chairData.avgDailyHours} hours is high. Try to incorporate more standing or walking activities throughout your day.</p>
        </div>
      </div>
    )}
    
    {!chairData.isPersonSitting && chairData.hours > 0 && (
      <div className="flex items-start">
        <div className="flex-shrink-0 bg-blue-200 rounded-full p-2 mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-md font-medium text-blue-800">Good Job!</h3>
          <p className="text-sm text-blue-700">You're currently taking a break from sitting. Keep up the good work by staying active!</p>
        </div>
      </div>
    )}
    
    {chairData.hours === 0 && (
      <div className="flex items-start">
        <div className="flex-shrink-0 bg-blue-200 rounded-full p-2 mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h3 className="text-md font-medium text-blue-800">Ready to Start</h3>
          <p className="text-sm text-blue-700">No sitting data recorded today. Remember to take breaks every 30 minutes when you start using the chair.</p>
        </div>
      </div>
    )}
  </div>
</div>
</div>
      )}
    </div>
  </div>
); 
}; 

export default ChairMonitor;
