import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../../config/firebase';

const ChairMonitor = () => {
  const { chairId } = useParams();
  const navigate = useNavigate();
  const [chairData, setChairData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const chairRef = ref(database, `chairs/${chairId}`);
    
    const unsubscribe = onValue(chairRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Process the raw data to determine sitting position and occupancy
        const processedData = {
          ...data,
          isOccupied: data.weight > 0,
          isPersonSitting: data.weight > 0 && (data.leftarm || data.leftleg || data.rightarm || data.rightleg), // Updated logic
          sittingPosition: determineSittingPosition(data),
          positionWarning: getPositionWarning(data)
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
    
    return () => unsubscribe();
  }, [chairId]);

  // Helper function to determine sitting position based on sensor data
  const determineSittingPosition = (data) => {
    // Default position
    if (!data) return 'Unknown';
    
    const { leftarm, leftleg, rightarm, rightleg } = data;
    
    // If no sensors are active but there's weight, it's an object
    if (data.weight > 0 && !leftarm && !leftleg && !rightarm && !rightleg) {
      return 'Object Placed';
    }
    
    // If all sensors are active, the position is balanced
    if (leftarm && leftleg && rightarm && rightleg) {
      return 'Balanced';
    }
    
    // Leaning left
    if (leftarm && leftleg && (!rightarm || !rightleg)) {
      return 'Leaning Left';
    }
    
    // Leaning right
    if (rightarm && rightleg && (!leftarm || !leftleg)) {
      return 'Leaning Right';
    }
    
    // Forward slouch - more weight on legs, less on arms
    if ((!leftarm && !rightarm) && (leftleg && rightleg)) {
      return 'Forward Slouch';
    }
    
    // Slouching back - more weight on arms, less on legs
    if ((leftarm && rightarm) && (!leftleg && !rightleg)) {
      return 'Slouching Back';
    }
    
    // Irregular pattern, possibly fidgeting or shifting
    return 'Irregular';
  };

  // Generate position warnings based on sitting position
  const getPositionWarning = (data) => {
    if (!data) return null;
    
    const position = determineSittingPosition(data);
    
    const warnings = {
      'Leaning Left': 'You are leaning too much to the left. Try to balance your weight.',
      'Leaning Right': 'You are leaning too much to the right. Try to balance your weight.',
      'Forward Slouch': 'You are slouching forward. Try to sit up straight.',
      'Slouching Back': 'You are slouching back. Try to maintain an upright posture.',
      'Irregular': 'Your sitting position is irregular. Try to maintain a consistent posture.'
    };
    
    return warnings[position] || null;
  };

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
          <button
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => navigate('/chair-selection')}
          >
            Back to Chairs
          </button>
        </div>
        
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
                  <p className="text-sm text-gray-600">Total Hours Today</p>
                  <div className="mt-2 flex items-end">
                    <p className="text-2xl font-semibold text-blue-600">
                      {chairData.hours || 0}
                    </p>
                    <span className="text-sm font-normal text-gray-600 ml-1 mb-1">hrs</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((chairData.hours || 0) * 10, 100)}%` }}></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm text-gray-600">Average Daily Hours</p>
                  <div className="mt-2 flex items-end">
                    <p className="text-2xl font-semibold text-blue-600">
                      {chairData.avgDailyHours || 3.5}
                    </p>
                    <span className="text-sm font-normal text-gray-600 ml-1 mb-1">hrs</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((chairData.avgDailyHours || 3.5) * 10, 100)}%` }}></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm text-gray-600">Position Changes</p>
                  <div className="mt-2 flex items-end">
                    <p className="text-2xl font-semibold text-blue-600">
                      {chairData.positionChanges || 12}
                    </p>
                    <span className="text-sm font-normal text-gray-600 ml-1 mb-1">today</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((chairData.positionChanges || 12) * 5, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recommendations */}
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
              <h2 className="mb-4 text-lg font-semibold text-blue-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recommendations
              </h2>
              <div className="space-y-3">
                {(chairData.hours || 0) > 2 && (
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <p className="text-blue-800">
                      You've been sitting for over {chairData.hours} hours today. Consider taking a short walk.
                    </p>
                  </div>
                )}
                {chairData.positionWarning && (
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <p className="text-blue-800">
                      {chairData.positionWarning}
                    </p>
                  </div>
                )}
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <p className="text-blue-800">
                    Remember to stand up and stretch every 30 minutes for optimal health.
                  </p>
                </div>
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <p className="text-blue-800">
                    Keep your feet flat on the floor and maintain a 90-degree angle at your knees and hips.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChairMonitor;