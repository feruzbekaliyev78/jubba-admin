import { useEffect, useState, useRef } from 'react'
import API from '../api'
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { deleteAllFilesInProductsBucket, supabase } from '../supabase'

function productActive(p) {
  return p.active !== undefined ? p.active : p.isActive
}

const CATEGORY_OPTIONS = [
  { value: 'clothing', label: 'Одежда' },
  { value: 'shoes', label: 'Обувь' },
  { value: 'accessories', label: 'Аксессуары' },
  { value: 'jewelry', label: 'Украшения' },
  { value: 'bags', label: 'Сумки' },
  { value: 'perfume', label: 'Парфюм' },
]

function splitTags(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

const emptyForm = () => ({
  title: '',
  price: '',
  category: 'clothing',
  description: '',
  sizesStr: '',
  colorsStr: '',
  inStock: true,
  shopContact: '',
})

export default function Products() {
  const [products, setProducts] = useState([])
  /** id -> { title, price } for inline inputs */
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [image, setImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  /** { type: 'ok' | 'err', text: string } | null */
  const [notice, setNotice] = useState(null)
  /** Full-size photo URL for lightbox, or null */
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState(null)
  const [deletingAll, setDeletingAll] = useState(false)
  /** Edit modal: product id being edited */
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [savingEdit, setSavingEdit] = useState(false)
  const fileRef = useRef()

  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { title: '', price: '' }), [field]: value },
    }))
  }

  const load = () => {
    setLoading(true)
    getDocs(collection(db, 'products'))
      .then((snapshot) => {
        const list = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        setProducts(list)
        setDrafts(
          Object.fromEntries(
            list.map((p) => [
              p.id,
              {
                title: p.title ?? '',
                price: p.price != null && p.price !== '' ? String(p.price) : '',
              },
            ])
          )
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2800)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (!zoomPhotoUrl) return
    const onKey = (e) => {
      if (e.key === 'Escape') setZoomPhotoUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomPhotoUrl])

  const openEdit = (p) => {
    setEditingId(p.id)
    setEditForm({
      title: p.title ?? '',
      price: p.price != null ? String(p.price) : '',
      category: p.category && CATEGORY_OPTIONS.some((c) => c.value === p.category) ? p.category : 'clothing',
      description: p.description ?? '',
      sizesStr: Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
      colorsStr: Array.isArray(p.colors) ? p.colors.join(', ') : '',
      inStock: p.inStock !== false,
      shopContact: p.shopContact ?? p.sourceUrl ?? '',
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      const sizes = splitTags(editForm.sizesStr)
      const colors = splitTags(editForm.colorsStr)
      const shop = editForm.shopContact.trim() || null
      await updateDoc(doc(db, 'products', editingId), {
        title: editForm.title.trim(),
        price: Number(editForm.price) || 0,
        category: editForm.category,
        description: editForm.description.trim() || null,
        sizes,
        colors,
        inStock: editForm.inStock,
        shopContact: shop,
        sourceUrl: shop,
      })
      setNotice({ type: 'ok', text: 'Сохранено' })
      setEditingId(null)
      load()
    } catch (e) {
      alert('Ошибка: ' + e.message)
    }
    setSavingEdit(false)
  }

  const toggleProductActive = async (p) => {
    try {
      const newActive = !productActive(p)
      const d = drafts[p.id]
      const payload = { active: newActive, isActive: newActive }
      if (d) {
        if (d.title != null && String(d.title).trim() !== '') payload.title = String(d.title).trim()
        if (d.price !== undefined && d.price !== '') payload.price = Number(d.price) || 0
      }
      await updateDoc(doc(db, 'products', p.id), payload)
      await load()
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('price', form.price)
      fd.append('category', form.category)
      fd.append('description', form.description)
      fd.append('sizes', form.sizesStr)
      fd.append('colors', form.colorsStr)
      fd.append('inStock', form.inStock ? 'true' : 'false')
      fd.append('shopContact', form.shopContact)
      if (image) fd.append('image', image)
      const res = await API.post('/api/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data?.id) {
        await updateDoc(doc(db, 'products', res.data.id), { active: false })
      }
      setShowForm(false)
      setForm(emptyForm())
      setImage(null)
      load()
    } catch (e) {
      alert('Ошибка: ' + (e.response?.data?.error || e.message))
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены?')) return
    try {
      await deleteDoc(doc(db, 'products', id))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      alert(`Ошибка удаления: ${error.message}`)
    }
  }

  const handleDeleteAllProducts = async () => {
    if (!window.confirm('Вы уверены? Это удалит ВСЕ товары безвозвратно!')) return
    setDeletingAll(true)
    try {
      const snapshot = await getDocs(collection(db, 'products'))
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref)
      }
      setZoomPhotoUrl(null)
      if (supabase) {
        await deleteAllFilesInProductsBucket()
      }
      setNotice({ type: 'ok', text: 'Все товары удалены' })
      load()
    } catch (error) {
      setNotice({ type: 'err', text: error.message })
    } finally {
      setDeletingAll(false)
    }
  }

  const filteredProducts = products.filter((product) => {
    const bySearch = (product.title || '').toLowerCase().includes(search.toLowerCase())
    const byCategory = categoryFilter === 'all' || product.category === categoryFilter
    return bySearch && byCategory
  })

  const categories = ['all', ...new Set(products.map((item) => item.category).filter(Boolean))]
  const tagChipStyle = {
    display: 'inline-block',
    fontSize: '12px',
    padding: '4px 10px',
    margin: '4px 4px 0 0',
    borderRadius: '999px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    fontWeight: 600,
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #eee',
    fontSize: '14px',
    marginBottom: '12px',
    boxSizing: 'border-box',
  }

  const rowInputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #e5e5e5',
    fontSize: '14px',
    boxSizing: 'border-box',
  }

  const labelStyle = { fontSize: '13px', fontWeight: 600, color: '#444', marginBottom: '6px', display: 'block' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800' }}>Товары</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleDeleteAllProducts}
            disabled={deletingAll}
            style={{
              padding: '12px 24px',
              backgroundColor: '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '700',
              cursor: deletingAll ? 'not-allowed' : 'pointer',
              opacity: deletingAll ? 0.7 : 1,
            }}
          >
            🗑 Удалить все товары
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            + Добавить товар
          </button>
        </div>
      </div>

      {notice && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: notice.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
            color: notice.type === 'ok' ? '#047857' : '#B91C1C',
            border: notice.type === 'ok' ? '1px solid #A7F3D0' : '1px solid #FECACA',
          }}
        >
          {notice.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <input
          style={{ ...inputStyle, marginBottom: 0 }}
          placeholder="Поиск по названию товара"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, marginBottom: 0 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === 'all' ? 'Все категории' : category}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Новый товар</h2>
          <input style={inputStyle} placeholder="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input style={inputStyle} placeholder="Цена (сум)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <label style={labelStyle}>Категория</label>
          <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label style={labelStyle}>Описание</label>
          <textarea
            style={{ ...inputStyle, minHeight: '88px', resize: 'vertical' }}
            placeholder="Описание для карточки товара"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label style={labelStyle}>Размеры (через запятую)</label>
          <input
            style={inputStyle}
            placeholder="S, M, L, XL или 39, 40, 41"
            value={form.sizesStr}
            onChange={(e) => setForm({ ...form, sizesStr: e.target.value })}
          />
          <div style={{ marginTop: '-8px', marginBottom: '12px' }}>
            {splitTags(form.sizesStr).map((t, i) => (
              <span key={`${t}-${i}`} style={tagChipStyle}>
                {t}
              </span>
            ))}
          </div>
          <label style={labelStyle}>Цвета (через запятую)</label>
          <input
            style={inputStyle}
            placeholder="Чёрный, Белый, Красный"
            value={form.colorsStr}
            onChange={(e) => setForm({ ...form, colorsStr: e.target.value })}
          />
          <div style={{ marginTop: '-8px', marginBottom: '12px' }}>
            {splitTags(form.colorsStr).map((t, i) => (
              <span key={`${t}-${i}`} style={tagChipStyle}>
                {t}
              </span>
            ))}
          </div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            В наличии
          </label>
          <input
            style={inputStyle}
            placeholder="Контакт магазина (Instagram / Telegram)"
            value={form.shopContact}
            onChange={(e) => setForm({ ...form, shopContact: e.target.value })}
          />
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => fileRef.current.click()}
              style={{
                padding: '10px 20px',
                border: '2px dashed #eee',
                borderRadius: '10px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                fontSize: '14px',
                color: '#888',
              }}
            >
              {image ? `📷 ${image.name}` : '📷 Загрузить фото'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setImage(e.target.files[0])} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{ flex: 1, padding: '14px', backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '14px', backgroundColor: 'transparent', border: '1px solid #eee', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9f9f9' }}>
                {['Фото', 'Название', 'Цена', 'Статус', 'Действия'].map((h) => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', color: '#888', fontWeight: '600' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const d = drafts[p.id] ?? { title: p.title ?? '', price: p.price != null ? String(p.price) : '' }
                const active = productActive(p)
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      {p.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => setZoomPhotoUrl(p.imageUrl)}
                          style={{
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'zoom-in',
                            borderRadius: 8,
                            display: 'block',
                          }}
                          title="Увеличить"
                        >
                          <img src={p.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                        </button>
                      ) : (
                        <span style={{ fontSize: 32 }}>{p.category === 'clothing' ? '👗' : '👟'}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: '180px', verticalAlign: 'middle' }}>
                      <input
                        type="text"
                        value={d.title}
                        onChange={(e) => updateDraft(p.id, 'title', e.target.value)}
                        style={rowInputStyle}
                        placeholder="Название"
                      />
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: '120px', verticalAlign: 'middle' }}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={d.price}
                        onChange={(e) => updateDraft(p.id, 'price', e.target.value)}
                        style={{ ...rowInputStyle, maxWidth: '140px' }}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '12px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontWeight: '600',
                          backgroundColor: active ? '#DCFCE7' : '#F3F4F6',
                          color: active ? '#15803D' : '#6B7280',
                        }}
                      >
                        {active ? 'Опубликован' : 'Черновик'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: '1px solid #e5e5e5',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginRight: '8px',
                          backgroundColor: '#fff',
                        }}
                      >
                        ✏️ Карточка
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProductActive(p)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginRight: '8px',
                          backgroundColor: active ? '#DC2626' : '#22C55E',
                          color: '#fff',
                        }}
                      >
                        {active ? 'Скрыть' : 'Опубликовать'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #fecaca',
                          background: '#fff',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                        }}
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!filteredProducts.length && (
                <tr>
                  <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#888' }}>
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingId && (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => setEditingId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Карточка товара</h2>
            <input style={inputStyle} placeholder="Название" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            <input style={inputStyle} placeholder="Цена (сум)" type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
            <label style={labelStyle}>Категория</label>
            <select style={inputStyle} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label style={labelStyle}>Описание</label>
            <textarea
              style={{ ...inputStyle, minHeight: '88px', resize: 'vertical' }}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <label style={labelStyle}>Размеры</label>
            <input
              style={inputStyle}
              placeholder="S, M, L"
              value={editForm.sizesStr}
              onChange={(e) => setEditForm({ ...editForm, sizesStr: e.target.value })}
            />
            <div style={{ marginTop: '-8px', marginBottom: '12px' }}>
              {splitTags(editForm.sizesStr).map((t, i) => (
                <span key={`${t}-${i}`} style={tagChipStyle}>
                  {t}
                </span>
              ))}
            </div>
            <label style={labelStyle}>Цвета</label>
            <input
              style={inputStyle}
              value={editForm.colorsStr}
              onChange={(e) => setEditForm({ ...editForm, colorsStr: e.target.value })}
            />
            <div style={{ marginTop: '-8px', marginBottom: '12px' }}>
              {splitTags(editForm.colorsStr).map((t, i) => (
                <span key={`${t}-${i}`} style={tagChipStyle}>
                  {t}
                </span>
              ))}
            </div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editForm.inStock}
                onChange={(e) => setEditForm({ ...editForm, inStock: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              В наличии
            </label>
            <input
              style={inputStyle}
              placeholder="Контакт магазина"
              value={editForm.shopContact}
              onChange={(e) => setEditForm({ ...editForm, shopContact: e.target.value })}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: 8 }}>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                style={{ flex: 1, padding: '14px', backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {savingEdit ? 'Сохранение...' : 'Сохранить в Firestore'}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ flex: 1, padding: '14px', backgroundColor: 'transparent', border: '1px solid #eee', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomPhotoUrl && (
        <div
          role="presentation"
          onClick={() => setZoomPhotoUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <img
            src={zoomPhotoUrl}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: '80vh',
              maxWidth: '80vw',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
            }}
          />
        </div>
      )}
    </div>
  )
}
