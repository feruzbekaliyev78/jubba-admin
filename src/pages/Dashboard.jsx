import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '../firebase'

const cardStyle = { backgroundColor:'#fff', borderRadius:'16px', padding:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }

function toDateSafe(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function clickDate(item) {
  return toDateSafe(item.createdAt || item.timestamp || item.clickedAt || item.date)
}

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [clicks, setClicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(collection(db, 'clicks'))
      .then((clickSnapshot) => {
        setClicks(clickSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      })
      .finally(() => setLoading(false))
  }, [])

  const todayKey = dayKey(new Date())

  const clickStats = useMemo(() => {
    let todayClicks = 0
    let todayLikes = 0
    const users = new Set()
    const byProduct = {}
    const byStore = {}

    clicks.forEach((item) => {
      const date = clickDate(item)
      if (date && dayKey(date) === todayKey) {
        todayClicks += 1
        if (item.isLike || item.liked || item.eventType === 'like') todayLikes += 1
      }
      if (item.userId || item.uid || item.user || item.clientId) {
        users.add(item.userId || item.uid || item.user || item.clientId)
      }

      const productLabel = item.productTitle || item.productName || item.title || item.productId || 'Без названия'
      byProduct[productLabel] = (byProduct[productLabel] || 0) + 1

      const storeLabel = item.storeName || item.shopName || item.sourceUrl || item.storeUrl || 'Не указан'
      byStore[storeLabel] = (byStore[storeLabel] || 0) + 1
    })

    return {
      todayClicks,
      todayLikes,
      totalUsers: users.size,
      topProducts: Object.entries(byProduct)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topStore: Object.entries(byStore)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)[0],
    }
  }, [clicks, todayKey])

  const weekChartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = dayKey(date)
      days.push({ key, day: date.toLocaleDateString('ru-RU', { weekday: 'short' }), clicks: 0 })
    }
    const map = Object.fromEntries(days.map((d) => [d.key, d]))
    clicks.forEach((item) => {
      const date = clickDate(item)
      if (!date) return
      const key = dayKey(date)
      if (map[key]) map[key].clicks += 1
    })
    return days
  }, [clicks])

  return (
    <div>
      <h1 style={{ fontSize:'28px', fontWeight:'800', marginBottom:'24px' }}>Dashboard</h1>
      {loading ? <p>Загрузка...</p> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'16px', marginBottom:'24px' }}>
          {[
            { label:'Сегодня кликов', value: clickStats.todayClicks, color:'#111' },
            { label:'Сегодня лайков', value: clickStats.todayLikes, color:'#E11D48' },
            { label:'Всего пользователей', value: clickStats.totalUsers, color:'#4A90E2' },
            { label:'Популярный магазин', value: clickStats.topStore?.name || 'Нет данных', color:'#1E9E55' },
          ].map(card => (
            <div key={card.label} style={cardStyle}>
              <p style={{ color:'#888', fontSize:'13px', marginBottom:'8px' }}>{card.label}</p>
              <p style={{ fontSize:'28px', fontWeight:'800', color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px' }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'16px' }}>Активность за 7 дней</h2>
          <div style={{ width:'100%', height:260 }}>
            <ResponsiveContainer>
              <LineChart data={weekChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="clicks" stroke="#111" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={cardStyle}>
          <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'16px' }}>Топ 5 товаров</h2>
          {clickStats.topProducts.length === 0 && <p style={{ color:'#888' }}>Нет данных</p>}
          {clickStats.topProducts.map((item, index) => (
            <div key={item.name} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f5f5f5' }}>
              <p style={{ fontSize:'14px', fontWeight:'600' }}>{index + 1}. {item.name}</p>
              <p style={{ fontSize:'14px', color:'#666' }}>{item.count}</p>
            </div>
          ))}
          {clickStats.topStore && (
            <div style={{ marginTop:'14px', backgroundColor:'#f9f9f9', borderRadius:'10px', padding:'10px 12px' }}>
              <p style={{ fontSize:'12px', color:'#888' }}>Самый популярный магазин</p>
              <p style={{ fontWeight:'700', marginTop:'4px' }}>{clickStats.topStore.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
