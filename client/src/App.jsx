import { useState, useEffect } from 'react'

function App() {
  const [message, setMessage] = useState('Loading...')
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    // Test connection to backend
    fetch('http://localhost:5000/')
      .then(res => res.json())
      .then(data => {
        setMessage(data.message)
        setStatus('connected')
      })
      .catch(err => {
        setMessage(`Cannot connect to backend ${err}`)
        setStatus('error')
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        {/* Logo/Title */}
        <h1 className="text-3xl font-bold text-primary-600 mb-2">
          📖 Quran Tracker
        </h1>
        <p className="text-gray-500 mb-6">
          Your Personal Hifz Companion
        </p>

        {/* Connection Status */}
        <div className={`p-4 rounded-lg ${
          status === 'connected' 
            ? 'bg-green-100 text-green-800' 
            : status === 'error'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          <p className="font-medium">
            {status === 'connected' && '✅ '}
            {status === 'error' && '❌ '}
            {status === 'checking' && '⏳ '}
            {message}
          </p>
        </div>

        {/* Status Indicators */}
        <div className="mt-6 space-y-2 text-left">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              status === 'connected' ? 'bg-green-500' : 'bg-gray-300'
            }`}></span>
            <span className="text-sm text-gray-600">Backend API</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              status === 'connected' ? 'bg-green-500' : 'bg-gray-300'
            }`}></span>
            <span className="text-sm text-gray-600">MongoDB Database</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-sm text-gray-600">React Frontend</span>
          </div>
        </div>

        {/* Next Steps */}
        {status === 'connected' && (
          <div className="mt-6 p-4 bg-primary-50 rounded-lg text-left">
            <p className="text-sm font-medium text-primary-800">
              🎉 Everything is working!
            </p>
            <p className="text-sm text-primary-600 mt-1">
              Ready to build authentication...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App