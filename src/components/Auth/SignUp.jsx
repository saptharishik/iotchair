import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const NFCReader = () => {
  const [isReading, setIsReading] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [lastTagData, setLastTagData] = useState(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();

  // Check if NFC is supported
  useEffect(() => {
    if ('NDEFReader' in window) {
      setNfcSupported(true);
    } else {
      setError('NFC is not supported in this browser or device.');
    }
  }, []);

  // Add to log function
  const addToLog = (message) => {
    setLogs(prevLogs => [
      { id: Date.now(), message, timestamp: new Date().toLocaleTimeString() },
      ...prevLogs.slice(0, 9) // Keep only the last 10 logs
    ]);
  };

  // Handle NFC tag reading
  const startNFCReader = async () => {
    if (!nfcSupported) return;
    
    setIsReading(true);
    setError('');
    
    try {
      const ndef = new window.NDEFReader();
      addToLog("Starting NFC scan...");
      
      await ndef.scan();
      addToLog("NFC scan started successfully");
      
      ndef.addEventListener("reading", ({ message, serialNumber }) => {
        const tagData = {
          serialNumber,
          records: parseNFCMessage(message)
        };
        
        setLastTagData(tagData);
        addToLog(`Tag detected! Serial: ${serialNumber}`);
        
        // Handle tag data here - could navigate based on tag data
        // e.g., navigate(`/chair/${serialNumber}`);
      });

      ndef.addEventListener("readingerror", () => {
        setError("Error reading NFC tag");
        addToLog("Error reading NFC tag");
      });
    } catch (error) {
      setIsReading(false);
      setError(`Error starting NFC reader: ${error.message}`);
      addToLog(`Error: ${error.message}`);
    }
  };

  // Stop NFC reading
  const stopNFCReader = () => {
    setIsReading(false);
    addToLog("NFC scanning stopped");
  };

  // Parse NFC message
  const parseNFCMessage = (message) => {
    const records = [];
    for (const record of message.records) {
      try {
        if (record.recordType === "text") {
          const textDecoder = new TextDecoder();
          const text = textDecoder.decode(record.data);
          records.push({ type: "text", data: text });
        } else if (record.recordType === "url") {
          const textDecoder = new TextDecoder();
          const url = textDecoder.decode(record.data);
          records.push({ type: "url", data: url });
        } else {
          records.push({ type: record.recordType, data: "Data in unsupported format" });
        }
      } catch (e) {
        records.push({ type: "unknown", data: "Failed to parse record" });
      }
    }
    return records;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-100">
      <div className="w-full max-w-md px-8 py-10 mx-4 bg-white rounded-xl shadow-lg">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
                <polygon points="18 2 22 6 12 16 8 16 8 12 18 2" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800">Smart Chair</h1>
          <p className="mt-2 text-gray-600">NFC Tag Reader</p>
        </div>
        
        {/* Status and Controls */}
        <div className="mb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {!nfcSupported && (
            <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded-lg">
              NFC is not supported in this browser or device. Please use a device and browser with NFC capabilities.
            </div>
          )}
          
          <div className="flex justify-center mb-6">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isReading ? 'animate-pulse bg-green-100' : 'bg-gray-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 ${isReading ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
                <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2" />
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <path d="M12 10a2 2 0 0 1 2 2" />
                <path d="M10 12a2 2 0 0 1 2-2" />
                <path d="M8.24 16.58A6 6 0 0 0 12 18c2.4 0 4.52-1.41 5.5-3.5" />
              </svg>
            </div>
          </div>
          
          <div className="text-center mb-4">
            <p className="text-lg font-medium">
              {isReading ? 'Scanning for NFC tags...' : 'Ready to scan'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {isReading ? 'Hold your device near an NFC tag' : 'Press the button below to start scanning'}
            </p>
          </div>
          
          <button
            onClick={isReading ? stopNFCReader : startNFCReader}
            disabled={!nfcSupported}
            className={`w-full py-3 px-4 text-white rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isReading 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            } ${!nfcSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isReading ? 'Stop Scanning' : 'Start NFC Scan'}
          </button>
        </div>
        
        {/* Last Tag Data */}
        {lastTagData && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Last Tag Read</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Serial Number:</span> {lastTagData.serialNumber}
            </p>
            <div className="mt-2">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Records:</h4>
              {lastTagData.records.length > 0 ? (
                <ul className="text-sm">
                  {lastTagData.records.map((record, index) => (
                    <li key={index} className="mb-1 p-2 bg-white rounded border border-gray-200">
                      <span className="font-medium">{record.type}:</span> {record.data}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No records found in tag</p>
              )}
            </div>
          </div>
        )}
        
        {/* Activity Log */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Activity Log</h3>
          <div className="border border-gray-200 rounded-lg bg-gray-50 h-40 overflow-y-auto p-2">
            {logs.length > 0 ? (
              <ul className="text-sm">
                {logs.map(log => (
                  <li key={log.id} className="mb-1 text-gray-600">
                    <span className="text-gray-400 text-xs">{log.timestamp}</span> - {log.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 p-2">No activity yet</p>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-500 text-sm font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NFCReader;