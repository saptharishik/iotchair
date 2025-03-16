import React from 'react';
import { BarChart2 } from 'lucide-react';

const PressureDistribution = ({ sensorData, darkMode }) => {
  // Function to transform the incoming data structure to the format used by the component
  const processData = (data) => {
    if (!data || !data.sensor_data) {
      // Default sensor data if not provided or in wrong format
      return {
        state: 'absent',
        sensors: {
          thighs: [
            { position: 'Left Thigh', active: true, pressure: 75 },
            { position: 'Right Thigh', active: true, pressure: 80 }
          ],
          pelvis: [
            { position: 'Left Pelvis', active: true, pressure: 45 },
            { position: 'Right Pelvis', active: true, pressure: 5 }
          ]
        }
      };
    }

    // Convert sensor values to numbers and calculate percentages
    const leftThigh = Number(data.sensor_data.left_thigh || 0);
    const rightThigh = Number(data.sensor_data.right_thigh || 0);
    const leftPelvis = Number(data.sensor_data.left_pelvis || 0);
    const rightPelvis = Number(data.sensor_data.right_pelvis || 0);

    // Extract data from the provided structure
    return {
      state: data.chairState || 'occupied',
      sensors: {
        thighs: [
          { position: 'Left Thigh', active: true, pressure: Math.round((leftThigh/4095)*100) },
          { position: 'Right Thigh', active: true, pressure: Math.round((rightThigh/4095)*100) }
        ],
        pelvis: [
          { position: 'Left Pelvis', active: true, pressure: Math.round((leftPelvis/4095)*100) },
          { position: 'Right Pelvis', active: true, pressure: Math.round((rightPelvis/4095)*100) }
        ]
      }
    };
  };

  // Process the incoming data
  const data = processData(sensorData);

  // Function to get color based on pressure level
  const getPressureColor = (pressure) => {
    if (pressure < 10) {
      // Very low pressure - red
      return `rgba(239, 68, 68, ${Math.max(0.5, pressure / 10)})`;
    } else if (pressure < 30) {
      // Low pressure - orange
      return `rgba(249, 115, 22, ${Math.max(0.6, pressure / 30)})`;
    } else if (pressure < 60) {
      // Medium pressure - green
      return `rgba(34, 197, 94, ${Math.max(0.7, pressure / 60)})`;
    } else {
      // High pressure - blue
      return `rgba(59, 130, 246, ${Math.max(0.8, pressure / 100)})`;
    }
  };

  // Function to get pressure description
  const getPressureDescription = (pressure) => {
    if (pressure < 10) return "Very Low";
    if (pressure < 30) return "Low";
    if (pressure < 60) return "Medium";
    if (pressure < 85) return "High";
    return "Very High";
  };

  // Function to get abbreviated pressure description for mobile
  const getShortPressureDescription = (pressure) => {
    if (pressure < 10) return "V.Low";
    if (pressure < 30) return "Low";
    if (pressure < 60) return "Med";
    if (pressure < 85) return "High";
    return "V.High";
  };

  return (
    <div className={`p-4 sm:p-6 rounded-lg shadow-md border transition-colors duration-300 ${
      darkMode 
        ? 'bg-gray-700 border-gray-600 text-gray-100' 
        : 'bg-white border-gray-200 text-gray-800'
    }`}>
      {/* Header */}
      <h2 className={`mb-4 sm:mb-5 text-lg font-semibold flex items-center ${
        darkMode ? 'text-gray-100' : 'text-gray-800'
      }`}>
        <BarChart2 className={`h-5 w-5 mr-2 ${
          darkMode ? 'text-blue-400' : 'text-blue-600'
        }`} />
        Pressure Distribution
      </h2>

      {/* Content */}
      {data.state !== 'absent' ? (
        <div>
          {/* Box-shaped visualization with pressure points */}
          <div className={`w-full h-56 sm:h-72 border rounded-lg mb-4 sm:mb-6 relative shadow-inner ${
            darkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            {/* Container for the box */}
            <div className={`absolute inset-2 sm:inset-4 border-2 rounded-lg flex items-center justify-center ${
              darkMode ? 'border-gray-600' : 'border-gray-300'
            }`}>
              {/* Inner box with pressure points */}
              <div className={`w-2/3 h-3/4 border-2 rounded-lg relative ${
                darkMode
                  ? 'border-blue-800 bg-blue-900 bg-opacity-20'
                  : 'border-blue-100 bg-blue-50'
              }`}>
                {/* Thigh pressure points (top) */}
                {data.sensors.thighs?.map((sensor, index) => (
                  <div 
                    key={`thigh-${index}`}
                    className="absolute w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: getPressureColor(sensor.pressure),
                      top: '20%',
                      left: index === 0 ? '30%' : index === 1 ? '70%' : '50%',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: darkMode 
                        ? '0 0 12px rgba(0,0,0,0.4)' 
                        : '0 0 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <span className="text-xs sm:text-sm font-bold text-white">{sensor.pressure}%</span>
                  </div>
                ))}
                
                {/* Pelvis pressure points (bottom) - positioned closer together */}
                {data.sensors.pelvis?.map((sensor, index) => (
                  <div 
                    key={`pelvis-${index}`}
                    className="absolute w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: getPressureColor(sensor.pressure),
                      bottom: '20%',
                      left: index === 0 ? '40%' : index === 1 ? '60%' : '50%',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: darkMode 
                        ? '0 0 12px rgba(0,0,0,0.4)' 
                        : '0 0 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <span className="text-xs sm:text-sm font-bold text-white">{sensor.pressure}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Labels */}
            <div className="absolute right-2 sm:right-4 top-4 sm:top-6 flex flex-col items-start">
              <span className={`text-xs sm:text-sm font-medium ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Thigh</span>
            </div>
            <div className="absolute right-2 sm:right-4 bottom-4 sm:bottom-6 flex flex-col items-start">
              <span className={`text-xs sm:text-sm font-medium ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Pelvis</span>
            </div>
          </div>
          
          {/* Pressure legend - Mobile version (2x2 grid) for small screens, horizontal for larger */}
          <div className={`grid grid-cols-2 sm:flex sm:flex-row sm:justify-between mb-4 sm:mb-6 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border shadow-sm ${
            darkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center mb-2 sm:mb-0">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-500 mr-1 sm:mr-2 shadow-sm"></div>
              <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                V.Low
              </span>
            </div>
            <div className="flex items-center mb-2 sm:mb-0">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500 mr-1 sm:mr-2 shadow-sm"></div>
              <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Low
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500 mr-1 sm:mr-2 shadow-sm"></div>
              <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Medium
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-600 mr-1 sm:mr-2 shadow-sm"></div>
              <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                High
              </span>
            </div>
          </div>
          
          {/* Pressure readings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3 sm:space-y-4">
              <h3 className={`text-sm sm:text-base font-medium flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
              }`}>
                <div className={`w-1.5 sm:w-2 h-4 sm:h-5 rounded-sm mr-2 ${
                  darkMode ? 'bg-blue-500' : 'bg-blue-600'
                }`}></div>
                Thigh Pressure
              </h3>
              {data.sensors.thighs?.map((sensor, index) => (
                <div key={index} className={`rounded-lg p-3 sm:p-4 border shadow-sm hover:shadow-md transition-shadow duration-200 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex justify-between mb-2 sm:mb-3">
                    <span className={`text-xs sm:text-sm font-medium ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>{sensor.position}</span>
                    <div className="flex items-center">
                      <span className={`text-xs sm:text-sm font-medium mr-1 sm:mr-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>{sensor.pressure}%</span>
                      <span className="text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full" style={{
                        backgroundColor: getPressureColor(sensor.pressure),
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        <span className="hidden sm:inline">{getPressureDescription(sensor.pressure)}</span>
                        <span className="sm:hidden">{getShortPressureDescription(sensor.pressure)}</span>
                      </span>
                    </div>
                  </div>
                  <div className={`w-full h-3 sm:h-4 rounded-full overflow-hidden ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${Math.max(5, sensor.pressure)}%`, // Ensure low values are still visible
                        backgroundColor: getPressureColor(sensor.pressure)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <h3 className={`text-sm sm:text-base font-medium flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
              }`}>
                <div className={`w-1.5 sm:w-2 h-4 sm:h-5 rounded-sm mr-2 ${
                  darkMode ? 'bg-blue-500' : 'bg-blue-600'
                }`}></div>
                Pelvis Pressure
              </h3>
              {data.sensors.pelvis?.map((sensor, index) => (
                <div key={index} className={`rounded-lg p-3 sm:p-4 border shadow-sm hover:shadow-md transition-shadow duration-200 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex justify-between mb-2 sm:mb-3">
                    <span className={`text-xs sm:text-sm font-medium ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>{sensor.position}</span>
                    <div className="flex items-center">
                      <span className={`text-xs sm:text-sm font-medium mr-1 sm:mr-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>{sensor.pressure}%</span>
                      <span className="text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full" style={{
                        backgroundColor: getPressureColor(sensor.pressure),
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        <span className="hidden sm:inline">{getPressureDescription(sensor.pressure)}</span>
                        <span className="sm:hidden">{getShortPressureDescription(sensor.pressure)}</span>
                      </span>
                    </div>
                  </div>
                  <div className={`w-full h-3 sm:h-4 rounded-full overflow-hidden ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${Math.max(5, sensor.pressure)}%`, // Ensure low values are still visible
                        backgroundColor: getPressureColor(sensor.pressure)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-6 sm:p-8 text-center rounded-lg border ${
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center shadow-inner ${
            darkMode ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            <BarChart2 className={`h-8 w-8 sm:h-10 sm:w-10 ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
          </div>
          <p className={`text-sm sm:text-base font-medium ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>No pressure data available</p>
          <p className={`text-xs sm:text-sm mt-1 sm:mt-2 ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>Chair is currently empty</p>
        </div>
      )}
    </div>
  );
};

export default PressureDistribution;