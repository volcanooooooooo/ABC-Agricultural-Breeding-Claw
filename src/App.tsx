import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
// import OntologyPage from './pages/OntologyPage'  // 本体功能已禁用
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          {/* 本体页面已禁用 */}
          {/* <Route path="/ontology" element={<OntologyPage />} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  )
}

export default function Root() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
