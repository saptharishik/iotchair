import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import Login from './components/Auth/Login';
import SignUp from './components/Auth/SignUp';
import ChairSelection from './components/Dashboard/ChairSelection';
import ChairMonitor from './components/Dashboard/ChairMonitor';

// Private route wrapper
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          
          <Route path="/chair-selection" element={
            <PrivateRoute>
              <ChairSelection />
            </PrivateRoute>
          } />
          
          <Route path="/chair/:chairId" element={
            <PrivateRoute>
              <ChairMonitor />
            </PrivateRoute>
          } />
          
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
