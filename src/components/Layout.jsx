import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearAdminSession } from '../adminAuth'
export default function Layout() {
  const navigate = useNavigate()
  const logout = () => { clearAdminSession(); navigate('/login') }
  const navStyle = ({ isActive }) => ({
    display:'block', padding:'12px 16px', borderRadius:'10px', textDecoration:'none',
    fontWeight:'600', fontSize:'14px', color: isActive ? '#fff' : '#666',
    backgroundColor: isActive ? '#111' : 'transparent', marginBottom:'4px'
  })
  return (
    <div style={{ display:'flex', minHeight:'100vh', backgroundColor:'#f5f5f5' }}>
      <div style={{ width:'220px', backgroundColor:'#fff', padding:'24px 16px', borderRight:'1px solid #eee', display:'flex', flexDirection:'column' }}>
        <h2 style={{ fontSize:'22px', fontWeight:'800', marginBottom:'32px', paddingLeft:'16px' }}>JUBBA</h2>
        <NavLink to="/" end style={navStyle}>📊 Dashboard</NavLink>
        <NavLink to="/products" style={navStyle}>👕 Товары</NavLink>
        <NavLink to="/analytics" style={navStyle}>📈 Аналитика</NavLink>
        <NavLink to="/stores" style={navStyle}>🏪 Магазины</NavLink>
        <NavLink to="/settings" style={navStyle}>⚙️ Настройки</NavLink>
        <div style={{ marginTop:'auto' }}>
          <button onClick={logout} style={{ width:'100%', padding:'10px', border:'1px solid #eee', borderRadius:'10px', cursor:'pointer', fontSize:'14px', color:'#666', backgroundColor:'transparent' }}>
            Выйти
          </button>
        </div>
      </div>
      <div style={{ flex:1, padding:'32px', overflowY:'auto' }}>
        <Outlet />
      </div>
    </div>
  )
}
