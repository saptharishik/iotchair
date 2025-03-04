import React, { useState, useEffect } from 'react';

const NFCTextReader = () => {
  const [nfcSupported, setNfcSupported] = useState(false);
  const [readingStatus, setReadingStatus] = useState('');
  const [nfcMessage, setNfcMessage] = useState('');

  useEffect(() => {
    // Check if Web NFC is supported
    setNfcSupported('NDEFReader' in window);
  }, []);

  const handleNFCScan = async () => {
    if (!nfcSupported) {
      setReadingStatus('Web NFC is not supported in this browser');
      return;
    }

    try {
      // Reset previous messages
      setReadingStatus('Scanning...');
      setNfcMessage('');

      // Create an NDEF reader
      const ndef = new NDEFReader();
      
      // Start scanning
      await ndef.scan();

      // Listen for readings
      ndef.addEventListener("reading", ({ message }) => {
        // Process each record in the NFC message
        let fullText = '';
        for (const record of message.records) {
          // Attempt to decode text records
          try {
            if (record.recordType === "text") {
              const textDecoder = new TextDecoder();
              const text = textDecoder.decode(record.data);
              fullText += text + ' ';
            }
          } catch (decodeError) {
            console.error('Error decoding record:', decodeError);
          }
        }

        // Update state with read text
        setNfcMessage(fullText.trim());
        setReadingStatus('NFC tag read successfully');
      });

      // Handle errors during scanning
      ndef.addEventListener("error", (event) => {
        setReadingStatus(`Error: ${event.message}`);
      });

    } catch (error) {
      // Handle any errors in starting the scan
      setReadingStatus(`Scan failed: ${error.message}`);
      console.error('NFC scanning error:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-100">
      <div className="w-full max-w-md px-8 py-10 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">NFC Text Reader</h1>
        
        {/* NFC Scan Button */}
        {nfcSupported ? (
          <button 
            onClick={handleNFCScan}
            className="w-full py-3 mb-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
          >
            Scan NFC Tag
          </button>
        ) : (
          <div className="text-center text-red-600 mb-4">
            Web NFC is not supported in this browser
          </div>
        )}

        {/* Reading Status */}
        {readingStatus && (
          <div className={`mb-4 p-3 rounded-lg text-center ${
            readingStatus.includes('Error') || readingStatus.includes('not supported') 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {readingStatus}
          </div>
        )}

        {/* NFC Message Display */}
        {nfcMessage && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h2 className="text-lg font-semibold mb-2 text-gray-800">Read Message:</h2>
            <p className="text-gray-700 break-words">{nfcMessage}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>Hold an NFC tag near your device to read its text content.</p>
          <p className="mt-2">Ensure you're using a compatible browser and device.</p>
        </div>
      </div>
    </div>
  );
};

export default NFCTextReader;
