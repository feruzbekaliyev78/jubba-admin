import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Analytics from './pages/Analytics'
import Stores from './pages/Stores'
import Settings from './pages/Settings'
import { isAuthenticated } from './adminAuth'

function App() {
  const isAuth = isAuthenticated()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isAuth ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="stores" element={<Stores />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
export default App
