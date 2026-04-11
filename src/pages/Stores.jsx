import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

function getStoreDisplayName(store) {
  if (store.name) return store.name
  const url = store.url || ''
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url || 'Не указан'
  }
}

export default function Stores() {
  const [stores, setStores] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', categories: '' })
  const [editingStoreId, setEditingStoreId] = useState(null)

  const loadStores = () => {
    getDocs(collection(db, 'stores')).then((snapshot) => {
      setStores(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    })
  }

  useEffect(() => {
    loadStores()
  }, [])

  const onSubmit = async () => {
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      categories: form.categories.split(',').map((item) => item.trim()).filter(Boolean),
    }
    if (editingStoreId) {
      await updateDoc(doc(db, 'stores', editingStoreId), payload)
    } else {
      await addDoc(collection(db, 'stores'), payload)
    }
    setShowForm(false)
    setEditingStoreId(null)
    setForm({ name: '', url: '', categories: '' })
    loadStores()
  }

  const onEdit = (store) => {
    setEditingStoreId(store.id)
    setForm({
      name: store.name || '',
      url: store.url || '',
      categories: Array.isArray(store.categories) ? store.categories.join(', ') : (store.categories || ''),
    })
    setShowForm(true)
  }

  const onDelete = async (storeId) => {
    if (!window.confirm('Вы уверены?')) return
    await deleteDoc(doc(db, 'stores', storeId))
    loadStores()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <h1 style={{ fontSize:'28px', fontWeight:'800' }}>Магазины</h1>
        <button onClick={() => { setShowForm(!showForm); if (!showForm) setEditingStoreId(null) }} style={{ padding:'12px 24px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'12px', fontWeight:'700', cursor:'pointer' }}>
          + Добавить магазин
        </button>
      </div>
      {showForm && (
        <div style={{ backgroundColor:'#fff', borderRadius:'16px', padding:'24px', marginBottom:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'16px' }}>{editingStoreId ? 'Редактировать магазин' : 'Новый магазин'}</h2>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Название" style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid #eee', marginBottom:'12px' }} />
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="URL" style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid #eee', marginBottom:'12px' }} />
          <input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="Категории через запятую" style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid #eee', marginBottom:'12px' }} />
          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={onSubmit} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'none', background:'#111', color:'#fff', fontWeight:'700', cursor:'pointer' }}>
              Сохранить
            </button>
            <button onClick={() => { setShowForm(false); setEditingStoreId(null) }} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1px solid #eee', background:'#fff', color:'#666', fontWeight:'700', cursor:'pointer' }}>
              Отмена
            </button>
          </div>
        </div>
      )}
      <div style={{ backgroundColor:'#fff', borderRadius:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.06)', overflow:'hidden' }}>
        {stores.map(store => (
          <div key={store.id} style={{ display:'flex', alignItems:'center', gap:'16px', padding:'16px 24px', borderBottom:'1px solid #f5f5f5' }}>
            <span style={{ fontSize:'32px' }}>🏪</span>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:'600', fontSize:'14px' }}>{getStoreDisplayName(store)}</p>
              <p style={{ color:'#888', fontSize:'12px' }}>{store.url}</p>
              <p style={{ color:'#888', fontSize:'12px', marginTop:'4px' }}>
                {(Array.isArray(store.categories) ? store.categories : []).join(', ')}
              </p>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => onEdit(store)} style={{ border:'1px solid #eee', background:'#fff', borderRadius:'8px', width:'34px', height:'34px', cursor:'pointer' }} title="Редактировать">✏️</button>
              <button onClick={() => onDelete(store.id)} style={{ border:'1px solid #fee2e2', background:'#fff', borderRadius:'8px', width:'34px', height:'34px', cursor:'pointer' }} title="Удалить">🗑️</button>
            </div>
          </div>
        ))}
        {!stores.length && <p style={{ padding:'24px', color:'#888' }}>Пока нет магазинов</p>}
      </div>
    </div>
  )
}
