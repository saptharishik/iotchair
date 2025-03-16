import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  
  // Check if dark mode preference is stored in localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password);
      navigate('/chair-selection');
    } catch (error) {
      setError('Failed to create an account: ' + error.message);
    } finally {
      setLoading(false);
    }
  }
  
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  }

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
      
      <div className={`w-full max-w-md px-8 pt-20 pb-10 mx-4 rounded-xl shadow-2xl relative transition-all duration-300 hover:shadow-xl backdrop-blur-sm border ${
        darkMode 
          ? 'bg-gray-900 bg-opacity-90 border-gray-800 text-gray-100' 
          : 'bg-white bg-opacity-95 border-gray-100 text-gray-800'
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
        
        {/* Floating Logo - positioned to overlap the top edge of the card */}
        <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 transition-transform duration-300 hover:scale-105">
          <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v6m0 12v2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
            </svg>
          </div>
        </div>
        
        {/* Form Title */}
        <div className="text-center mb-8 mt-4">
          <h1 className={`text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${
            darkMode
              ? 'from-blue-400 to-indigo-300'
              : 'from-blue-600 to-indigo-600'
          }`}>THRONE</h1>
          <p className={`mt-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Create your Sedentary Monitor account
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={`p-4 border-l-4 border-red-500 rounded-lg animate-fadeIn ${
              darkMode ? 'bg-red-900 bg-opacity-30 text-red-300' : 'bg-red-50 text-red-700'
            }`}>
              <div className="flex">
                <svg className={`h-5 w-5 mr-2 ${darkMode ? 'text-red-400' : 'text-red-500'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}
          
          <div className="group">
            <label htmlFor="email" className={`block text-sm font-medium mb-1 ml-1 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Email</label>
            <div className="relative transition-all duration-300 group-hover:shadow-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className={`w-5 h-5 transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-500 group-hover:text-blue-400' 
                    : 'text-gray-400 group-hover:text-blue-500'
                }`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                className={`w-full pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-blue-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-blue-500'
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="group">
            <label htmlFor="password" className={`block text-sm font-medium mb-1 ml-1 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Password</label>
            <div className="relative transition-all duration-300 group-hover:shadow-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className={`w-5 h-5 transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-500 group-hover:text-blue-400' 
                    : 'text-gray-400 group-hover:text-blue-500'
                }`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-blue-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-blue-500'
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <p className={`mt-1 text-xs ml-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Must be at least 8 characters
            </p>
          </div>
          
          <div className="group">
            <label htmlFor="confirm-password" className={`block text-sm font-medium mb-1 ml-1 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Confirm Password</label>
            <div className="relative transition-all duration-300 group-hover:shadow-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className={`w-5 h-5 transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-500 group-hover:text-blue-400' 
                    : 'text-gray-400 group-hover:text-blue-500'
                }`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-blue-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-blue-500'
                }`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 text-white rounded-lg transition duration-300 ease-in-out uppercase font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                darkMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </div>
              ) : 'Sign Up'}
            </button>
          </div>
          
          <div className="text-center pt-2">
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              By signing up, you agree to our{' '}
              <a href="#" className={`hover:underline ${
                darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
              }`}>Terms of Service</a>{' '}
              and{' '}
              <a href="#" className={`hover:underline ${
                darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
              }`}>Privacy Policy</a>
            </p>
          </div>
        </form>
        
        {/* Login link */}
        <div className="mt-8 text-center">
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Already have an account?{' '}
            <Link to="/login" className={`font-medium hover:underline transition-all duration-200 ${
              darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
            }`}>
              Sign in
            </Link>
          </p>
        </div>
        
        {/* Footer */}
        <div className={`mt-8 pt-4 text-center text-xs ${
          darkMode
            ? 'border-t border-gray-800 text-gray-500'
            : 'border-t border-gray-100 text-gray-500'
        }`}>
          © 2025 THRONE. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default SignUp;