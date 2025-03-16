import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { database } from '../../config/firebase';
import * as tf from '@tensorflow/tfjs';

import PressureDistribution from '../UI/PressureDistribution';

const ChairMonitor = () => {
  const { chairId } = useParams();
  const navigate = useNavigate();
  const [chairData, setChairData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHydrationAlert, setShowHydrationAlert] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // State for critical values
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [currentSessionMinutes, setCurrentSessionMinutes] = useState(0);
  const [currentSessionSeconds, setCurrentSessionSeconds] = useState(0);
  const [positionChanges, setPositionChanges] = useState(0);
  
  // State for AI tasks
  const [aiTasks, setAiTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [taskInProgress, setTaskInProgress] = useState(false);
  const [taskTimeRemaining, setTaskTimeRemaining] = useState(0);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [aiModeEnabled, setAiModeEnabled] = useState(false);
  const [lastPositionChangeTime, setLastPositionChangeTime] = useState(Date.now());
  const [taskCooldownActive, setTaskCooldownActive] = useState(false);
  const [userBehaviorData, setUserBehaviorData] = useState([]);
  const [lstmModelReady, setLstmModelReady] = useState(false);
  
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
  const taskTimerRef = useRef(null);
  
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  };
  
  
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
    
      // First, always clear the existing interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        console.log('Timer interval cleared');
      }
    
      // Then handle the transition logic
      if (chairState !== 'sitting') {
        // Accumulate previous time
        if (currentMinutesRef.current > 0) {
          // Calculate total seconds from the UI timer
          const totalSeconds = (currentSessionMinutes * 60) + currentSessionSeconds;
          const minutesToAdd = totalSeconds / 60;
          
          // Add to previous minutes
          prevMinutesRef.current += minutesToAdd;
          setTotalMinutes(prevMinutesRef.current);
          
          // Get today's date for consistent storage
          const today = new Date().toISOString().split('T')[0]; 
          
          // Update both locations for consistency
          const chairRef = ref(database, `chairs/${chairId}/reports/${today}/`);
          update(chairRef, {
            prev_timer: prevMinutesRef.current
          });
          
          // Also update summary data
          const summaryRef = ref(database, `chairs/${chairId}/reports/${today}/summary`);
          update(summaryRef, {
            totalMinutes: prevMinutesRef.current,
            date: today
          });
          
          // Keep the main chair reference updated too
          const mainChairRef = ref(database, `chairs/${chairId}`);
          update(mainChairRef, {
            current_timer: 0
          });
        }
    
        // Explicitly reset current timer
        currentMinutesRef.current = 0;
        setCurrentSessionMinutes(0);
        setCurrentSessionSeconds(0);
        console.log('Stopped timer and accumulated time');
      }
    
      // Only start a new timer if the state is 'sitting'
      if (chairState === 'sitting') {
        console.log('Starting new timer interval');
        timerIntervalRef.current = setInterval(() => {
          // Increment seconds counter
          setCurrentSessionSeconds(prev => {
            const newSeconds = prev + 1;
            // When we reach 60 seconds, update the minutes
            if (newSeconds >= 60) {
              setCurrentSessionMinutes(prev => prev + 1);
              return 0;
            }
            return newSeconds;
          });
          
          // Only update Firebase every 15 seconds to reduce writes
          if (currentSessionSeconds % 15 === 0) {
            const totalSeconds = (currentSessionMinutes * 60) + currentSessionSeconds;
            const minutesValue = totalSeconds / 60;
            
            // Update the ref for calculations that need it
            currentMinutesRef.current = minutesValue;
            
            const chairRef = ref(database, `chairs/${chairId}`);
            update(chairRef, {
              current_timer: minutesValue
            }).catch(err => {
              console.error("Error updating current minutes:", err);
            });
          }
        }, 1000); // Run every 1 second
      }
    });
  
    return () => {
      unsubscribeState();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [chairId, currentSessionMinutes, currentSessionSeconds]);
  
  // Check sitting duration and trigger AI mode
  useEffect(() => {
    // Check if we should suggest tasks based on position duration
    const currentTime = Date.now();
    const timeInSamePosition = (currentTime - lastPositionChangeTime) / 1000; // in seconds
    
    if (
      chairData && 
      chairData.isPersonSitting && 
      timeInSamePosition >= 10 && // Trigger after 10 seconds in the same position (for demo)
      !taskInProgress && 
      !showTaskModal &&
      aiModeEnabled &&
      !taskCooldownActive
    ) {
      console.log('Suggesting tasks - user has been in the same position for', timeInSamePosition, 'seconds');
      
      // Generate tasks asynchronously
      generateAiTasks().then(tasks => {
        if (tasks && tasks.length > 0) {
          setAiTasks(tasks);
          setCurrentTaskIndex(0);
          setShowTaskModal(true);
        }
      }).catch(err => {
        console.error("Error generating AI tasks:", err);
      });
    }
  }, [currentSessionSeconds, chairData?.isPersonSitting, taskInProgress, showTaskModal, aiModeEnabled, lastPositionChangeTime, taskCooldownActive]);

  // Collect behavior data periodically for LSTM model
  useEffect(() => {
    if (!chairData || !chairData.isPersonSitting || !lstmModelReady) return;
    
    // Collect user behavior data every minute when sitting
    const dataCollectionInterval = setInterval(() => {
      const newDataPoint = collectUserBehaviorData(
        chairData, 
        currentSessionMinutes, 
        totalMinutes
      );
      
      if (newDataPoint) {
        setUserBehaviorData(prevData => {
          // Keep last 20 data points for the LSTM model
          const updatedData = [...prevData, newDataPoint].slice(-20);
          console.log("Updated behavior data for LSTM:", updatedData.length, "points");
          return updatedData;
        });
      }
    }, 60 * 1000); // Collect data every minute
    
    return () => {
      clearInterval(dataCollectionInterval);
    };
  }, [chairData, currentSessionMinutes, totalMinutes, lstmModelReady]);
  
  // Periodically train the model with accumulated user data
  useEffect(() => {
    // Skip if not enough data or not ready
    if (!lstmModelReady || userBehaviorData.length < 10) return;
    
    // Train model every 10 minutes of usage
    const trainingInterval = setInterval(async () => {
      if (userBehaviorData.length >= 10) {
        console.log("Scheduling LSTM model training with user data");
        await trainModelWithUserData(userBehaviorData);
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    return () => {
      clearInterval(trainingInterval);
    };
  }, [lstmModelReady, userBehaviorData.length]);

  // Set hydration reminder
  const setHydrationReminder = () => {
    console.log("Setting hydration reminder");
    if (sittingTimerRef.current) {
      clearTimeout(sittingTimerRef.current);
    }
    
    sittingTimerRef.current = setTimeout(() => {
      console.log("Hydration timeout triggered!");
      setShowHydrationAlert(true);
      
      // Update hydration status in Firebase
      const hydrationRef = ref(database, `chairs/${chairId}/hydration`);
      set(hydrationRef, 1);
      
      // Record hydration reminder in reports
      addToReports({
        type: 'hydrationReminder',
        sittingDuration: currentMinutesRef.current.toFixed(2)
      });
    }, 0.1 * 60 * 1000); // Set to 5 minutes in production (0.1 for testing)
  };
 
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
    const today = new Date().toISOString().split('T')[0]; 
    const chairRef = ref(database, `chairs/${chairId}/reports/${today}/`);        
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
        
        // Update current position and reset timer for same position detection
        lastPositionRef.current = position;
        setLastPositionChangeTime(Date.now()); // Reset position timer
        console.log('Position changed, resetting position timer');
        
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
        setHydrationReminder();
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
    if (!data || !data.sensor_data) return { state: 'unknown', position: 'Unknown' };
    
    // Get sensor data from the new path
    const sensorData = data.sensor_data;
    const leftarm = sensorData.left_armrest;
    const rightarm = sensorData.right_armrest;
    const leftleg = sensorData.left_legrest;
    const rightleg = sensorData.right_legrest;
    const weight = sensorData.weight_kg;
  
    
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
      // Determine position from sensor data or use the existing position
      let position = data.sensor_data.current;
      
      // If position is not provided directly, try to determine from sensor patterns
      if (!position || position === 'Normal') {
        // Example of determining positions based on sensor patterns
        const leftSideActive = leftarm > 0 && leftleg > 0;
        const rightSideActive = rightarm > 0 && rightleg > 0;
        
        if (leftSideActive && !rightSideActive) {
          position = 'Leaning Left';
        } else if (rightSideActive && !leftSideActive) {
          position = 'Leaning Right';
        } else if (!leftleg && !rightleg && leftarm && rightarm) {
          position = 'Leaning Forward';
        } else if (leftleg && rightleg && !leftarm && !rightarm) {
          position = 'Bending Backward';
        } else if (leftleg < rightleg && leftarm < rightarm) {
          position = 'Forward Slouch';
        }
      }
      
      return { state: 'sitting', position };
    }
    
    return { state: 'unknown', position: 'Unknown' };
  };

  // Setup chair monitoring
  useEffect(() => {
    // Setup hydration reminder timer ref
    sittingTimerRef.current = null;
    
    // Initialize the position change timestamp
    setLastPositionChangeTime(Date.now());
    
    // Initialize TensorFlow LSTM model
    initializeTensorflowModel(setLstmModelReady);
    
    // Get today's date for consistent usage
    const today = new Date().toISOString().split('T')[0];
    
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
        
        // Load today's report data first to get persistent timer values
        const todayReportRef = ref(database, `chairs/${chairId}/reports/${today}`);
        const reportSnapshot = await get(todayReportRef);
        
        let prevTimerValue = 0;
        
        if (reportSnapshot.exists()) {
          const reportData = reportSnapshot.val();
          if (reportData.prev_timer !== undefined) {
            prevTimerValue = parseFloat(reportData.prev_timer);
            console.log("Loaded today's prev_timer from reports:", prevTimerValue);
          }
        }
        
        // Load chair data (current timer, position changes)
        const chairDataRef = ref(database, `chairs/${chairId}`);
        const dataSnapshot = await get(chairDataRef);
        
        if (dataSnapshot.exists()) {
          const chairData = dataSnapshot.val();
          
          // Use the prev_timer we loaded from today's report
          prevMinutesRef.current = prevTimerValue;
          setTotalMinutes(prevTimerValue);
          
          // Load current timer value
          if (chairData.current_timer !== undefined) {
            // Don't set the UI from this value anymore - we'll use our own counter
            currentMinutesRef.current = parseFloat(chairData.current_timer);
            // Reset UI states
            setCurrentSessionMinutes(0);
            setCurrentSessionSeconds(0);
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
            
            // Set hydration reminder
            setHydrationReminder();
          }
        } else {
          // Initialize chair data if it doesn't exist
          const chairRef = ref(database, `chairs/${chairId}`);
          update(chairRef, { 
            current_timer: 0,
            positionChanges: 0
          });
          
          currentMinutesRef.current = 0;
          positionChangesRef.current = 0;
        }
        
        // Ensure today's report node exists with the current prev_timer value
        const todaySummaryRef = ref(database, `chairs/${chairId}/reports/${today}/summary`);
        update(todaySummaryRef, {
          totalMinutes: prevTimerValue,
          date: today
        });
        
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
      
      // Clear timers
      if (sittingTimerRef.current) {
        clearTimeout(sittingTimerRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (taskTimerRef.current) {
        clearInterval(taskTimerRef.current);
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

  // AI Task Functions

  // Collect user behavior data for LSTM prediction
  const collectUserBehaviorData = (chairData, sittingDuration, totalSittingToday) => {
    if (!chairData || !chairData.isPersonSitting) return;
    
    // Create a data point from current state
    const dataPoint = {
      timestamp: new Date().toISOString(),
      weight: chairData.sensor_data.weight_kg || 0,
      sittingDuration: sittingDuration || 0,
      totalSittingToday: totalSittingToday || 0,
      position: chairData.sittingPosition || 'Normal',
      leftArmActive: chairData.sensor_data.left_armrest > 0,
      rightArmActive: chairData.sensor_data.right_armrest > 0,
      leftLegActive: chairData.sensor_data.left_legrest > 0,
      rightLegActive: chairData.sensor_data.right_legrest > 0,
      positionChanges: chairData.positionChanges || 0
    };
    
    return dataPoint;
  };

  // TensorFlow.js LSTM Implementation
  
  // Global model reference to avoid recreating it on every render
  let lstmModel = null;
  let modelLoaded = false;
  let modelTraining = false;
  
  // Initialize TensorFlow and create LSTM model
  const initializeTensorflowModel = async (callback) => {
    console.log("Initializing TensorFlow.js LSTM model...");
    
    if (modelLoaded) {
      console.log("LSTM model already loaded");
      callback(true);
      return;
    }
    
    try {
      // Wait for TensorFlow to be ready
      await tf.ready();
      console.log("TensorFlow.js ready");
      
      // Try to load existing model from IndexedDB if available
      try {
        lstmModel = await tf.loadLayersModel('indexeddb://chair-lstm-model');
        console.log("Loaded existing LSTM model from storage");
        modelLoaded = true;
        callback(true);
      } catch (loadError) {
        console.log("No saved model found, creating new LSTM model");
        
        // Create the model architecture
        lstmModel = tf.sequential();
        
        // Input layer for 7 features (weight, current position, sitting duration, 
        // arm/leg sensor states, position changes)
        lstmModel.add(tf.layers.lstm({
          units: 20,
          returnSequences: true,
          inputShape: [5, 7], // [timeSteps, features]
        }));
        
        // Second LSTM layer
        lstmModel.add(tf.layers.lstm({
          units: 10,
          returnSequences: false
        }));
        
        // Dense layer for classification (5 task types as output)
        lstmModel.add(tf.layers.dense({
          units: 10,
          activation: 'relu'
        }));
        
        lstmModel.add(tf.layers.dense({
          units: 5,  // 5 task types
          activation: 'softmax'
        }));
        
        // Compile the model
        lstmModel.compile({
          optimizer: tf.train.adam(0.01),
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy']
        });
        
        console.log("New LSTM model created");
        modelLoaded = true;
        
        // Train with initial default data
        await trainWithDefaultData();
        
        callback(true);
      }
    } catch (err) {
      console.error("Error initializing TensorFlow.js LSTM model:", err);
      callback(false);
    }
  };
  
  // Prepare user behavior data for LSTM
  const prepareTrainingData = (behaviorData) => {
    if (!behaviorData || behaviorData.length < 5) {
      console.log("Not enough data for training");
      return null;
    }
    
    try {
      const trainingData = [];
      const labels = [];
      
      // Use sequences of 5 consecutive data points
      for (let i = 0; i < behaviorData.length - 5; i++) {
        const sequence = behaviorData.slice(i, i + 5);
        
        // Extract features from each data point in the sequence
        const sequenceFeatures = sequence.map(data => [
          // Normalize weight between 0 and 1 (assuming max weight of 150kg)
          data.weight / 150,
          
          // One-hot encode position (using simplified version for demo)
          data.position.includes('Forward') ? 1 : 0,
          data.position.includes('Left') ? 1 : 0,
          data.position.includes('Right') ? 1 : 0,
          data.position.includes('Backward') ? 1 : 0,
          
          // Normalize sitting duration
          Math.min(data.sittingDuration / 60, 1), // Cap at 1 hour
          
          // Sensor states
          data.leftArmActive ? 1 : 0,
          data.rightArmActive ? 1 : 0,
          data.leftLegActive ? 1 : 0,
          data.rightLegActive ? 1 : 0,
          
          // Normalize position changes (assuming max of 20 per session)
          Math.min(data.positionChanges / 20, 1)
        ]);
        
        trainingData.push(sequenceFeatures);
        
        // Create label based on the most appropriate task type
        const nextPosition = behaviorData[i + 5]?.position || '';
        let taskType;
        
        if (nextPosition.includes('Forward') || nextPosition.includes('Slouch')) {
          taskType = [1, 0, 0, 0, 0]; // Posture Reset task
        } else if (nextPosition.includes('Left') || nextPosition.includes('Right')) {
          taskType = [0, 1, 0, 0, 0]; // Side Stretch task
        } else if (nextPosition.includes('Backward')) {
          taskType = [0, 0, 1, 0, 0]; // Forward Fold task
        } else if (sequenceFeatures[4][5] > 0.5) { // Long sitting duration
          taskType = [0, 0, 0, 1, 0]; // Walk Around task
        } else {
          taskType = [0, 0, 0, 0, 1]; // General Stretch task
        }
        
        labels.push(taskType);
      }
      
      if (trainingData.length === 0) {
        console.log("No valid training sequences generated");
        return null;
      }
      
      // Convert to tensors
      const xs = tf.tensor3d(trainingData);
      const ys = tf.tensor2d(labels);
      
      return { xs, ys };
    } catch (err) {
      console.error("Error preparing training data:", err);
      return null;
    }
  };
  
  // Generate some default training data for initial model training
  const generateDefaultTrainingData = () => {
    const defaultData = [];
    
    // Generate 50 data points with various patterns
    for (let i = 0; i < 50; i++) {
      const baseWeight = 70 + Math.random() * 30;
      
      // Create some common position patterns
      let position;
      if (i % 10 < 3) {
        position = 'Forward Slouch';
      } else if (i % 10 < 5) {
        position = 'Leaning Left';
      } else if (i % 10 < 7) {
        position = 'Leaning Right';
      } else if (i % 10 < 9) {
        position = 'Bending Backward';
      } else {
        position = 'Normal';
      }
      
      // Create a data point
      defaultData.push({
        timestamp: new Date(Date.now() - (50 - i) * 60000).toISOString(),
        weight: baseWeight + (Math.random() * 5 - 2.5),
        sittingDuration: Math.min(60, Math.max(5, i * 2 + Math.random() * 10)),
        totalSittingToday: Math.min(480, Math.max(60, i * 10 + Math.random() * 30)),
        position: position,
        leftArmActive: Math.random() > 0.3,
        rightArmActive: Math.random() > 0.3,
        leftLegActive: Math.random() > 0.3,
        rightLegActive: Math.random() > 0.3,
        positionChanges: Math.floor(i / 5) + (Math.random() > 0.7 ? 1 : 0)
      });
    }
    
    return defaultData;
  };
  
  // Train LSTM model with default data
  const trainWithDefaultData = async () => {
    // Generate default training data
    const defaultData = generateDefaultTrainingData();
    
    // Prepare the data
    const trainingData = prepareTrainingData(defaultData);
    if (!trainingData) {
      console.log("Could not prepare default training data");
      return false;
    }
    
    try {
      // Train the model
      const { xs, ys } = trainingData;
      
      await lstmModel.fit(xs, ys, {
        epochs: 20,
        batchSize: 8,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Default training - Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
          }
        }
      });
      
      // Save the trained model
      await lstmModel.save('indexeddb://chair-lstm-model');
      console.log("Default training completed and model saved");
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
      return true;
    } catch (err) {
      console.error("Error training with default data:", err);
      return false;
    }
  };
  
  // Train the model with user data
  const trainModelWithUserData = async (behaviorData) => {
    if (!lstmModel || !behaviorData || behaviorData.length < 10 || modelTraining) {
      console.log("Cannot train model now: model not ready, insufficient data, or already training");
      return false;
    }
    
    modelTraining = true;
    console.log("Training LSTM model with user data...");
    
    try {
      // Prepare the data
      const trainingData = prepareTrainingData(behaviorData);
      if (!trainingData) {
        console.log("Could not prepare training data");
        modelTraining = false;
        return false;
      }
      
      const { xs, ys } = trainingData;
      
      // Train the model
      await lstmModel.fit(xs, ys, {
        epochs: 10,
        batchSize: 4,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`User data training - Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
          }
        }
      });
      
      // Save the updated model
      await lstmModel.save('indexeddb://chair-lstm-model');
      console.log("User training completed and model saved");
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
      modelTraining = false;
      return true;
    } catch (err) {
      console.error("Error training model with user data:", err);
      modelTraining = false;
      return false;
    }
  };
  
  // Generate predictions using the LSTM model
  const predictWithLSTM = async (recentBehavior, currentState) => {
    if (!lstmModel || recentBehavior.length < 5) {
      console.log("Cannot make predictions: model not ready or insufficient recent data");
      return null;
    }
    
    try {
      // Take last 5 data points for prediction
      const sequence = recentBehavior.slice(-5);
      
      // Prepare sequence features (same as in training)
      const sequenceFeatures = sequence.map(data => [
        data.weight / 150,
        data.position.includes('Forward') ? 1 : 0,
        data.position.includes('Left') ? 1 : 0,
        data.position.includes('Right') ? 1 : 0,
        data.position.includes('Backward') ? 1 : 0,
        Math.min(data.sittingDuration / 60, 1),
        data.leftArmActive ? 1 : 0,
        data.rightArmActive ? 1 : 0,
        data.leftLegActive ? 1 : 0,
        data.rightLegActive ? 1 : 0,
        Math.min(data.positionChanges / 20, 1)
      ]);
      
      // Create prediction tensor
      const inputTensor = tf.tensor3d([sequenceFeatures]);
      
      // Make prediction
      const prediction = lstmModel.predict(inputTensor);
      const predictionArray = await prediction.array();
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      // Convert prediction to task recommendations
      const taskDistribution = predictionArray[0];
      console.log("LSTM prediction distribution:", taskDistribution);
      
      // Map prediction to task types based on highest probability
      const taskTypes = [
        'postureReset',
        'sideStretch',
        'forwardFold',
        'walkAround',
        'generalStretch'
      ];
      
      // Find top 2 task types
      const sortedIndices = taskDistribution
        .map((prob, index) => ({ prob, index }))
        .sort((a, b) => b.prob - a.prob)
        .map(item => item.index);
      
      const recommendedTasks = [];
      const weight = currentState.weight;
      const position = currentState.position;
      
      // Generate tasks based on predicted types
      for (let i = 0; i < 2; i++) {
        const taskType = taskTypes[sortedIndices[i]];
        let task;
        
        switch (taskType) {
          case 'postureReset':
            task = {
              id: recommendedTasks.length + 1,
              title: 'AI Posture Reset',
              description: `Based on your patterns, your posture needs adjustment. Roll your shoulders back and sit straight.`,
              duration: 0.1, // 1 minute
              completed: false,
              priority: 'high',
              personalizedReason: 'LSTM analysis detected a pattern of posture issues'
            };
            break;
            
          case 'sideStretch':
            // Determine which side based on current position
            const direction = position.includes('Left') ? 'right' : 'left';
            task = {
              id: recommendedTasks.length + 1,
              title: `AI ${direction.charAt(0).toUpperCase() + direction.slice(1)} Side Stretch`,
              description: `LSTM analysis suggests a ${direction} side stretch would benefit you.`,
              duration: 0.1,
              completed: false,
              priority: 'medium',
              personalizedReason: `LSTM detected you tend to lean to the ${position.includes('Left') ? 'left' : 'right'}`
            };
            break;
            
          case 'forwardFold':
            task = {
              id: recommendedTasks.length + 1,
              title: 'AI Forward Fold',
              description: 'Based on your sitting patterns, a gentle forward fold would help relieve tension.',
              duration: 0.1,
              completed: false,
              priority: 'medium',
              personalizedReason: 'LSTM analysis detected back tension patterns'
            };
            break;
            
          case 'walkAround':
            // Adjust duration based on weight
            const walkDuration = weight > 85 ? 1.0 : 0.5;
            task = {
              id: recommendedTasks.length + 1,
              title: 'AI Walking Break',
              description: 'LSTM analysis shows you benefit most from walking breaks.',
              duration: walkDuration,
              completed: false,
              priority: 'high',
              personalizedReason: 'Based on your activity patterns and sitting duration'
            };
            break;
            
          case 'generalStretch':
          default:
            task = {
              id: recommendedTasks.length + 1,
              title: 'AI Full Body Stretch',
              description: 'LSTM recommends a personalized full-body stretch sequence.',
              duration: 0.1,
              completed: false,
              priority: 'medium',
              personalizedReason: 'Based on comprehensive analysis of your movement patterns'
            };
            break;
        }
        
        recommendedTasks.push(task);
      }
      
      // Always add standing up as the first task
      recommendedTasks.unshift({
        id: 1,
        title: 'Stand Up',
        description: 'Stand up completely from your chair',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high',
        personalizedReason: 'Essential first step for all exercises'
      });
      
      // Always add hydration
      recommendedTasks.push({
        id: recommendedTasks.length + 1,
        title: 'Hydration Break',
        description: 'Drink some water to stay hydrated',
        duration: 0.1,
        completed: false,
        priority: 'medium',
        personalizedReason: 'Recommended by LSTM analysis for optimal health'
      });
      
      return recommendedTasks;
    } catch (err) {
      console.error("Error making LSTM predictions:", err);
      return null;
    }
  };

  // Generate personalized tasks based on sensor data and LSTM prediction model
  const generateAiTasks = async () => {
    if (!chairData || !chairData.isPersonSitting) return [];
    
    // Check if we have enough data for LSTM predictions
    if (lstmModelReady && userBehaviorData.length >= 5) {
      try {
        // Use TensorFlow LSTM model to predict personalized tasks
        console.log("Using TensorFlow LSTM model for personalized task recommendations");
        
        const currentState = {
          weight: chairData.sensor_data.weight_kg || 0,
          position: chairData.sittingPosition || 'Normal',
          sittingDuration: currentSessionMinutes || 0,
          totalSittingToday: totalMinutes || 0,
          leftArmActive: chairData.sensor_data.left_armrest > 0,
          rightArmActive: chairData.sensor_data.right_armrest > 0,
          leftLegActive: chairData.sensor_data.left_legrest > 0,
          rightLegActive: chairData.sensor_data.right_legrest > 0,
          positionChanges: positionChanges || 0
        };
        
        const lstmTasks = await predictWithLSTM(userBehaviorData, currentState);
        
        if (lstmTasks && lstmTasks.length > 0) {
          // Log the personalized recommendations
          console.log("TensorFlow LSTM personalized task recommendations:", lstmTasks);
          return lstmTasks;
        }
      } catch (err) {
        console.error("Error generating LSTM tasks:", err);
      }
    }
    
    console.log("Using default task recommendations (LSTM model not ready or insufficient data)");
    
    // Fall back to rule-based recommendations if LSTM is not ready
    // Input parameters
    const userWeight = chairData.sensor_data.weight_kg || 0;
    const sittingDuration = currentSessionMinutes || 0; // in minutes
    const position = chairData.sittingPosition || 'Normal';
    const totalSittingToday = totalMinutes || 0; // in minutes
    
    // Sensor data
    const leftArmActive = chairData.sensor_data.left_armrest > 0;
    const rightArmActive = chairData.sensor_data.right_armrest > 0;
    const leftLegActive = chairData.sensor_data.left_legrest > 0;
    const rightLegActive = chairData.sensor_data.right_legrest > 0;
    
    // Weight categories (in kg)
    const isLightWeight = userWeight < 60;
    const isMediumWeight = userWeight >= 60 && userWeight < 85;
    const isHeavyWeight = userWeight >= 85;
    
    // Sitting duration categories
    const isShortSitting = sittingDuration < 30;
    const isModerateSitting = sittingDuration >= 30 && sittingDuration < 90;
    const isLongSitting = sittingDuration >= 90;
    
    // Position categories
    const hasPostureIssue = position === 'Forward Slouch' || position === 'Leaning Forward' || position === 'Slouched';
    const hasAsymmetricPosition = (leftArmActive !== rightArmActive) || (leftLegActive !== rightLegActive);
    
    const tasks = [];
    
    // TASK 1: Stand Up (everyone needs this, duration shortened to be realistic)
    tasks.push({
      id: 1,
      title: 'Stand Up',
      description: 'Stand up completely from your chair',
      duration: 0.1, // 1 minute
      completed: false,
      priority: 'high'
    });
    
    // TASK 2: Basic stretching based on weight and duration
    if (isHeavyWeight) {
      tasks.push({
        id: 2,
        title: 'Gentle Joint Mobility',
        description: 'Perform gentle ankle, knee, and hip rotations',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (isMediumWeight) {
      tasks.push({
        id: 2,
        title: 'Full Body Stretch',
        description: 'Reach arms overhead, then bend to each side',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    } else {
      // Light weight (below 60kg)
      tasks.push({
        id: 2,
        title: 'Quick Stretch',
        description: 'Stretch your arms overhead and twist gently',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    }
    
    // TASK 3: Circulation improvement
    if (isLongSitting) {
      tasks.push({
        id: 3,
        title: 'Walk Around',
        description: 'Take a few steps to improve circulation',
        duration: isHeavyWeight ? 0.1 : 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (isModerateSitting) {
      tasks.push({
        id: 3,
        title: 'March in Place',
        description: 'March in place for a few seconds',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    }
    
    // TASK 4: Posture correction based on specific position
    if (position === 'Forward Slouch') {
      tasks.push({
        id: 4,
        title: 'Posture Reset',
        description: 'Roll your shoulders back and engage your core',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (position === 'Leaning Forward') {
      tasks.push({
        id: 4,
        title: 'Back Extension',
        description: 'Place hands on lower back and gently arch backward',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (position === 'Leaning Left') {
      tasks.push({
        id: 4,
        title: 'Right Side Stretch',
        description: 'Stretch your body toward the right side to counter left leaning',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (position === 'Leaning Right') {
      tasks.push({
        id: 4,
        title: 'Left Side Stretch',
        description: 'Stretch your body toward the left side to counter right leaning',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (position === 'Bending Backward') {
      tasks.push({
        id: 4,
        title: 'Forward Fold',
        description: 'Gently bend forward at your waist to counter backward leaning',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    } else if (hasPostureIssue) {
      tasks.push({
        id: 4,
        title: 'Posture Alignment',
        description: 'Stand with back against wall, align shoulders and head',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'high'
      });
    }
    
    // TASK 5: Targeted exercises based on inactive limbs
    if (!leftArmActive && !rightArmActive) {
      tasks.push({
        id: 5,
        title: 'Arm Activation',
        description: 'Do 3 arm circles for each arm',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    } else if (!leftLegActive && !rightLegActive) {
      tasks.push({
        id: 5,
        title: 'Leg Activation',
        description: 'Do 3 calf raises and 3 gentle knee bends',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    } else if (hasAsymmetricPosition) {
      tasks.push({
        id: 5,
        title: 'Balance Restoration',
        description: 'Stand on one foot briefly, then switch',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    }
    
    // TASK 6: Hydration reminder for everyone
    tasks.push({
      id: 6,
      title: 'Hydration Break',
      description: 'Drink some water to stay hydrated',
      duration: 0.1, // 1 minute
      completed: false,
      priority: 'medium'
    });
    
    // TASK 7: Mindfulness for long sessions or weight-specific
    if (isLongSitting || totalSittingToday > 180) {
      tasks.push({
        id: 7,
        title: 'Quick Breath',
        description: 'Take one deep breath and release tension',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'low'
      });
    } else if (isHeavyWeight) {
      tasks.push({
        id: 7,
        title: 'Deep Breathing',
        description: 'Take 2 deep breaths',
        duration: 0.1, // 1 minute
        completed: false,
        priority: 'medium'
      });
    }
    
    // TASK 8: Eye strain relief for everyone
    tasks.push({
      id: 8,
      title: 'Eye Relief',
      description: 'Look at something far away briefly',
      duration:0.1, // 1 minute
      completed: false,
      priority: 'low'
    });
    
    // Sort tasks by priority
    const priorityValues = { 'high': 1, 'medium': 2, 'low': 3 };
    tasks.sort((a, b) => priorityValues[a.priority] - priorityValues[b.priority]);
    
    // Limit to 5 tasks maximum to avoid overwhelming the user
    return tasks.slice(0, 5);
  };

  // Start a task
  const startTask = () => {
    if (aiTasks.length === 0 || currentTaskIndex >= aiTasks.length) return;
    
    const task = aiTasks[currentTaskIndex];
    setTaskInProgress(true);
    setTaskTimeRemaining(task.duration * 60); // Convert minutes to seconds
    
    // Start timer
    if (taskTimerRef.current) {
      clearInterval(taskTimerRef.current);
    }
    
    taskTimerRef.current = setInterval(() => {
      setTaskTimeRemaining(prev => {
        if (prev <= 1) {
          // Task completed
          clearInterval(taskTimerRef.current);
          taskTimerRef.current = null;
          
          // Mark task as completed
          const updatedTasks = [...aiTasks];
          updatedTasks[currentTaskIndex].completed = true;
          setAiTasks(updatedTasks);
          
          // Move to next task after a delay
          setTimeout(() => {
            setTaskInProgress(false);
            setCurrentTaskIndex(prev => prev + 1);
            if (currentTaskIndex + 1 < aiTasks.length) {
              setShowTaskModal(true);
            } else {
              // All tasks completed
              addToReports({
                type: 'tasksCompleted',
                taskCount: aiTasks.length
              });
              // Start cooldown period after all tasks are done
              startCooldownPeriod();
            }
          }, 2000);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Skip a task
  const skipTask = () => {
    if (taskTimerRef.current) {
      clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
    
    setTaskInProgress(false);
    setCurrentTaskIndex(prev => prev + 1);
    if (currentTaskIndex + 1 < aiTasks.length) {
      setShowTaskModal(true);
    } else {
      // All tasks have been skipped or completed - start cooldown
      startCooldownPeriod();
    }
  };
  
  // Start cooldown period
  const startCooldownPeriod = () => {
    setTaskCooldownActive(true);
    console.log('Starting 10-second cooldown period before next task suggestions');
    
    // Record in reports
    addToReports({
      type: 'taskCooldownStarted',
      timestamp: new Date().toISOString()
    });
    
    // Set 10-second cooldown timer
    // At the end of the startCooldownPeriod function, add:
setTimeout(() => {
  setTaskCooldownActive(false);
  console.log('Cooldown period ended, can suggest tasks again');
  
  // Record in reports
  addToReports({
    type: 'taskCooldownEnded',
    timestamp: new Date().toISOString()
  });
  
  // Reset task states completely
  setAiTasks([]);
  setCurrentTaskIndex(0);
  setTaskInProgress(false);
  setShowTaskModal(false);
  
  // Reset the position timer so tasks will be suggested again quickly
  setLastPositionChangeTime(Date.now() - 9000); // Set as if in position for 9 seconds already
  
}, 0.2 * 60 * 1000); // Make this 20 seconds if that's the intended time
  };

  // Dismiss AI mode
  const dismissAiMode = () => {
    setShowTaskModal(false);
    if (taskTimerRef.current) {
      clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
    setTaskInProgress(false);
    setAiTasks([]);
    
    // Record dismissal in reports
    addToReports({
      type: 'aiModeDismissed'
    });
  };

  // Toggle AI mode
  const toggleAiMode = () => {
    setAiModeEnabled(prev => !prev);
    
    // Record AI mode toggle in reports
    addToReports({
      type: aiModeEnabled ? 'aiModeDisabled' : 'aiModeEnabled'
    });
  };

  // Format time for display (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Manual Task Button component
  const ManualTaskButton = () => {
    if (!chairData?.isPersonSitting) return null;
    
    return (
      <button
      onClick={() => {
        if (taskCooldownActive) {
          alert("Please wait before generating new tasks. Your body needs rest between activity sessions.");
          return;
        }
        
        // Generate tasks asynchronously
        generateAiTasks().then(tasks => {
          if (tasks && tasks.length > 0) {
            setAiTasks(tasks);
            setCurrentTaskIndex(0);
            setShowTaskModal(true);
            
            // Reset position timer when manually generating tasks
            setLastPositionChangeTime(Date.now());
          }
        }).catch(err => {
          console.error("Error generating AI tasks:", err);
        });
      }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {aiModeEnabled ? "Generate AI Health Tasks Now" : "Get Health Recommendations"}
      </button>
    );
  };

  // Task Modal Component
  const TaskModal = () => {
    if (!showTaskModal && !taskInProgress) return null;
    
    const currentTask = aiTasks[currentTaskIndex];
    
    if (!currentTask) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden transition-colors ${
          darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'
        }`}>
          {/* Header */}
          <div className={`px-6 py-4 ${darkMode ? 'bg-blue-800' : 'bg-blue-600'} text-white`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                {lstmModelReady && userBehaviorData.length >= 3 ? 
                  'Personalized Health Recommendation' : 
                  'Health Recommendation'}
              </h3>
              {!taskInProgress && (
                <button onClick={() => setShowTaskModal(false)} className="text-white hover:text-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 py-4">
            {!taskInProgress ? (
              <>
                <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  You've been sitting for {currentSessionMinutes}:{currentSessionSeconds.toString().padStart(2, '0')} minutes.
                  Here's a recommended activity to improve your health:
                </p>
                
                <div className={`p-4 rounded-lg border mb-4 ${
                  darkMode 
                    ? 'bg-blue-900 bg-opacity-30 border-blue-800 text-blue-200' 
                    : 'bg-blue-50 border-blue-100 text-blue-700'
                }`}>
                  <h4 className={`font-bold text-lg ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                    {currentTask.title}
                  </h4>
                  <p>{currentTask.description}</p>
                  <p className={`mt-2 text-sm ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    Duration: {Math.round(currentTask.duration * 60)} seconds
                  </p>
                  
                  {currentTask.personalizedReason && (
                    <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-blue-800' : 'border-blue-200'}`}>
                      <p className={`text-sm italic ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        <span className="font-medium">Why this recommendation:</span> {currentTask.personalizedReason}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between">
                <button 
                  onClick={skipTask}
                  className={`px-4 py-2 rounded-lg ${
                    darkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Skip
                </button>
                <button 
                  onClick={startTask}
                  className={`px-4 py-2 rounded-lg ${
                    darkMode 
                      ? 'bg-blue-700 text-white hover:bg-blue-600' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Start Task
                </button>
              </div>
              </>
            ) : (
              <>
                <div className="text-center py-6">
                  <h4 className={`font-bold text-xl mb-2 ${
                    darkMode ? 'text-blue-300' : 'text-blue-800'
                  }`}>{currentTask.title}</h4>
                  <p className={darkMode ? 'text-gray-300' : 'text-gray-700'} className="mb-6">
                    {currentTask.description}
                  </p>
                  
                  {currentTask.completed ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                        darkMode ? 'bg-green-900 bg-opacity-40' : 'bg-green-100'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${
                          darkMode ? 'text-green-400' : 'text-green-600'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className={`text-lg font-medium ${
                        darkMode ? 'text-green-400' : 'text-green-600'
                      }`}>Task Completed!</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32 mb-4">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                          <circle 
                            cx="50" cy="50" r="45" fill="none" 
                            stroke={darkMode ? "#4B5563" : "#E5E7EB"} strokeWidth="10" 
                          />
                          <circle 
                            cx="50" cy="50" r="45" fill="none" 
                            stroke={darkMode ? "#3B82F6" : "#3B82F6"} strokeWidth="10" 
                            strokeDasharray="283" 
                            strokeDashoffset={283 - (283 * (taskTimeRemaining / (currentTask.duration * 60)))}
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-2xl font-bold ${
                            darkMode ? 'text-blue-400' : 'text-blue-600'
                          }`}>{formatTime(taskTimeRemaining)}</span>
                        </div>
                      </div>
                      <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        Complete the task before the timer ends
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };
 
  // Render the component
  if (loading) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center z-50 transition-colors duration-300 ${
        darkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className={`w-16 h-16 border-4 rounded-full animate-spin ${
          darkMode 
            ? 'border-gray-800 border-t-blue-500' 
            : 'border-gray-200 border-t-blue-600'
        }`}></div>
      </div>
    );
  }


  if (error) {
    return (
      <div className={`error p-4 rounded-lg ${
        darkMode ? 'bg-red-900 bg-opacity-30 text-red-300' : 'bg-red-50 text-red-700'
      }`}>{error}</div>
    );
  }

  if (!chairData) {
    return (
      <div className={`no-data p-4 text-center ${
        darkMode ? 'text-gray-400' : 'text-gray-600'
      }`}>No chair data available</div>
    );
  }
  
  return (
    <div className={`flex items-center justify-center min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950' 
        : 'bg-gradient-to-br from-blue-100 to-indigo-100'
    }`}>
      <div className={`w-full max-w-4xl px-8 py-10 mx-4 rounded-xl shadow-lg transition-colors duration-300 ${
        darkMode 
          ? 'bg-gray-800 text-gray-100' 
          : 'bg-white text-gray-800'
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
      
        {/* Header Section with Improved Styling */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div className="flex items-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mr-4 shadow-md ${
              darkMode ? 'bg-blue-700' : 'bg-blue-600'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
              </svg>
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Chair #{chairId} Monitor
              </h1>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                Smart Chair Monitoring System
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              className={`px-4 py-2.5 rounded-lg shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                darkMode 
                  ? 'bg-green-700 text-white hover:bg-green-600 focus:ring-green-600 focus:ring-offset-gray-800' 
                  : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 focus:ring-offset-white'
              }`}
              onClick={() => navigate(`/chair-activity/${chairId}`)}
            >
              <div className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View Activity Log
              </div>
            </button>
            <button
              className={`px-4 py-2.5 rounded-lg shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                darkMode 
                  ? 'bg-blue-700 text-white hover:bg-blue-600 focus:ring-blue-600 focus:ring-offset-gray-800' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 focus:ring-offset-white'
              }`}
              onClick={() => navigate('/chair-selection')}
            >
              <div className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Chairs
              </div>
            </button>
          </div>
        </div>
        
        {/* Last Updated Info - Improved Styling */}
        <div className={`mb-4 px-4 py-3 rounded-lg border shadow-sm ${
          darkMode 
            ? 'bg-gray-700 border-gray-600' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <p className={`text-sm text-right ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className="font-medium">Last updated on </span>
            <span className={`font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              {chairData.sensor_data.timestamp}
            </span> 
          </p>
        </div>
        
        {/* Mode Toggle Switch - Improved Styling */}
        <div className={`mb-6 p-6 rounded-lg shadow-md border ${
          darkMode 
            ? 'bg-gray-700 border-gray-600' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Operation Mode
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {aiModeEnabled ? 
                  "AI Mode: Automatic health reminders enabled" : 
                  "Normal Mode: Only manual health reminders"}
              </p>
            </div>
            <div className="flex items-center">
              <span className={`mr-2 text-sm ${
                !aiModeEnabled 
                  ? darkMode ? "font-medium text-gray-100" : "font-medium text-gray-800" 
                  : darkMode ? "text-gray-500" : "text-gray-500"
              }`}>
                Normal
              </span>
              <div className="relative inline-block w-14 mr-2 align-middle select-none">
                <input 
                  type="checkbox" 
                  name="toggle" 
                  id="toggle" 
                  checked={aiModeEnabled}
                  onChange={() => {
                    setAiModeEnabled(!aiModeEnabled);
                  }}
                  className="opacity-0 w-0 h-0 absolute"
                />
                <label 
                  htmlFor="toggle" 
                  className={`block overflow-hidden h-7 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
                    aiModeEnabled 
                      ? darkMode ? 'bg-blue-700' : 'bg-blue-600' 
                      : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                >
                  <span 
                    className={`block h-7 w-7 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-in-out ${
                      aiModeEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  ></span>
                </label>
              </div>
              <span className={`text-sm ${
                aiModeEnabled 
                  ? darkMode ? "font-medium text-blue-400" : "font-medium text-blue-600" 
                  : darkMode ? "text-gray-500" : "text-gray-500"
              }`}>
                AI
              </span>
            </div>
          </div>
        </div>
  
        {/* Hydration Alert - Improved Styling */}
        {showHydrationAlert && chairData?.isPersonSitting && (
          <div className={`mb-6 p-4 border-l-4 border-blue-500 rounded-lg flex items-start justify-between shadow-sm ${
            darkMode 
              ? 'bg-blue-900 bg-opacity-30' 
              : 'bg-blue-100'
          }`}>
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mr-3 flex-shrink-0 ${
                darkMode ? 'text-blue-400' : 'text-blue-500'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={darkMode ? 'text-blue-300' : 'text-blue-700'}>
                <span className="font-bold">Hydration Reminder:</span> You've been sitting for 0.1+ minutes. Consider getting up for a water break.
              </p>
            </div>
            <button 
              onClick={() => setShowHydrationAlert(false)}
              className={`ml-4 transition-colors ${
                darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Chair Data Display - Enhanced Card Design */}
        <div className="space-y-8">
          {/* Status Cards - Improved Grid Layout */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Occupancy and Weight Card - Enhanced Visuals */}
            <div className={`p-6 rounded-lg shadow-md border ${
              darkMode 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}>
              <h2 className={`mb-5 text-lg font-semibold flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Chair Status
              </h2>
              <div className="grid grid-cols-2 gap-5">
                <div className={`p-5 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Occupancy
                  </p>
                  <div className="mt-4 flex flex-col items-center">
                    {chairData.isOccupied ? (
                      chairData.isPersonSitting ? (
                        /* Person sitting icon */
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-20 w-20 ${
                          darkMode ? 'text-blue-400' : 'text-blue-600'
                        }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="7" r="4" />
                          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                          <rect x="8" y="15" width="8" height="6" rx="1" />
                        </svg>
                      ) : (
                        /* Box/object icon */
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-20 w-20 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8l9-4 9 4z" />
                          <path d="M12 4v16M3 8h18" />
                        </svg>
                      )
                    ) : (
                      /* Empty chair icon */
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-20 w-20 ${
                        darkMode ? 'text-gray-500' : 'text-gray-400'
                      }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="11" width="12" height="10" rx="2" />
                        <path d="M5 19h14M10 5v6M14 5v6" />
                      </svg>
                    )}
                    <p className={`mt-3 text-lg font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                      {chairData.isOccupied ? 
                        chairData.isPersonSitting ? 'Person Sitting' : 'Object Placed' 
                        : 'Empty'}
                    </p>
                  </div>
                </div>
                
                <div className={`p-5 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Weight
                  </p>
                  <div className="mt-4 flex flex-col items-center">
                    <div className={`relative w-28 h-28 flex items-center justify-center rounded-full mb-2 shadow-inner ${
                      darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-100'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 absolute opacity-30 ${
                        darkMode ? 'text-blue-400' : 'text-blue-500'
                      }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      <p className={`text-2xl font-bold z-10 ${
                        darkMode ? 'text-blue-300' : 'text-blue-800'
                      }`}>
                        {(chairData.sensor_data.weight_kg).toFixed(0) || '0'}
                      </p>
                    </div>
                    <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>kg</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Sitting Position Card - Enhanced Visualization */}
            <div className={`p-6 rounded-lg shadow-md border ${
              darkMode 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}>
              <h2 className={`mb-5 text-lg font-semibold flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Sitting Position
              </h2>
              <div className={`p-5 rounded-lg border shadow-sm ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                {chairData.isPersonSitting ? (
                  <div className="flex flex-col items-center">
                    {/* Visual representation of sitting position */}
                    <div className={`w-44 h-44 relative rounded-lg mb-5 flex items-center justify-center shadow-inner ${
                      darkMode ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'
                    }`}>
                      {/* Chair outline */}
                      <svg xmlns="http://www.w3.org/2000/svg" className={`w-36 h-36 ${
                        darkMode ? 'text-blue-800' : 'text-blue-200'
                      }`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="25" y="60" width="50" height="30" rx="2" />
                        <path d="M30 60 V40 H70 V60" />
                        <path d="M30 50 H70" />
                      </svg>
                      
                      {/* Person representation based on sensor data */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32 absolute" viewBox="0 0 100 100">
                        {/* Head */}
                        <circle cx="50" cy="35" r="10" fill={chairData.isPersonSitting ? (darkMode ? "#60A5FA" : "#3B82F6") : "transparent"} />
                        
                        {/* Torso */}
                        <path d={`M50 45 L50 ${chairData.sittingPosition === 'Forward Slouch' ? '75' : '65'}`} stroke={darkMode ? "#60A5FA" : "#3B82F6"} strokeWidth="4" />
                        
                        {/* Left arm */}
                        <path d={`M50 50 L${chairData.sensor_data.left_armrest ? '30' : '40'} ${chairData.sensor_data.left_armrest ? '45' : '55'}`} 
                          stroke={chairData.sensor_data.left_armrest ? 
                            (darkMode ? "#60A5FA" : "#3B82F6") : 
                            (darkMode ? "#93C5FD" : "#93C5FD")} 
                          strokeWidth="4" />
                        
                        {/* Right arm */}
                        <path d={`M50 50 L${chairData.sensor_data.right_armrest ? '70' : '60'} ${chairData.sensor_data.right_armrest ? '45' : '55'}`} 
                          stroke={chairData.sensor_data.right_armrest ? 
                            (darkMode ? "#60A5FA" : "#3B82F6") : 
                            (darkMode ? "#93C5FD" : "#93C5FD")} 
                          strokeWidth="4" />
                        
                        {/* Left leg */}
                        <path d={`M50 65 L${chairData.sensor_data.left_legrest ? '40' : '45'} 85`} 
                          stroke={chairData.sensor_data.left_legrest ? 
                            (darkMode ? "#60A5FA" : "#3B82F6") : 
                            (darkMode ? "#93C5FD" : "#93C5FD")} 
                          strokeWidth="4" />
                        
                        {/* Right leg */}
                        <path d={`M50 65 L${chairData.sensor_data.right_legrest ? '60' : '55'} 85`} 
                          stroke={chairData.sensor_data.right_legrest ? 
                            (darkMode ? "#60A5FA" : "#3B82F6") : 
                            (darkMode ? "#93C5FD" : "#93C5FD")} 
                          strokeWidth="4" />
                      </svg>
                    </div>
                    
                    <div className="text-center">
                      <p className={`text-lg font-medium mb-2 ${
                        darkMode ? 'text-gray-100' : 'text-gray-800'
                      }`}>
                        {chairData.sittingPosition || 'Normal'}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 justify-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          chairData.sensor_data.left_armrest ? 
                            (darkMode ? 'bg-blue-900 bg-opacity-50 text-blue-300' : 'bg-blue-100 text-blue-800') : 
                            (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')
                        }`}>
                          Left Arm {chairData.sensor_data.left_armrest ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          chairData.sensor_data.right_armrest ? 
                            (darkMode ? 'bg-blue-900 bg-opacity-50 text-blue-300' : 'bg-blue-100 text-blue-800') : 
                            (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')
                        }`}>
                          Right Arm {chairData.sensor_data.right_armrest ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          chairData.sensor_data.left_legrest ? 
                            (darkMode ? 'bg-blue-900 bg-opacity-50 text-blue-300' : 'bg-blue-100 text-blue-800') : 
                            (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')
                        }`}>
                          Left Leg {chairData.sensor_data.left_legrest ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          chairData.sensor_data.right_legrest ? 
                            (darkMode ? 'bg-blue-900 bg-opacity-50 text-blue-300' : 'bg-blue-100 text-blue-800') : 
                            (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')
                        }`}>
                          Right Leg {chairData.sensor_data.right_legrest ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    {chairData.positionWarning && (
                      <div className={`mt-4 p-3 border rounded-lg flex items-start ${
                        darkMode 
                          ? 'bg-yellow-900 bg-opacity-30 border-yellow-800 text-yellow-300' 
                          : 'bg-yellow-50 border-yellow-100 text-yellow-700'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 flex-shrink-0 mt-0.5 ${
                          darkMode ? 'text-yellow-400' : 'text-yellow-500'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm">{chairData.positionWarning}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-20 w-20 mx-auto mb-3 ${
                      darkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                    <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                      No sitting position data available
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Pressure Distribution Component */}
            {chairData && (
              <PressureDistribution 
                sensorData={chairData} 
                darkMode={darkMode}
              />
            )}
          </div>
          
          {/* Usage Statistics Card - Enhanced Design */}
          <div className={`p-6 rounded-lg shadow-md border ${
            darkMode 
              ? 'bg-gray-700 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <h2 className={`mb-5 text-lg font-semibold flex items-center ${
              darkMode ? 'text-gray-100' : 'text-gray-800'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                darkMode ? 'text-blue-400' : 'text-blue-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Usage Statistics
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className={`p-5 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Current session
                </p>
                <div className="mt-3 flex items-end">
                  <p className={`text-2xl font-semibold ${
                    darkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {currentSessionMinutes}:{currentSessionSeconds.toString().padStart(2, '0')}
                  </p>
                  <span className={`text-sm font-normal ml-1 mb-1 ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>min:sec</span>
                </div>
                <div className={`mt-3 w-full rounded-full h-3 ${
                  darkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <div className={`h-3 rounded-full ${
                    darkMode ? 'bg-blue-500' : 'bg-blue-600'
                  }`} style={{ 
                    width: `${Math.min(((currentSessionMinutes * 60 + currentSessionSeconds) / (10 * 60)) * 100, 100)}%` 
                  }}></div>
                </div>
              </div>
              
              <div className={`p-5 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Today's sitting time
                </p>
                <div className="mt-3 flex items-end">
                  <p className={`text-2xl font-semibold ${
                    darkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {Math.floor(totalMinutes)}:{Math.floor((totalMinutes * 60) % 60).toString().padStart(2, '0')}
                  </p>
                  <span className={`text-sm font-normal ml-1 mb-1 ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>hr:min</span>
                </div>
                <div className={`mt-3 w-full rounded-full h-3 ${
                  darkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <div className={`h-3 rounded-full ${
                    darkMode ? 'bg-blue-500' : 'bg-blue-600'
                  }`} style={{ width: `${Math.min((totalMinutes / 120) * 100, 100)}%` }}></div>
                </div>
              </div>
              
              <div className={`p-5 rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-300 ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Position Changes
                </p>
                <div className="mt-3 flex items-end">
                  <p className={`text-2xl font-semibold ${
                    darkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {chairData.positionChanges || 0}
                  </p>
                  <span className={`text-sm font-normal ml-1 mb-1 ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>today</span>
                </div>
                <div className={`mt-3 w-full rounded-full h-3 ${
                  darkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <div className={`h-3 rounded-full ${
                    darkMode ? 'bg-blue-500' : 'bg-blue-600'
                  }`} style={{ width: `${Math.min((chairData.positionChanges || 0) * 5, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recommendations - Enhanced Card Design */}
          <div className={`p-6 rounded-lg shadow-md border ${
            darkMode 
              ? 'bg-blue-900 bg-opacity-20 border-blue-800' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <h2 className={`mb-5 text-lg font-semibold flex items-center ${
              darkMode ? 'text-blue-300' : 'text-blue-800'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${
                darkMode ? 'text-blue-400' : 'text-blue-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Health Recommendations
            </h2>
            
            <div className="space-y-5">
              {chairData.isPersonSitting && chairData.minutes > 120 && (
                <div className={`flex items-start p-4 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-800 bg-opacity-70 border-blue-900' 
                    : 'bg-white bg-opacity-70 border-blue-100'
                }`}>
                  <div className={`flex-shrink-0 rounded-full p-2 mr-4 ${
                    darkMode ? 'bg-blue-900' : 'bg-blue-200'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${
                      darkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`text-md font-medium ${
                      darkMode ? 'text-blue-300' : 'text-blue-800'
                    }`}>Take a Break</h3>
                    <p className={`text-sm ${
                      darkMode ? 'text-blue-200' : 'text-blue-700'
                    }`}>You've been sitting for {chairData.minutes} minutes today. Consider taking a 5-minute break to stretch and move around.</p>
                  </div>
                </div>
              )}
                  
              {chairData.isPersonSitting && chairData.positionChanges < 5 && chairData.hours > 1 && (
                <div className={`flex items-start p-4 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-800 bg-opacity-70 border-blue-900' 
                    : 'bg-white bg-opacity-70 border-blue-100'
                }`}>
                  <div className={`flex-shrink-0 rounded-full p-2 mr-4 ${
                    darkMode ? 'bg-blue-900' : 'bg-blue-200'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${
                      darkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`text-md font-medium ${
                      darkMode ? 'text-blue-300' : 'text-blue-800'
                    }`}>Change Position</h3>
                    <p className={`text-sm ${
                      darkMode ? 'text-blue-200' : 'text-blue-700'
                    }`}>Try to shift positions more frequently. Aim for at least 8-10 position changes per hour to improve circulation.</p>
                  </div>
                </div>
              )}
              
              {chairData.positionWarning && (
                <div className={`flex items-start p-4 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-800 bg-opacity-70 border-blue-900' 
                    : 'bg-white bg-opacity-70 border-blue-100'
                }`}>
                  <div className={`flex-shrink-0 rounded-full p-2 mr-4 ${
                    darkMode ? 'bg-blue-900' : 'bg-blue-200'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${
                      darkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`text-md font-medium ${
                      darkMode ? 'text-blue-300' : 'text-blue-800'
                    }`}>Improve Posture</h3>
                    <p className={`text-sm ${
                      darkMode ? 'text-blue-200' : 'text-blue-700'
                    }`}>{chairData.positionWarning} A balanced posture can reduce strain on your back and neck.</p>
                  </div>
                </div>
              )}
              
              {!aiModeEnabled && (
              <div className="mt-6 flex justify-center">
                <ManualTaskButton />
                {/* <PressureDistribution sensorData={chairData} darkMode={darkMode}/> */}
              </div>
            )}
            </div>
          </div>
        </div>
        
        {/* Task Modal */}
        <TaskModal />
      </div>
    </div>
  );
};

export default ChairMonitor;