import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('...')
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signIn(email, password) {
  if (!supabase) return { error: { message: 'Supabase is not configured.' } }
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpUser(form) {
  if (!supabase) return { error: { message: 'Supabase is not configured.' } }
  return supabase.auth.signUp({
    email: form.email,
    password: form.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        country: form.country,
      },
    },
  })
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function fetchAccount(session) {
  if (!supabase || !session?.user) return null
  const user = session.user

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = Boolean(adminProfile) || userProfile?.role === 'admin'

  return {
    id: user.id,
    email: user.email,
    role: isAdmin ? 'admin' : 'user',
    profile: isAdmin ? { name: 'Admin' } : userProfile,
  }
}

export async function fetchUserProfiles() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('Could not fetch user profiles', error)
    return []
  }
  return data || []
}

export async function updateUserRole(userId, role) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    console.warn('Could not update user role', error)
    return null
  }
  return data
}

export async function fetchNotes() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) {
    console.warn('Could not fetch notes', error)
    return []
  }
  return data || []
}

export async function createNote(note, account) {
  if (!supabase || !account) return null
  const insertable = {
    title: note.title,
    folder: note.folder || 'Inbox',
    content: note.content,
    updated_at: note.updated_at,
    user_id: account.id,
    user_name: account.profile?.name || account.email || 'User',
  }
  const { data, error } = await supabase.from('notes').insert(insertable).select().single()
  if (error) {
    console.warn('Could not create note', error)
    return null
  }
  return data
}

export async function saveNote(note, account) {
  if (!supabase || !account) return null
  if (note.id?.startsWith('local-')) {
    return createNote(note, account)
  }
  const { data, error } = await supabase
    .from('notes')
    .upsert({
      id: note.id,
      user_id: note.user_id || account.id,
      user_name: note.user_name || account.profile?.name || account.email || 'User',
      title: note.title,
      folder: note.folder || 'Inbox',
      content: note.content,
      updated_at: note.updated_at,
    })
    .select()
    .single()
  if (error) {
    console.warn('Could not save note', error)
    return null
  }
  return data
}

export async function deleteNote(noteId) {
  if (!noteId) return false
  if (noteId.startsWith('local-')) return true
  if (!supabase) return false

  const { error } = await supabase.from('notes').delete().eq('id', noteId)
  if (error) {
    console.warn('Could not delete note', error)
    return false
  }
  return true
}

export async function fetchPdfs() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('pdfs')
    .select('*')
    .order('created_at', {
      ascending: false,
    })
  if (error) {
    console.warn('Could not fetch PDFs', error)
    return []
  }
  return data || []
}

export async function fetchImages() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('images')
    .select('*')
    .order('created_at', {
      ascending: false,
    })
  if (error) {
    console.warn('Could not fetch images', error)
    return []
  }
  return data || []
}

export async function uploadPdf(file, noteId, account) {
  if (!supabase || !file || !account) return null
  const folder = noteId ? `notes/${noteId}` : 'unassigned'
  const path = `${folder}/pdfs/${crypto.randomUUID()}-${cleanName(file.name)}`
  const { error: uploadError } = await supabase.storage.from('pdfs').upload(path, file)
  if (uploadError) {
    console.warn('Could not upload PDF', uploadError)
    return null
  }
  const { data: publicUrl } = supabase.storage.from('pdfs').getPublicUrl(path)
  const { data, error } = await supabase
    .from('pdfs')
    .insert({
      note_id: noteId,
      user_id: account.id,
      title: file.name,
      url: publicUrl.publicUrl,
    })
    .select()
    .single()
  if (error) {
    console.warn('Could not store PDF row', error)
    return null
  }
  return data
}

export async function uploadImage(file, noteId, account) {
  if (!supabase || !file || !noteId || !account) return null
  const path = `notes/${noteId}/${crypto.randomUUID()}-${cleanName(file.name)}`
  const { error: uploadError } = await supabase.storage.from('images').upload(path, file)
  if (uploadError) {
    console.warn('Could not upload image', uploadError)
    return null
  }
  const { data: publicUrl } = supabase.storage.from('images').getPublicUrl(path)
  const { data, error } = await supabase
    .from('images')
    .insert({ note_id: noteId, user_id: account.id, url: publicUrl.publicUrl })
    .select()
    .single()
  if (error) {
    console.warn('Could not store image row', error)
    return { url: publicUrl.publicUrl }
  }
  return data
}

export async function saveSummary(summary, account) {
  if (!supabase || !account) return null
  const { data, error } = await supabase
    .from('summaries')
    .insert({ ...summary, user_id: account.id })
    .select()
    .single()
  if (error) {
    console.warn('Could not save summary', error)
    return null
  }
  return data
}

function cleanName(name) {
  return name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()
}
