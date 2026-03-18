import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import { AuthProvider } from './context/AuthContext'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="*" element={<ChatPage />} />
      </Routes>
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
