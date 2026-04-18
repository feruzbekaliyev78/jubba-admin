import { useEffect, useState, useRef } from 'react'
import API from '../api'
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { deleteAllFilesInProductsBucket, SUPABASE_PRODUCTS_BUCKET, supabase } from '../supabase'

function productActive(p) {
  return p.active !== undefined ? p.active : p.isActive
}

const CATEGORY_OPTIONS = [
  { value: 'fitroom_upper', label: 'Футболки / Худи / Свитера / Рубашки', arType: 'fitroom', fitroomClothType: 'upper' },
  { value: 'fitroom_lower', label: 'Брюки / Джинсы / Шорты / Юбки', arType: 'fitroom', fitroomClothType: 'lower' },
  { value: 'fitroom_full', label: 'Платья / Комбинезоны / Костюмы', arType: 'fitroom', fitroomClothType: 'full' },
  { value: 'face_ar_glasses', label: 'Очки (солнечные / оправы / спортивные)', arType: 'face_ar' },
  { value: 'face_ar_makeup', label: 'Макияж (помада / тени / румяна)', arType: 'face_ar' },
  { value: 'face_ar_hats', label: 'Кепки / Шапки / Береты', arType: 'face_ar' },
  { value: 'face_ar_earrings', label: 'Серьги', arType: 'face_ar' },
  { value: 'wrist_ar_watches', label: 'Часы', arType: 'wrist_ar' },
  { value: 'wrist_ar_bracelets', label: 'Золотые украшения / Браслеты', arType: 'wrist_ar' },
  { value: 'hand_ar_rings', label: 'Кольца', arType: 'hand_ar' },
  { value: 'hand_ar_nails', label: 'Лак для ногтей', arType: 'hand_ar' },
  { value: 'foot_ar_shoes', label: 'Обувь (кроссовки / туфли / сапоги)', arType: 'foot_ar' },
  { value: 'room_ar_sofa', label: 'Диваны / Кресла', arType: 'room_ar' },
  { value: 'room_ar_beds', label: 'Кровати', arType: 'room_ar' },
  { value: 'room_ar_tables', label: 'Стулья / Столы', arType: 'room_ar' },
  { value: 'room_ar_tv', label: 'Телевизоры', arType: 'room_ar' },
]

const CATEGORY_BY_VALUE = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c]))

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'Все категории' },
  { value: '__fitroom_header__', label: '--- FitRoom ---', disabled: true },
  { value: 'fitroom_upper', label: 'Футболки / Худи / Свитера / Рубашки' },
  { value: 'fitroom_lower', label: 'Брюки / Джинсы / Шорты / Юбки' },
  { value: 'fitroom_full', label: 'Платья / Комбинезоны / Костюмы' },
  { value: '__face_header__', label: '--- Face AR ---', disabled: true },
  { value: 'face_ar_all', label: 'Очки / Макияж / Кепки / Серьги' },
  { value: '__wrist_header__', label: '--- Wrist AR ---', disabled: true },
  { value: 'wrist_ar_all', label: 'Часы / Браслеты' },
  { value: '__hand_header__', label: '--- Hand AR ---', disabled: true },
  { value: 'hand_ar_all', label: 'Кольца / Лак для ногтей' },
  { value: '__foot_header__', label: '--- Foot AR ---', disabled: true },
  { value: 'foot_ar_shoes', label: 'Обувь' },
  { value: '__room_header__', label: '--- Room AR ---', disabled: true },
  { value: 'room_ar_all', label: 'Мебель / Телевизоры' },
]

