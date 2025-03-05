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
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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
            }
          } catch (error) {
            setReadingStatus(`Error verifying chair: ${error.message}`);
          }
        }
      });

      ndef.addEventListener("error", (event) => {
        setReadingStatus(`Error: ${event.message}`);
      });
    } catch (error) {
      setReadingStatus(`Scan failed: ${error.message}`);
      console.error('NFC scanning error:', error);
    }
  };

  const handleChairSelect = (chairId) => {
    navigate(`/chair/${chairId}`);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-100">
      <div className="w-full max-w-4xl px-8 py-10 mx-4 bg-white rounded-xl shadow-lg">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800">Smart Chair</h1>
          <p className="mt-2 text-gray-600">Tap NFC or Select a Chair</p>
        </div>
        
        {/* NFC Scan Status */}
        {readingStatus && (
          <div className={`mb-6 p-3 rounded-lg text-center ${
            readingStatus.includes('Error') || readingStatus.includes('not supported') 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {readingStatus}
          </div>
        )}

        {/* NFC Scan Button */}
        {nfcSupported && (
          <div className="mb-6 text-center">
            <button 
              onClick={handleNFCScan}
              className="py-3 px-8 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition duration-150 ease-in-out"
            >
              Scan NFC Tag
            </button>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading chairs...</p>
          </div>
        ) : (
          <>
            {/* No Chairs State */}
            {chairs.length === 0 ? (
              <div className="py-8 px-4 bg-gray-50 rounded-lg text-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">No chairs found</h3>
                <p className="mt-2 text-gray-600">You haven't added any chairs to monitor yet.</p>
              </div>
            ) : (
              /* Chair Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {chairs.map((chair) => (
                  <div 
                    key={chair.id}
                    onClick={() => handleChairSelect(chair.id)}
                    className="border border-gray-200 rounded-lg p-5 transition-all hover:shadow-md hover:border-blue-300 cursor-pointer"
                  >
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">Chair #{chair.id}</h3>
                    </div>
                    <p className="text-gray-600 mb-2">
                      {chair.location || "No location specified"}
                    </p>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm text-blue-600 font-medium">View details</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add New Chair Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => navigate('/add-chair')}
                className="py-3 px-8 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add New Chair
              </button>
            </div>
          </>
        )}
        
        {/* NFC Instructions */}
        {nfcSupported && (
          <div className="mt-6 text-center text-gray-600 text-sm">
            <p>💡 Tip: You can also tap an NFC tag to quickly select a chair</p>
          </div>
        )}
        
        {/* Navigation Option */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Want to go back?{' '}
            <button 
              onClick={() => navigate(-1)}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Return to previous page
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NFCChairSelection;