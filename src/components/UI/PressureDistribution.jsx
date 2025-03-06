import React from 'react';
import { BarChart2 } from 'lucide-react';

const PressureDistribution = ({ sensorData }) => {
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
      return `rgba(79, 70, 229, ${Math.max(0.8, pressure / 100)})`;
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

  // For debugging
  console.log("Processed sensor data:", data);

  return (
    <div className="rounded-lg border border-gray-200 shadow-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <BarChart2 className="h-5 w-5 mr-2 text-indigo-600" />
          Pressure Distribution
        </h3>
      </div>

      {/* Content */}
      {data.state !== 'absent' ? (
        <div className="p-6">
          {/* Box-shaped visualization with pressure points */}
          <div className="w-full aspect-video bg-gray-50 border border-gray-200 rounded-md mb-6 relative">
            {/* Container for the box */}
            <div className="absolute inset-4 border-2 border-gray-300 rounded-md flex items-center justify-center">
              {/* Inner box with pressure points */}
              <div className="w-2/3 h-3/4 border-2 border-indigo-100 rounded bg-indigo-50 relative">
                {/* Thigh pressure points (top) */}
                {data.sensors.thighs?.map((sensor, index) => (
                  <div 
                    key={`thigh-${index}`}
                    className="absolute w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: getPressureColor(sensor.pressure),
                      top: '20%',
                      left: index === 0 ? '30%' : index === 1 ? '70%' : '50%',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <span className="text-xs font-bold text-white">{sensor.pressure}%</span>
                  </div>
                ))}
                
                {/* Pelvis pressure points (bottom) - positioned closer together */}
                {data.sensors.pelvis?.map((sensor, index) => (
                  <div 
                    key={`pelvis-${index}`}
                    className="absolute w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: getPressureColor(sensor.pressure),
                      bottom: '20%',
                      left: index === 0 ? '40%' : index === 1 ? '60%' : '50%',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <span className="text-xs font-bold text-white">{sensor.pressure}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Labels */}
            <div className="absolute right-4 top-6 flex flex-col items-start">
              <span className="text-sm font-medium text-gray-700 mb-1">Thigh</span>
            </div>
            <div className="absolute right-4 bottom-6 flex flex-col items-start">
              <span className="text-sm font-medium text-gray-700">Pelvis</span>
            </div>
          </div>
          
          {/* Pressure legend */}
          <div className="flex justify-between mb-6 px-2 bg-gray-50 py-2 rounded-md">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-red-500 mr-1 shadow-sm"></div>
              <span className="text-xs text-gray-600">Very Low</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-orange-500 mr-1 shadow-sm"></div>
              <span className="text-xs text-gray-600">Low</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-1 shadow-sm"></div>
              <span className="text-xs text-gray-600">Medium</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-indigo-600 mr-1 shadow-sm"></div>
              <span className="text-xs text-gray-600">High</span>
            </div>
          </div>
          
          {/* Pressure readings */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                <div className="w-2 h-4 bg-indigo-500 rounded-sm mr-2"></div>
                Thigh Pressure
              </h3>
              {data.sensors.thighs?.map((sensor, index) => (
                <div key={index} className="bg-gray-50 rounded-md p-3 border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-700">{sensor.position}</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">{sensor.pressure}%</span>
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        backgroundColor: getPressureColor(sensor.pressure),
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {getPressureDescription(sensor.pressure)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
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
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                <div className="w-2 h-4 bg-indigo-500 rounded-sm mr-2"></div>
                Pelvis Pressure
              </h3>
              {data.sensors.pelvis?.map((sensor, index) => (
                <div key={index} className="bg-gray-50 rounded-md p-3 border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-700">{sensor.position}</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">{sensor.pressure}%</span>
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        backgroundColor: getPressureColor(sensor.pressure),
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {getPressureDescription(sensor.pressure)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
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
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <BarChart2 className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No pressure data available</p>
          <p className="text-sm text-gray-400 mt-2">Chair is currently empty</p>
        </div>
      )}
    </div>
  );
};

export default PressureDistribution;