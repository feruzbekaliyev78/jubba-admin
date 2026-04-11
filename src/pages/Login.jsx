import { useState } from 'react'
import { getAdminCredentials, setAdminSession } from '../adminAuth'

export default function Login() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    const credentials = getAdminCredentials()
    if (login === credentials.login && password === credentials.password) {
      setAdminSession(login)
      window.location.href = '/'
    } else {
      setError('Неверный логин или пароль')
    }
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', backgroundColor:'#f5f5f5' }}>
      <div style={{ backgroundColor:'#fff', padding:'40px', borderRadius:'16px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', width:'320px' }}>
        <h1 style={{ fontSize:'28px', fontWeight:'800', marginBottom:'8px' }}>JUBBA</h1>
        <p style={{ color:'#888', marginBottom:'24px' }}>Панель управления</p>
        <input
          type="text"
          placeholder="Логин"
          value={login}
          onChange={e => setLogin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #eee', fontSize:'16px', marginBottom:'12px', boxSizing:'border-box' }}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #eee', fontSize:'16px', marginBottom:'12px', boxSizing:'border-box' }}
        />
        {error && <p style={{ color:'red', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}
        <button onClick={handleLogin} style={{ width:'100%', padding:'14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'10px', fontSize:'16px', fontWeight:'700', cursor:'pointer' }}>
          Войти
        </button>
      </div>
    </div>
  )
}
