import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '../firebase'

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

export default function Analytics() {
  const [clicks, setClicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(collection(db, 'clicks'))
      .then((snapshot) => setClicks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
      .finally(() => setLoading(false))
  }, [])

  const todayKey = dayKey(new Date())

  const stats = useMemo(() => {
    const byProduct = {}
    let todayClicks = 0

    clicks.forEach((item) => {
      const label = item.productTitle || item.productName || item.title || item.productId || 'Без названия'
      byProduct[label] = (byProduct[label] || 0) + 1
      const date = clickDate(item)
      if (date && dayKey(date) === todayKey) todayClicks += 1
    })

    return {
      todayClicks,
      totalClicks: clicks.length,
      topProducts: Object.entries(byProduct)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }
  }, [clicks, todayKey])

  const chartData = useMemo(() => {
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
      <h1 style={{ fontSize:'28px', fontWeight:'800', marginBottom:'24px' }}>Аналитика</h1>
      {loading ? <p>Загрузка...</p> : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px', marginBottom:'16px' }}>
            <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
              <p style={{ color:'#888', fontSize:'13px', marginBottom:'8px' }}>Клики за сегодня</p>
              <p style={{ fontSize:'32px', fontWeight:'800' }}>{stats.todayClicks}</p>
            </div>
            <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
              <p style={{ color:'#888', fontSize:'13px', marginBottom:'8px' }}>Клики за всё время</p>
              <p style={{ fontSize:'32px', fontWeight:'800' }}>{stats.totalClicks}</p>
            </div>
          </div>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'20px', marginBottom:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'12px' }}>Клики по дням (7 дней)</h2>
            <div style={{ width:'100%', height:260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="clicks" stroke="#111" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ background:'#fff', borderRadius:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9f9f9' }}>
                  <th style={{ padding:'14px 16px', textAlign:'left', fontSize:'13px', color:'#888', fontWeight:'600' }}>#</th>
                  <th style={{ padding:'14px 16px', textAlign:'left', fontSize:'13px', color:'#888', fontWeight:'600' }}>Товар</th>
                  <th style={{ padding:'14px 16px', textAlign:'left', fontSize:'13px', color:'#888', fontWeight:'600' }}>Клики</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((item, index) => (
                  <tr key={item.name} style={{ borderTop:'1px solid #f5f5f5' }}>
                    <td style={{ padding:'12px 16px' }}>{index + 1}</td>
                    <td style={{ padding:'12px 16px', fontWeight:'600' }}>{item.name}</td>
                    <td style={{ padding:'12px 16px' }}>{item.count}</td>
                  </tr>
                ))}
                {!stats.topProducts.length && (
                  <tr>
                    <td colSpan={3} style={{ padding:'16px', textAlign:'center', color:'#888' }}>Нет данных</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div>
      </div>
    </div>
  )
}