const AR_BADGES = {
  fitroom: { text: '🧥 FitRoom', bg: '#DBEAFE', color: '#1D4ED8' },
  face_ar: { text: '👓 Face AR', bg: '#EDE9FE', color: '#6D28D9' },
  wrist_ar: { text: '⌚ Wrist AR', bg: '#FEF3C7', color: '#B45309' },
  hand_ar: { text: '💅 Hand AR', bg: '#FCE7F3', color: '#BE185D' },
  foot_ar: { text: '👟 Foot AR', bg: '#DCFCE7', color: '#166534' },
  room_ar: { text: '🛋️ Room AR', bg: '#FFEDD5', color: '#C2410C' },
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской', icon: '♂', bg: '#DBEAFE', color: '#1D4ED8' },
  { value: 'female', label: 'Женский', icon: '♀', bg: '#FCE7F3', color: '#BE185D' },
  { value: 'unisex', label: 'Унисекс', icon: '⚥', bg: '#F3F4F6', color: '#4B5563' },
]

const GENDER_BY_VALUE = Object.fromEntries(GENDER_OPTIONS.map((g) => [g.value, g]))

const CATEGORY_MIGRATION_MAP = {
  clothing: 'fitroom_upper',
  FitRoom: 'fitroom_upper',
  shoes: 'foot_ar_shoes',
  accessories: 'face_ar_glasses',
  jewelry: 'hand_ar_rings',
  bags: 'fitroom_upper',
  perfume: 'fitroom_upper',
}

const AR_TYPE_MIGRATION_MAP = {
  fitroom_upper: 'fitroom',
  fitroom_lower: 'fitroom',
  fitroom_full: 'fitroom',
  foot_ar_shoes: 'foot_ar',
  face_ar_glasses: 'face_ar',
  hand_ar_rings: 'hand_ar',
}

