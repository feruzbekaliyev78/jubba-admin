import { useEffect, useState } from 'react'
import { addDoc, collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { getAdminCredentials, setAdminCredentials, setAdminSession } from '../adminAuth'

const inputStyle = { width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid #eee', fontSize:'14px', marginBottom:'12px', boxSizing:'border-box' }
const cardStyle = { backgroundColor:'#fff', borderRadius:'16px', padding:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)', marginBottom:'16px' }

export default function Settings() {
  const credentials = getAdminCredentials()
  const [loginForm, setLoginForm] = useState({ login: credentials.login })
  const [passwordForm, setPasswordForm] = useState({ password: credentials.password })
  const [products, setProducts] = useState([])
  const [channels, setChannels] = useState([])
  const [channelInput, setChannelInput] = useState('')

  useEffect(() => {
    Promise.all([getDocs(collection(db, 'products')), getDocs(collection(db, 'parserChannels'))]).then(([productsSnapshot, channelsSnapshot]) => {
      setProducts(productsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      setChannels(channelsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    })
  }, [])

  const fitRoomPending = products.filter((item) => item.category === 'clothing' && (item.fitRoomStatus || 'pending') === 'pending')
  const tripoPending = products.filter((item) => item.category !== 'clothing' && (item.model3dStatus || 'pending') === 'pending')

  const saveLogin = () => {
    const next = { ...getAdminCredentials(), login: loginForm.login.trim() }
    setAdminCredentials(next)
    setAdminSession(next.login)
    alert('Логин обновлён')
  }

  const savePassword = () => {
    const next = { ...getAdminCredentials(), password: passwordForm.password }
    setAdminCredentials(next)
    alert('Пароль обновлён')
  }

  const restartTripo = async (productId) => {
    await updateDoc(doc(db, 'products', productId), { model3dStatus: 'pending' })
    const snapshot = await getDocs(collection(db, 'products'))
    setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }

  const addChannel = async () => {
    if (!channelInput.trim()) return
    const channelDoc = await addDoc(collection(db, 'parserChannels'), { channel: channelInput.trim() })
    setChannels([...channels, { id: channelDoc.id, channel: channelInput.trim() }])
    setChannelInput('')
  }

  return (
    <div>
      <h1 style={{ fontSize:'28px', fontWeight:'800', marginBottom:'24px' }}>Настройки</h1>

      <div style={cardStyle}>
        <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'12px' }}>Изменить логин администратора</h2>
        <input style={inputStyle} value={loginForm.login} onChange={(e) => setLoginForm({ login: e.target.value })} placeholder="Новый логин" />
        <button onClick={saveLogin} style={{ padding:'12px 18px', border:'none', borderRadius:'10px', background:'#111', color:'#fff', fontWeight:'700', cursor:'pointer' }}>Сохранить логин</button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'12px' }}>Изменить пароль администратора</h2>
        <input style={inputStyle} type="password" value={passwordForm.password} onChange={(e) => setPasswordForm({ password: e.target.value })} placeholder="Новый пароль" />
        <button onClick={savePassword} style={{ padding:'12px 18px', border:'none', borderRadius:'10px', background:'#111', color:'#fff', fontWeight:'700', cursor:'pointer' }}>Сохранить пароль</button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'12px' }}>FitRoom</h2>
        {fitRoomPending.length === 0 && <p style={{ color:'#888' }}>Нет pending товаров</p>}
        {fitRoomPending.map((item) => (
          <div key={item.id} style={{ borderTop:'1px solid #f5f5f5', padding:'10px 0' }}>
            <p style={{ fontWeight:'600' }}>{item.title}</p>
            <p style={{ fontSize:'12px', color:'#888' }}>Статус: {item.fitRoomStatus || 'pending'}</p>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'12px' }}>Tripo3D</h2>
        {tripoPending.length === 0 && <p style={{ color:'#888' }}>Нет pending товаров</p>}
        {tripoPending.map((item) => (
          <div key={item.id} style={{ borderTop:'1px solid #f5f5f5', padding:'10px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <p style={{ fontWeight:'600' }}>{item.title}</p>
              <p style={{ fontSize:'12px', color:'#888' }}>Статус: {item.model3dStatus || 'pending'}</p>
            </div>
            <button onClick={() => restartTripo(item.id)} style={{ padding:'8px 12px', border:'1px solid #eee', background:'#fff', borderRadius:'8px', cursor:'pointer' }}>
              Перезапустить
            </button>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'12px' }}>Парсер</h2>
        <div style={{ display:'flex', gap:'10px', marginBottom:'12px' }}>
          <input style={{ ...inputStyle, marginBottom:0 }} value={channelInput} onChange={(e) => setChannelInput(e.target.value)} placeholder="Добавить Telegram канал" />
          <button onClick={addChannel} style={{ padding:'10px 14px', border:'none', borderRadius:'10px', background:'#111', color:'#fff', fontWeight:'700', cursor:'pointer' }}>Добавить</button>
        </div>
        {channels.map((item) => (
          <div key={item.id} style={{ borderTop:'1px solid #f5f5f5', padding:'10px 0' }}>
            {item.channel}
          </div>
        ))}
      </div>
    </div>
  )
}
