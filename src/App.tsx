import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, defaultDarkModeOverride } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import WeatherWidget from './components/WeatherWidget'
import EmergencyAlerts from './components/EmergencyAlerts'
import MainTabs from './components/MainTabs'
import './App.css'

const theme = {
  name: 'my-theme',
  overrides: [defaultDarkModeOverride],
}

function App() {
  return (
    <Router>
      <ThemeProvider theme={theme}>
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}>
          {/* Weather Widget and Emergency Alerts at the top */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '0.5rem',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <WeatherWidget />
            <div style={{ marginTop: '0.5rem' }}>
              <EmergencyAlerts />
            </div>
          </div>

          {/* Main content with tabs */}
          <Routes>
            <Route path="/" element={<Navigate to="/events" replace />} />
            <Route path="/events" element={<MainTabs />} />
            <Route path="/housing" element={<MainTabs />} />
            <Route path="/forsale" element={<MainTabs />} />
            <Route path="/news" element={<MainTabs />} />
            <Route path="/politics" element={<MainTabs />} />
            <Route path="/social" element={<MainTabs />} />
            <Route path="/education" element={<MainTabs />} />
            <Route path="*" element={<Navigate to="/events" replace />} />
          </Routes>

          {/* Footer with support email */}
          <footer style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f3f4f6',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              Need help? Contact support at{' '}
              <a 
                href="mailto:john@johncorser.com"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                john@johncorser.com
              </a>
            </div>
          </footer>
      </div>
    </ThemeProvider>
    </Router>
  )
}

export default App