function splitTags(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

const emptyForm = () => ({
  title: '',
  price: '',
  category: 'fitroom_upper',
  description: '',
  sizesStr: '',
  colorsStr: '',
  inStock: true,
  shopContact: '',
  glbUrl: '',
  gender: 'unisex',
})

function getCategoryMeta(category) {
  return CATEGORY_BY_VALUE[category] || CATEGORY_BY_VALUE.fitroom_upper
}

function getArTypeFromProduct(product) {
  return product.arType || getCategoryMeta(product.category).arType
}

function matchesGroupedCategoryFilter(productCategory, filterValue) {
  if (filterValue === 'all') return true
  if (filterValue === 'face_ar_all') return ['face_ar_glasses', 'face_ar_makeup', 'face_ar_hats', 'face_ar_earrings'].includes(productCategory)
  if (filterValue === 'wrist_ar_all') return ['wrist_ar_watches', 'wrist_ar_bracelets'].includes(productCategory)
  if (filterValue === 'hand_ar_all') return ['hand_ar_rings', 'hand_ar_nails'].includes(productCategory)
  if (filterValue === 'room_ar_all') return ['room_ar_sofa', 'room_ar_beds', 'room_ar_tables', 'room_ar_tv'].includes(productCategory)
  return productCategory === filterValue
}

function getGenderMeta(gender) {
  return GENDER_BY_VALUE[gender] || GENDER_BY_VALUE.unisex
}

const MAX_PRODUCT_PHOTOS = 5

function normalizeProductImages(p) {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images.filter(Boolean)
  if (p.imageUrl) return [p.imageUrl]
  return []
}

function isTripoArCategory(arType) {
  return arType && arType !== 'fitroom'
}

function productThumbUrl(p) {
  const imgs = normalizeProductImages(p)
  return imgs[0] || p.imageUrl || null
}

function isProduct3dReady(p) {
  return p.model3dReady === true || p.model3dStatus === 'ready'
}

async function uploadAssetToSupabase(file, folder) {
  if (!file) return null
  if (!supabase) throw new Error('Supabase не настроен')
  const ext = String(file.name || '').split('.').pop() || 'bin'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${folder}/${safeName}`
  const { error: upErr } = await supabase.storage.from(SUPABASE_PRODUCTS_BUCKET).upload(path, file, { upsert: false })
  if (upErr) throw upErr
  const { data } = supabase.storage.from(SUPABASE_PRODUCTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export default function Products() {
  const [products, setProducts] = useState([])
  /** id -> { title, price } for inline inputs */
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  /** create: up to 5 files, one slot = one optional File */
  const [createPhotoSlots, setCreatePhotoSlots] = useState([null])
  const [glbFile, setGlbFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  /** { type: 'ok' | 'err', text: string } | null */
  const [notice, setNotice] = useState(null)
  /** Full-size photo URL for lightbox, or null */
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [migratingCategories, setMigratingCategories] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState('')
  const [migrationDone, setMigrationDone] = useState(false)
  /** Edit modal: product id being edited */
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editGlbFile, setEditGlbFile] = useState(null)
  /** edit: each slot = existing url and/or new file */
  const [editPhotoSlots, setEditPhotoSlots] = useState([{}])
  const [savingEdit, setSavingEdit] = useState(false)
  const [tripoGenStatus, setTripoGenStatus] = useState('')
  const [tripoTableStatus, setTripoTableStatus] = useState({})
  const glbRef = useRef()
  const editGlbRef = useRef()

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
      category: p.category && CATEGORY_OPTIONS.some((c) => c.value === p.category) ? p.category : 'fitroom_upper',
      description: p.description ?? '',
      sizesStr: Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
      colorsStr: Array.isArray(p.colors) ? p.colors.join(', ') : '',
      inStock: p.inStock !== false,
      shopContact: p.shopContact ?? p.sourceUrl ?? '',
      glbUrl: p.glbUrl ?? '',
      gender: p.gender || 'unisex',
    })
    const imgs = normalizeProductImages(p)
    setEditPhotoSlots(imgs.length > 0 ? imgs.map((url) => ({ url })) : [{}])
    setEditGlbFile(null)
    setTripoGenStatus('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      const sizes = splitTags(editForm.sizesStr)
      const colors = splitTags(editForm.colorsStr)
      const shop = editForm.shopContact.trim() || null
      const categoryMeta = getCategoryMeta(editForm.category)
      const isFitroom = categoryMeta.arType === 'fitroom'
      const needsTransparentImage = ['face_ar', 'wrist_ar', 'hand_ar', 'foot_ar'].includes(categoryMeta.arType)
      const needsRoomGlb = categoryMeta.arType === 'room_ar'
      const hasAnyPhotoSlot = editPhotoSlots.some((s) => s.file || s.url)
      if (needsTransparentImage && !hasAnyPhotoSlot) {
        throw new Error('Для этой категории нужно загрузить фото товара (PNG без фона)')
      }

      const nextImages = []
      for (const slot of editPhotoSlots) {
        if (slot.file) {
          const u = await uploadAssetToSupabase(slot.file, 'images')
          if (u) nextImages.push(u)
        } else if (slot.url) {
          nextImages.push(slot.url)
        }
      }
      const nextImageUrl = nextImages[0] || null
      let nextGlbUrl = editForm.glbUrl.trim() || null
      if (editGlbFile) {
        nextGlbUrl = await uploadAssetToSupabase(editGlbFile, 'glb')
      }
      if (needsRoomGlb && !nextGlbUrl) {
        throw new Error('Для Room AR нужно указать 3D модель (.glb)')
      }

      await updateDoc(doc(db, 'products', editingId), {
        title: editForm.title.trim(),
        price: Number(editForm.price) || 0,
        category: editForm.category,
        arType: categoryMeta.arType,
        fitroomClothType: isFitroom ? categoryMeta.fitroomClothType : null,
        description: editForm.description.trim() || null,
        sizes,
        colors,
        inStock: editForm.inStock,
        gender: editForm.gender || 'unisex',
        shopContact: shop,
        shopUsername: shop,
        sourceUrl: shop,
        imageUrl: nextImageUrl,
        images: nextImages.length > 0 ? nextImages : [],
        glbUrl: nextGlbUrl,
      })
      setNotice({ type: 'ok', text: 'Сохранено' })
      setEditingId(null)
      load()
    } catch (e) {
      alert('Ошибка: ' + e.message)
    }
    setSavingEdit(false)
  }

  const handleTripoGenerate = async (productId, source = 'modal') => {
    const setStatus = (s) => {
      if (source === 'modal') setTripoGenStatus(s)
      else setTripoTableStatus((prev) => ({ ...prev, [productId]: s }))
    }
    setStatus('⏳ Генерация 3D...')
    try {
      await API.post('/api/tripo3d/generate', { productId })
      await updateDoc(doc(db, 'products', productId), { model3dReady: true })
      setStatus('✅ Готово!')
      load()
    } catch (err) {
      setStatus('❌ Ошибка')
      console.error(err)
    }
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
      const categoryMeta = getCategoryMeta(form.category)
      const needsTransparentImage = ['face_ar', 'wrist_ar', 'hand_ar', 'foot_ar'].includes(categoryMeta.arType)
      const needsRoomGlb = categoryMeta.arType === 'room_ar'
      const createFiles = createPhotoSlots.filter(Boolean)
      if (needsTransparentImage && createFiles.length === 0) {
        throw new Error('Для этой категории нужно загрузить фото товара (PNG без фона)')
      }
      const uploadedUrls = []
      for (const f of createFiles) {
        const u = await uploadAssetToSupabase(f, 'images')
        if (u) uploadedUrls.push(u)
      }
      fd.append('title', form.title)
      fd.append('price', form.price)
      fd.append('category', form.category)
      fd.append('description', form.description)
      fd.append('sizes', form.sizesStr)
      fd.append('colors', form.colorsStr)
      fd.append('inStock', form.inStock ? 'true' : 'false')
      fd.append('gender', form.gender || 'unisex')
      fd.append('shopContact', form.shopContact)
      if (createFiles[0]) fd.append('image', createFiles[0])
      const res = await API.post('/api/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data?.id) {
        let nextGlbUrl = form.glbUrl.trim() || null
        if (glbFile) {
          nextGlbUrl = await uploadAssetToSupabase(glbFile, 'glb')
        }
        if (needsRoomGlb && !nextGlbUrl) {
          throw new Error('Для Room AR нужно указать 3D модель (.glb)')
        }
        const imageUrlFromApi = res.data.imageUrl || res.data.photoUrl || res.data.product?.imageUrl || null
        const finalImages = uploadedUrls.length > 0 ? uploadedUrls : imageUrlFromApi ? [imageUrlFromApi] : []
        const mainUrl = finalImages[0] || imageUrlFromApi || null
        await updateDoc(doc(db, 'products', res.data.id), {
          active: false,
          category: form.category,
          arType: categoryMeta.arType,
          fitroomClothType: categoryMeta.arType === 'fitroom' ? categoryMeta.fitroomClothType : null,
          gender: form.gender || 'unisex',
          shopUsername: form.shopContact.trim() || null,
          glbUrl: nextGlbUrl,
          ...(mainUrl ? { imageUrl: mainUrl } : {}),
          ...(finalImages.length > 0 ? { images: finalImages } : {}),
        })
      }
      setShowForm(false)
      setForm(emptyForm())
      setCreatePhotoSlots([null])
      setGlbFile(null)
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

  const handleCategoryMigration = async () => {
    if (migratingCategories || migrationDone) return
    setMigratingCategories(true)
    setMigrationProgress('Подготовка...')
    try {
      const snapshot = await getDocs(collection(db, 'products'))
      const total = snapshot.docs.length
      let updated = 0
      for (const d of snapshot.docs) {
        const data = d.data() || {}
        const mappedCategory = CATEGORY_MIGRATION_MAP[data.category] || data.category || 'fitroom_upper'
        const mappedArType = AR_TYPE_MIGRATION_MAP[mappedCategory] || data.arType || 'fitroom'
        await updateDoc(doc(db, 'products', d.id), {
          category: mappedCategory,
          arType: mappedArType,
        })
        updated += 1
        setMigrationProgress(`Обновлено ${updated} из ${total} товаров`)
      }
      setMigrationDone(true)
      setMigrationProgress(`Обновлено ${updated} из ${total} товаров`)
      alert('Миграция завершена!')
      load()
    } catch (error) {
      alert('Ошибка миграции: ' + error.message)
    } finally {
      setMigratingCategories(false)
    }
  }

  const filteredProducts = products.filter((product) => {
    const bySearch = (product.title || '').toLowerCase().includes(search.toLowerCase())
    const byCategory = matchesGroupedCategoryFilter(product.category, categoryFilter)
    return bySearch && byCategory
  })
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
          {!migrationDone && (
            <button
              type="button"
              onClick={handleCategoryMigration}
              disabled={migratingCategories}
              style={{
                padding: '12px 24px',
                backgroundColor: '#F97316',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                cursor: migratingCategories ? 'not-allowed' : 'pointer',
                opacity: migratingCategories ? 0.7 : 1,
              }}
            >
              🔄 Миграция категорий
            </button>
          )}
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
      {migrationProgress && (
        <div style={{ marginBottom: '12px', color: '#9A3412', fontSize: '13px', fontWeight: 600 }}>{migrationProgress}</div>
      )}

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
          {CATEGORY_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
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
          <label style={labelStyle}>Пол</label>
          <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ marginTop: '-4px', marginBottom: '12px' }}>
            <span style={{ ...tagChipStyle, backgroundColor: AR_BADGES[getCategoryMeta(form.category).arType].bg, color: AR_BADGES[getCategoryMeta(form.category).arType].color }}>
              {AR_BADGES[getCategoryMeta(form.category).arType].text}
            </span>
          </div>
          <label style={labelStyle}>Фотографии товара (до {MAX_PRODUCT_PHOTOS})</label>
          <div style={{ marginBottom: '12px' }}>
            {createPhotoSlots.map((file, idx) => (
              <div key={`create-slot-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ fontSize: 13, maxWidth: '100%' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setCreatePhotoSlots((prev) => {
                      const next = [...prev]
                      next[idx] = f
                      return next
                    })
                  }}
                />
                {file && <span style={{ fontSize: 12, color: '#64748B' }}>{file.name}</span>}
                {createPhotoSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCreatePhotoSlots((prev) => {
                        const next = prev.filter((_, i) => i !== idx)
                        return next.length ? next : [null]
                      })
                    }
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            ))}
            {createPhotoSlots.length < MAX_PRODUCT_PHOTOS && (
              <button
                type="button"
                onClick={() => setCreatePhotoSlots((prev) => (prev.length >= MAX_PRODUCT_PHOTOS ? prev : [...prev, null]))}
                style={{ padding: '8px 14px', border: '1px dashed #cbd5e1', borderRadius: 10, background: '#fafafa', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >
                + Добавить фото
              </button>
            )}
            {['face_ar', 'wrist_ar', 'hand_ar', 'foot_ar'].includes(getCategoryMeta(form.category).arType) && (
              <p style={{ marginTop: 8, color: '#6B7280', fontSize: 12 }}>Загрузите фото товара на белом или прозрачном фоне (PNG без фона)</p>
            )}
          </div>
          {getCategoryMeta(form.category).arType === 'foot_ar' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>3D модель (.glb)</label>
              <button
                type="button"
                onClick={() => glbRef.current?.click()}
                style={{ padding: '10px 20px', border: '2px dashed #eee', borderRadius: '10px', cursor: 'pointer', backgroundColor: 'transparent', fontSize: '14px', color: '#888' }}
              >
                {glbFile ? `🧊 ${glbFile.name}` : '🧊 Загрузить .glb (опционально)'}
              </button>
              <input ref={glbRef} type="file" accept=".glb,model/gltf-binary" style={{ display: 'none' }} onChange={(e) => setGlbFile(e.target.files?.[0] || null)} />
            </div>
          )}
          {getCategoryMeta(form.category).arType === 'room_ar' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>3D модель (.glb)</label>
                <button
                  type="button"
                  onClick={() => glbRef.current?.click()}
                  style={{ padding: '10px 20px', border: '2px dashed #eee', borderRadius: '10px', cursor: 'pointer', backgroundColor: 'transparent', fontSize: '14px', color: '#888', marginBottom: 8 }}
                >
                  {glbFile ? `🧊 ${glbFile.name}` : '🧊 Загрузить .glb'}
                </button>
                <input ref={glbRef} type="file" accept=".glb,model/gltf-binary" style={{ display: 'none' }} onChange={(e) => setGlbFile(e.target.files?.[0] || null)} />
                <input
                  style={inputStyle}
                  placeholder="или вставьте URL 3D модели (.glb)"
                  value={form.glbUrl}
                  onChange={(e) => setForm({ ...form, glbUrl: e.target.value })}
                />
              </div>
            </>
          )}
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
          {isTripoArCategory(getCategoryMeta(form.category).arType) && (
            <p style={{ marginBottom: 12, fontSize: 12, color: '#6B7280' }}>
              После сохранения товара можно создать 3D в карточке товара (кнопка «🎲 Создать 3D модель»).
            </p>
          )}
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
                const thumb = productThumbUrl(p)
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      {thumb ? (
                        <button
                          type="button"
                          onClick={() => setZoomPhotoUrl(thumb)}
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
                          <img src={thumb} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                        </button>
                      ) : (
                        <span style={{ fontSize: 32 }}>📷</span>
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
                      {AR_BADGES[getArTypeFromProduct(p)] && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: '4px 8px',
                            backgroundColor: AR_BADGES[getArTypeFromProduct(p)].bg,
                            color: AR_BADGES[getArTypeFromProduct(p)].color,
                          }}
                        >
                          {AR_BADGES[getArTypeFromProduct(p)].text}
                        </span>
                      )}
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: 8,
                          marginLeft: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: '4px 8px',
                          backgroundColor: getGenderMeta(p.gender).bg,
                          color: getGenderMeta(p.gender).color,
                        }}
                        title={getGenderMeta(p.gender).label}
                      >
                        {getGenderMeta(p.gender).icon}
                      </span>
                      {isProduct3dReady(p) && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 8,
                            marginLeft: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: '4px 8px',
                            backgroundColor: '#EDE9FE',
                            color: '#5B21B6',
                          }}
                        >
                          3D готов
                        </span>
                      )}
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
                      {isTripoArCategory(getArTypeFromProduct(p)) && thumb && (
                        <button
                          type="button"
                          onClick={() => handleTripoGenerate(p.id, 'table')}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            marginRight: '8px',
                            backgroundColor: '#7C3AED',
                            color: '#fff',
                          }}
                          title="Создать 3D модель"
                        >
                          🎲 3D
                        </button>
                      )}
                      {tripoTableStatus[p.id] && (
                        <span style={{ fontSize: 11, fontWeight: 600, marginRight: 8, color: '#6B21A8' }}>{tripoTableStatus[p.id]}</span>
                      )}
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
          onClick={() => {
            setEditingId(null)
            setTripoGenStatus('')
          }}
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
            <label style={labelStyle}>Пол</label>
            <select style={inputStyle} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div style={{ marginTop: '-4px', marginBottom: '12px' }}>
              <span style={{ ...tagChipStyle, backgroundColor: AR_BADGES[getCategoryMeta(editForm.category).arType].bg, color: AR_BADGES[getCategoryMeta(editForm.category).arType].color }}>
                {AR_BADGES[getCategoryMeta(editForm.category).arType].text}
              </span>
            </div>
            <label style={labelStyle}>Фотографии товара (до {MAX_PRODUCT_PHOTOS})</label>
            <div style={{ marginBottom: '12px' }}>
              {editPhotoSlots.map((slot, idx) => (
                <div key={`edit-slot-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {slot.url && !slot.file && (
                    <img src={slot.url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ fontSize: 13, maxWidth: '100%' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setEditPhotoSlots((prev) => {
                        const next = [...prev]
                        next[idx] = { ...next[idx], file: f || undefined, url: f ? undefined : next[idx]?.url }
                        return next
                      })
                    }}
                  />
                  {slot.file && <span style={{ fontSize: 12, color: '#64748B' }}>{slot.file.name}</span>}
                  {editPhotoSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditPhotoSlots((prev) => {
                          const next = prev.filter((_, i) => i !== idx)
                          return next.length ? next : [{}]
                        })
                      }
                      style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              ))}
              {editPhotoSlots.length < MAX_PRODUCT_PHOTOS && (
                <button
                  type="button"
                  onClick={() => setEditPhotoSlots((prev) => (prev.length >= MAX_PRODUCT_PHOTOS ? prev : [...prev, {}]))}
                  style={{ padding: '8px 14px', border: '1px dashed #cbd5e1', borderRadius: 10, background: '#fafafa', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  + Добавить фото
                </button>
              )}
              {['face_ar', 'wrist_ar', 'hand_ar', 'foot_ar'].includes(getCategoryMeta(editForm.category).arType) && (
                <p style={{ marginTop: 8, color: '#6B7280', fontSize: 12 }}>Загрузите фото товара на белом или прозрачном фоне (PNG без фона)</p>
              )}
            </div>
            {isTripoArCategory(getCategoryMeta(editForm.category).arType) && editingId && (
              <div style={{ marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleTripoGenerate(editingId, 'modal')}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: 10,
                    background: '#7C3AED',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  🎲 Создать 3D модель
                </button>
                {tripoGenStatus && <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{tripoGenStatus}</p>}
              </div>
            )}
            {getCategoryMeta(editForm.category).arType === 'foot_ar' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>3D модель (.glb)</label>
                <button
                  type="button"
                  onClick={() => editGlbRef.current?.click()}
                  style={{ padding: '10px 20px', border: '2px dashed #eee', borderRadius: '10px', cursor: 'pointer', backgroundColor: 'transparent', fontSize: '14px', color: '#888' }}
                >
                  {editGlbFile ? `🧊 ${editGlbFile.name}` : '🧊 Загрузить .glb (опционально)'}
                </button>
                <input ref={editGlbRef} type="file" accept=".glb,model/gltf-binary" style={{ display: 'none' }} onChange={(e) => setEditGlbFile(e.target.files?.[0] || null)} />
              </div>
            )}
            {getCategoryMeta(editForm.category).arType === 'room_ar' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>3D модель (.glb)</label>
                <button
                  type="button"
                  onClick={() => editGlbRef.current?.click()}
                  style={{ padding: '10px 20px', border: '2px dashed #eee', borderRadius: '10px', cursor: 'pointer', backgroundColor: 'transparent', fontSize: '14px', color: '#888', marginBottom: 8 }}
                >
                  {editGlbFile ? `🧊 ${editGlbFile.name}` : '🧊 Загрузить .glb'}
                </button>
                <input ref={editGlbRef} type="file" accept=".glb,model/gltf-binary" style={{ display: 'none' }} onChange={(e) => setEditGlbFile(e.target.files?.[0] || null)} />
                <input
                  style={inputStyle}
                  placeholder="или вставьте URL 3D модели (.glb)"
                  value={editForm.glbUrl}
                  onChange={(e) => setEditForm({ ...editForm, glbUrl: e.target.value })}
                />
              </div>
            )}
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
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setTripoGenStatus('')
                }}
                style={{ flex: 1, padding: '14px', backgroundColor: 'transparent', border: '1px solid #eee', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
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
