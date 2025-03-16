import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const NFCChairSelection = () => {
  const [chairs, setChairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nfcSupported, setNfcSupported] = useState(false);
  const [readingStatus, setReadingStatus] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Check if dark mode preference is stored in localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);
  
  useEffect(() => {
    // Check NFC support
    setNfcSupported('NDEFReader' in window);

    const fetchChairs = async () => {
      try {
        const chairsRef = ref(database, 'chairs');
        const snapshot = await get(chairsRef);
        
        if (snapshot.exists()) {
          const chairsData = snapshot.val();
          const chairsList = Object.keys(chairsData).map(id => ({
            id,
            ...chairsData[id]
          }));
          setChairs(chairsList);
        } else {
          setChairs([]);
        }
      } catch (error) {
        setError('Failed to load chairs: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChairs();
  }, []);

  const handleNFCScan = async () => {
    if (!nfcSupported) {
      setReadingStatus('Web NFC is not supported in this browser');
      return;
    }
    try {
      setIsScanning(true);
      setReadingStatus('Scanning for chair...');
      const ndef = new NDEFReader();
      
      await ndef.scan();
      ndef.addEventListener("reading", async ({ message }) => {
        let chairId = '';
        for (const record of message.records) {
          if (record.recordType === "text") {
            const textDecoder = new TextDecoder();
            chairId = textDecoder.decode(record.data).trim();
            break;
          }
        }

        // Verify chair exists in database
        if (chairId) {
          try {
            const chairRef = ref(database, `chairs/${chairId}`);
            const snapshot = await get(chairRef);
            
            if (snapshot.exists()) {
              setReadingStatus(`Chair ${chairId} found!`);
              navigate(`/chair/${chairId}`);
            } else {
              setReadingStatus(`No chair found with ID: ${chairId}`);
              setIsScanning(false);
            }
          } catch (error) {
            setReadingStatus(`Error verifying chair: ${error.message}`);
            setIsScanning(false);
          }
        }
      });

      ndef.addEventListener("error", (event) => {
        setReadingStatus(`Error: ${event.message}`);
        setIsScanning(false);
      });
    } catch (error) {
      setReadingStatus(`Scan failed: ${error.message}`);
      setIsScanning(false);
      console.error('NFC scanning error:', error);
    }
  };

  const handleChairSelect = (chairId) => {
    navigate(`/chair/${chairId}`);
  };
  
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  };

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100'
    }`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-20 animate-pulse ${
          darkMode ? 'bg-blue-700' : 'bg-blue-200'
        }`}></div>
        <div className={`absolute top-1/3 -right-20 w-80 h-80 rounded-full opacity-20 animate-pulse ${
          darkMode ? 'bg-indigo-700' : 'bg-indigo-200'
        }`} style={{ animationDelay: '1s' }}></div>
        <div className={`absolute -bottom-20 left-1/3 w-72 h-72 rounded-full opacity-20 animate-pulse ${
          darkMode ? 'bg-purple-700' : 'bg-purple-200'
        }`} style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className={`w-full max-w-4xl px-8 pt-20 pb-10 mx-4 rounded-xl shadow-2xl relative transition-all duration-300 hover:shadow-xl backdrop-blur-sm border ${
        darkMode 
          ? 'bg-gray-900 bg-opacity-90 border-gray-800 text-gray-100' 
          : 'bg-white bg-opacity-95 border-gray-100 text-gray-800'
      }`}>
        {/* Floating Logo */}
        <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 transition-transform duration-300 hover:scale-105">
          <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
            </svg>
          </div>
        </div>
        
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

        {/* Header */}
        <div className="text-center mb-6 mt-4">
          <h1 className={`text-4xl font-extrabold ${
            darkMode
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300'
              : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600'
          }`}>THRONE</h1>
          <p className={`mt-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Select your chair or use NFC to connect
          </p>
        </div>


        {/* NFC Scan Button */}
        {nfcSupported && (
          <div className="mb-8 text-center">
            <button 
              onClick={handleNFCScan}
              disabled={isScanning}
              className={`py-3 px-8 text-white rounded-lg transition duration-300 ease-in-out uppercase font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 ${
                darkMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {isScanning ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                    <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM7 11a1 1 0 100-2H4a1 1 0 100 2h3z" />
                  </svg>
                  Scan NFC Tag
                </div>
              )}
            </button>
          </div>
        )}
        
        {/* NFC Scan Status */}
        {readingStatus && (
          <div className={`mb-8 p-4 rounded-lg text-center transition-all duration-300 ${
            readingStatus.includes('Error') || readingStatus.includes('not supported') 
              ? 'bg-red-50 border-l-4 border-red-500 text-red-700' 
              : readingStatus.includes('found')
                ? 'bg-green-50 border-l-4 border-green-500 text-green-700'
                : 'bg-blue-50 border-l-4 border-blue-500 text-blue-700'
          }`}>
            <div className="flex items-center">
              {readingStatus.includes('Error') || readingStatus.includes('not supported') ? (
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : readingStatus.includes('found') ? (
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 mr-2 animate-pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
              <span>{readingStatus}</span>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg animate-fadeIn">
            <div className="flex">
              <svg className="h-5 w-5 text-red-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-6 text-gray-600 font-medium">Loading your chairs...</p>
          </div>
        ) : (
          <>
            {/* No Chairs State */}
            {chairs.length === 0 ? (
              <div className="py-10 px-6 bg-gray-50 rounded-lg text-center mb-8 border border-gray-100 shadow-sm">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No chairs found</h3>
                <p className="text-gray-600 mb-6">You haven't added any chairs to monitor yet.</p>
                <button className="py-2 px-6 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition duration-300 ease-in-out font-medium shadow-md hover:shadow-lg">
                  Add a New Chair
                </button>
              </div>
            ) : (
              /* Chair Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {chairs.map((chair) => (
                  <div 
                    key={chair.id}
                    onClick={() => handleChairSelect(chair.id)}
                    className={`border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-1 group ${
                      darkMode 
                        ? 'border-gray-700 bg-gray-800' 
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`p-4 flex items-center ${
                      darkMode 
                        ? 'bg-gradient-to-r from-blue-800 to-indigo-800' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-3 shadow-md group-hover:scale-110 transition-transform duration-300 ${
                        darkMode ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                          darkMode ? 'text-blue-400' : 'text-blue-600'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </div>
                      <div className="flex-grow">
                        <h3 className="text-lg font-semibold text-white">Chair #{chair.id}</h3>
                      </div>
                      <div className="flex items-center">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          darkMode
                            ? 'bg-gray-900 text-green-400'
                            : 'bg-green-100 text-green-800'
                        }`}>Connected</span>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className={`text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                            <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Active</span>
                          </div>
                        </div>
                        <div>
                          <div className={`text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Last Used</div>
                          <div className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Today</div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className={`h-2 w-full rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className={`h-2 rounded-full ${
                            darkMode ? 'bg-green-500' : 'bg-green-500'
                          }`} style={{ width: '70%' }}></div>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Battery</span>
                          <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>70%</span>
                        </div>
                      </div>
                      
                      <div className={`flex justify-between items-center mt-6 pt-4 ${darkMode ? 'border-t border-gray-700' : 'border-t border-gray-100'}`}>
                        <span className={`text-sm font-medium group-hover:underline ${
                          darkMode ? 'text-blue-400' : 'text-blue-600'
                        }`}>View details</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform group-hover:translate-x-1 transition-transform duration-300 ${
                          darkMode ? 'text-blue-400' : 'text-blue-600'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        

  
        {/* NFC Instructions */}
        {nfcSupported && (
          <div className={`mt-6 text-center p-3 rounded-lg border ${
            darkMode
              ? 'bg-gray-800 border-blue-800 text-gray-300'
              : 'bg-blue-50 border-blue-100 text-gray-600'
          }`}>
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p>Tip: You can also tap an NFC tag directly to quickly select a chair</p>
            </div>
          </div>
        )}
        
        {/* Navigation Option */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate(-1)}
            className={`py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-sm hover:shadow border flex items-center mx-auto ${
              darkMode
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back 
          </button>
        </div>
        
        {/* Footer */}
        <div className={`mt-8 pt-4 text-center text-xs ${
          darkMode
            ? 'border-t border-gray-800 text-gray-500'
            : 'border-t border-gray-100 text-gray-500'
        }`}>
          © 2025 THRONE. All rights reserved.
          <div className="mt-2 flex justify-center space-x-4">
            <a href="#" className={darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}>Privacy</a>
            <a href="#" className={darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}>Terms</a>
            <a href="#" className={darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}>Help</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFCChairSelection;