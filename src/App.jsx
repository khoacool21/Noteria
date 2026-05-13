import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import {
  FiRefreshCw,
  FiZap,
} from 'react-icons/fi'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import Dashboard from './components/Dashboard.jsx'
import AuthPage from './components/AuthPage.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import NoteEditor from './components/NoteEditor.jsx'
import PDFViewer from './components/PDFViewer.jsx'
import SummaryPanel from './components/SummaryPanel.jsx'
import FolderNotesDialog from './components/FolderNotesDialog.jsx'
import {
  createNote,
  deleteNote,
  fetchAccount,
  fetchFolders,
  fetchImages,
  fetchNotes,
  fetchPdfs,
  fetchUserProfiles,
  getSession,
  onAuthChange,
  saveNote,
  saveSummary,
  signOut,
  updateUserRole,
  uploadImage,
  uploadPdf,
} from './lib/supabase.js'
import { summarizeContent } from './lib/gemini.js'
import './styles/app.css'

const NOTE_CACHE_PREFIX = 'noterira:notes'

function App() {
  const [account, setAccount] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [users, setUsers] = useState([])
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [pdfs, setPdfs] = useState([])
  const [images, setImages] = useState([])
  const [view, setView] = useState('dashboard')
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [activeFolderKey, setActiveFolderKey] = useState(null)
  const [activePdfId, setActivePdfId] = useState(null)
  const [summary, setSummary] = useState('')
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [status, setStatus] = useState('Ready for action')
  const saveTimer = useRef(null)
  const notesRef = useRef([])

  const activeNote = notes.find((note) => note.id === activeNoteId) || notes[0]
  const activePdf = pdfs.find((pdf) => pdf.id === activePdfId) || null
  const activeNotePdfs = useMemo(
    () => pdfs.filter((pdf) => pdf.note_id === activeNoteId),
    [pdfs, activeNoteId],
  )
  const folderSummaries = useMemo(() => buildFolderSummaries(folders, notes), [folders, notes])
  const activeFolder = folderSummaries.find((folder) => folder.key === activeFolderKey) || null
  const activeFolderNotes = useMemo(
    () => (activeFolder ? getNotesForFolder(notes, activeFolder) : []),
    [activeFolder, notes],
  )

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return notes
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        getNoteFolderName(note, folderSummaries).toLowerCase().includes(query) ||
        stripHtml(note.content).toLowerCase().includes(query),
    )
  }, [folderSummaries, notes, search])

  const refreshFolders = useCallback(async () => {
    const folderRows = await fetchFolders()
    setFolders(folderRows)
  }, [])

  const setNotesAndCache = useCallback((updater, accountId = account?.id) => {
    const nextNotes =
      typeof updater === 'function' ? updater(notesRef.current) : updater

    notesRef.current = nextNotes
    setNotes(nextNotes)
    writeCachedNotes(accountId, nextNotes)
    return nextNotes
  }, [account?.id])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    async function boot() {
      const session = await getSession()
      const nextAccount = await fetchAccount(session)
      setAccount(nextAccount)
      setIsAuthReady(true)
    }

    boot()
    return onAuthChange(async (session) => {
      const nextAccount = await fetchAccount(session)
      setAccount(nextAccount)
      setView('dashboard')
      setFolders([])
      notesRef.current = []
      setNotes([])
      setPdfs([])
      setImages([])
      setUsers([])
      setActiveFolderKey(null)
    })
  }, [])

  useEffect(() => {
    if (!account) return
    let ignore = false

    async function loadWorkspace() {
      const [folderRows, noteRows, pdfRows, imageRows, userRows] = await Promise.all([
        fetchFolders(),
        fetchNotes(),
        fetchPdfs(),
        fetchImages(),
        account.role === 'admin' ? fetchUserProfiles() : Promise.resolve([]),
      ])
      if (ignore) return
      const cachedNoteRows = readCachedNotes(account.id)
      const mergedNoteRows = mergeCachedNotes(noteRows, cachedNoteRows)
      setFolders(folderRows)
      setNotesAndCache(mergedNoteRows, account.id)
      setPdfs(pdfRows)
      setImages(imageRows)
      setUsers(userRows)
      setActiveNoteId(mergedNoteRows[0]?.id || null)
      setActivePdfId(null)
    }

    loadWorkspace()
    return () => {
      ignore = true
    }
  }, [account, setNotesAndCache])

  const persistNote = useCallback(async (nextNote, options = {}) => {
    setIsSaving(true)
    const saved = await saveNote(nextNote, account)
    setIsSaving(false)

    if (saved) {
      setNotesAndCache((current) =>
        current.map((note) =>
          note.id === nextNote.id
            ? mergeSavedNoteMetadata(note, saved)
            : note,
        ),
      )
      if (nextNote.id !== saved.id) {
        setActiveNoteId(saved.id)
      }
      refreshFolders()
      setStatus(options.successStatus || 'Saved to Supabase')
      return saved
    }

    setStatus(options.failureStatus || 'Saved locally. Check Supabase env/table setup.')
    return null
  }, [account, refreshFolders, setNotesAndCache])

  const queueNoteSave = useCallback((nextNote, options = {}) => {
    setNotesAndCache((current) =>
      current.map((note) => (note.id === nextNote.id ? nextNote : note)),
    )
    window.clearTimeout(saveTimer.current)
    if (options.immediate) {
      persistNote(nextNote, options)
      return
    }
    saveTimer.current = window.setTimeout(
      () => persistNote(nextNote, options),
      options.delay ?? 650,
    )
  }, [persistNote, setNotesAndCache])

  const handleNoteChange = (patch, options = {}) => {
    const targetNoteId = options.noteId || activeNote?.id
    const baseNote = notesRef.current.find((note) => note.id === targetNoteId) || activeNote
    if (!baseNote) return
    const saveOptions = { ...options }
    delete saveOptions.noteId

    queueNoteSave({
      ...baseNote,
      ...patch,
      updated_at: new Date().toISOString(),
    }, saveOptions)
  }

  const openNote = (id) => {
    setActiveNoteId(id)
    setActiveFolderKey(null)
    setActivePdfId(null)
    setView('editor')
  }

  const handleCreateNote = async (folder = 'Inbox') => {
    const optimistic = {
      id: `local-${crypto.randomUUID()}`,
      title: `Untitled Panel ${notes.length + 1}`,
      folder: folder.trim() || 'Inbox',
      folder_id: null,
      content: '<p>Start sketching your thought here...</p>',
      sketch_paths: [],
      sketch_updated_at: null,
      updated_at: new Date().toISOString(),
    }
    setNotesAndCache((current) => [optimistic, ...current])
    setActiveNoteId(optimistic.id)
    setActiveFolderKey(null)
    setActivePdfId(null)
    setView('editor')
    const saved = await createNote(optimistic, account)
    if (saved) {
      setNotesAndCache((current) =>
        current.map((note) => (note.id === optimistic.id ? saved : note)),
      )
      setActiveNoteId(saved.id)
      refreshFolders()
      setStatus('New note created in Supabase')
    } else {
      setStatus('New local note created')
    }
  }

  const handleDeleteNote = async (noteToDelete = activeNote) => {
    if (!noteToDelete) return
    if (!canDeleteNote(noteToDelete, account)) {
      setStatus('You can only delete your own notes.')
      return
    }

    const confirmed = window.confirm(
      `Delete "${noteToDelete.title || 'this note'}"? This cannot be undone.`,
    )
    if (!confirmed) return

    window.clearTimeout(saveTimer.current)
    setIsSaving(true)
    const removed = await deleteNote(noteToDelete.id)
    setIsSaving(false)

    if (!removed) {
      setStatus('Delete failed. Check note permissions.')
      return
    }

    const nextNotes = notes.filter((note) => note.id !== noteToDelete.id)
    setNotesAndCache(nextNotes)
    setPdfs((current) => current.filter((pdf) => pdf.note_id !== noteToDelete.id))
    setImages((current) => current.filter((image) => image.note_id !== noteToDelete.id))

    if (noteToDelete.id === activeNoteId) {
      setActiveNoteId(nextNotes[0]?.id || null)
      setActivePdfId(null)
      setSummary('')
      if (view === 'editor') {
        setView('dashboard')
      }
    }

    setStatus('Note deleted')
  }

  const ensureSavedActiveNote = useCallback(async () => {
    if (!activeNote) return null
    if (!activeNote.id?.startsWith('local-')) return activeNote

    setIsSaving(true)
    const saved = await saveNote(activeNote, account)
    setIsSaving(false)

    if (!saved) {
      setStatus('Create or save a note before attaching files.')
      return null
    }

    setNotesAndCache((current) =>
      current.map((note) => (note.id === activeNote.id ? saved : note)),
    )
    setActiveNoteId(saved.id)
    refreshFolders()
    return saved
  }, [activeNote, account, refreshFolders, setNotesAndCache])

  const handleImageUpload = async (file) => {
    if (!activeNote || !file) return null
    const savedNote = await ensureSavedActiveNote()
    if (!savedNote) return null
    const url = await uploadImage(file, savedNote.id, account)
    if (!url?.url) {
      setStatus('Image stayed local. Check Supabase storage.')
      return null
    }
    if (url.id) {
      setImages((current) => [url, ...current])
    }
    return url.url
  }

  const handlePdfUpload = async (file) => {
    if (!file) return
    const savedNote = await ensureSavedActiveNote()
    if (!savedNote) return
    setStatus('Uploading PDF...')
    const pdf = await uploadPdf(file, savedNote.id, account)
    if (pdf) {
      setPdfs((current) => [pdf, ...current])
      setActivePdfId(pdf.id)
      setStatus(`PDF attached to ${savedNote.title}`)
    } else {
      setStatus('PDF upload failed. Check the pdfs storage bucket.')
    }
  }

  const handleSummarize = async (target = 'note') => {
    const savedNote = await ensureSavedActiveNote()
    if (!savedNote) return
    setIsSummarizing(true)
    const source =
      target === 'pdf'
        ? window.getSelection()?.toString() || activePdf?.title || ''
        : `${activeNote?.title || ''}\n${stripHtml(activeNote?.content || '')}`
    const result = await summarizeContent(source)
    setSummary(result)
    setIsSummarizing(false)
    setStatus(result.startsWith('Gemini') ? result : 'Summary generated')
    if (result && !result.startsWith('Gemini')) {
      saveSummary(
        {
          note_id: savedNote.id,
          pdf_id: target === 'pdf' ? activePdf?.id : null,
          content: result,
        },
        account,
      )
    }
  }

  const handleRoleChange = async (userId, role) => {
    const updated = await updateUserRole(userId, role)
    if (updated) {
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)))
      setStatus('User role updated')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setAccount(null)
  }

  if (!isAuthReady) {
    return (
      <Box className="auth-shell">
        <Box className="speech-bubble">
          <Spinner size="sm" /> Loading account...
        </Box>
      </Box>
    )
  }

  if (!account) {
    return <AuthPage />
  }

  return (
    <Flex minH="100vh" bg="var(--paper)" color="gray.900">
      <Sidebar
        notes={filteredNotes}
        folders={folderSummaries}
        pdfs={activeNotePdfs}
        activeNoteId={activeNoteId}
        activePdfId={activePdfId}
        onSelectNote={(id) => {
          openNote(id)
        }}
        onSelectFolder={setActiveFolderKey}
        onSelectPdf={(id) => setActivePdfId(id)}
        onGoHome={() => setView('dashboard')}
      />

      <Box flex="1" minW="0">
        <TopBar
          search={search}
          onSearch={setSearch}
          onUploadPdf={handlePdfUpload}
          canUploadPdf={view === 'editor' && Boolean(activeNote)}
          account={account}
          onGoHome={() => setView('dashboard')}
          onProfile={() => setView('profile')}
          onAdmin={() => setView('admin')}
          onSignOut={handleSignOut}
        />

        <Box px={{ base: 4, xl: 6 }} py={5}>
          {view === 'dashboard' ? (
            <Dashboard
              notes={filteredNotes}
              pdfs={pdfs}
              images={images}
              folders={folderSummaries}
              account={account}
              onOpenFolder={setActiveFolderKey}
              onOpenNote={openNote}
              onCreateNote={handleCreateNote}
              onDeleteNote={handleDeleteNote}
              canDeleteNote={(note) => canDeleteNote(note, account)}
            />
          ) : view === 'profile' ? (
            <ProfilePage account={account} />
          ) : view === 'admin' && account.role === 'admin' ? (
            <AdminDashboard users={users} onRoleChange={handleRoleChange} />
          ) : (
            <>
              <HStack mb={4} gap={3} flexWrap="wrap">
                <StatusBubble status={status} isSaving={isSaving} />
                <Button className="comic-button ghost" onClick={() => handleSummarize('note')}>
                  <FiZap /> Summarize Note
                </Button>
              </HStack>

              <Grid
                templateColumns={{ base: '1fr', xl: activePdf ? '1.15fr 1fr 0.85fr' : '1.35fr 0.9fr' }}
                gap={5}
                alignItems="start"
              >
                <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  <NoteEditor
                    note={activeNote}
                    folders={folderSummaries}
                    onChange={handleNoteChange}
                    onImageUpload={handleImageUpload}
                    onDelete={() => handleDeleteNote(activeNote)}
                    canDelete={canDeleteNote(activeNote, account)}
                  />
                </motion.div>

                {activePdf && (
                  <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                    <PDFViewer
                      pdf={activePdf}
                      onSummarize={() => handleSummarize('pdf')}
                      isSummarizing={isSummarizing}
                    />
                  </motion.div>
                )}

                <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  <SummaryPanel
                    summary={summary}
                    isLoading={isSummarizing}
                    onInsert={() =>
                      handleNoteChange({
                        content: `${activeNote?.content || ''}<h3>AI Summary</h3>${markdownBulletsToHtml(summary)}`,
                      })
                    }
                  />
                </motion.div>
              </Grid>
            </>
          )}
        </Box>
      </Box>

      <FolderNotesDialog
        folder={activeFolder}
        notes={activeFolderNotes}
        onClose={() => setActiveFolderKey(null)}
        onOpenNote={openNote}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        canDeleteNote={(note) => canDeleteNote(note, account)}
      />
    </Flex>
  )
}

function StatusBubble({ status, isSaving }) {
  return (
    <HStack className="speech-bubble" gap={2}>
      {isSaving ? <Spinner size="sm" /> : <FiRefreshCw />}
      <Text fontWeight="800">{status}</Text>
    </HStack>
  )
}

function canDeleteNote(note, account) {
  if (!note || !account) return false
  return account.role === 'admin' || note.user_id === account.id || note.id?.startsWith('local-')
}

function readCachedNotes(accountId) {
  if (!accountId) return []

  try {
    const stored = window.localStorage.getItem(getNoteCacheKey(accountId))
    const parsed = JSON.parse(stored || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeCachedNote).filter(Boolean)
  } catch (error) {
    console.warn('Could not read local notes cache', error)
    return []
  }
}

function writeCachedNotes(accountId, notes) {
  if (!accountId) return

  try {
    window.localStorage.setItem(
      getNoteCacheKey(accountId),
      JSON.stringify(notes.map(normalizeCachedNote).filter(Boolean)),
    )
  } catch (error) {
    console.warn('Could not write local notes cache', error)
  }
}

function mergeCachedNotes(remoteNotes, cachedNotes) {
  const merged = new Map()
  const keepCachedWithoutRemote = remoteNotes.length === 0

  remoteNotes.map(normalizeCachedNote).filter(Boolean).forEach((note) => {
    merged.set(note.id, note)
  })

  cachedNotes.map(normalizeCachedNote).filter(Boolean).forEach((cachedNote) => {
    const remoteNote = merged.get(cachedNote.id)

    if (!remoteNote) {
      if (keepCachedWithoutRemote || cachedNote.id.startsWith('local-')) {
        merged.set(cachedNote.id, cachedNote)
      }
      return
    }

    const cachedUpdatedAt = getNoteTime(cachedNote.updated_at)
    const remoteUpdatedAt = getNoteTime(remoteNote.updated_at)
    const cachedSketchUpdatedAt = getNoteTime(cachedNote.sketch_updated_at)
    const remoteSketchUpdatedAt = getNoteTime(remoteNote.sketch_updated_at)

    if (cachedUpdatedAt > remoteUpdatedAt) {
      merged.set(cachedNote.id, { ...remoteNote, ...cachedNote })
      return
    }

    if (cachedSketchUpdatedAt > remoteSketchUpdatedAt) {
      merged.set(cachedNote.id, {
        ...remoteNote,
        sketch_paths: cachedNote.sketch_paths,
        sketch_updated_at: cachedNote.sketch_updated_at,
      })
    }
  })

  return [...merged.values()].sort(
    (a, b) => getNoteTime(b.updated_at) - getNoteTime(a.updated_at),
  )
}

function normalizeCachedNote(note) {
  if (!note?.id) return null

  return {
    ...note,
    title: note.title || 'Untitled Panel',
    folder: note.folder || 'Inbox',
    content: note.content || '',
    sketch_paths: Array.isArray(note.sketch_paths) ? note.sketch_paths : [],
    sketch_updated_at: note.sketch_updated_at || null,
    updated_at: note.updated_at || note.created_at || null,
  }
}

function getNoteCacheKey(accountId) {
  return `${NOTE_CACHE_PREFIX}:${accountId}`
}

function getNoteTime(value) {
  const time = Date.parse(value || '')
  return Number.isFinite(time) ? time : 0
}

function mergeSavedNoteMetadata(currentNote, savedNote) {
  const currentUpdatedAt = getNoteTime(currentNote.updated_at)
  const savedUpdatedAt = getNoteTime(savedNote.updated_at)
  const currentSketchUpdatedAt = getNoteTime(currentNote.sketch_updated_at)
  const savedSketchUpdatedAt = getNoteTime(savedNote.sketch_updated_at)
  const editSource = savedUpdatedAt > currentUpdatedAt ? savedNote : currentNote
  const sketchSource = savedSketchUpdatedAt > currentSketchUpdatedAt ? savedNote : editSource

  return {
    ...editSource,
    id: savedNote.id,
    folder_id: savedNote.folder_id,
    folder: savedNote.folder,
    user_id: savedNote.user_id,
    user_name: savedNote.user_name,
    created_at: savedNote.created_at,
    updated_at: editSource.updated_at || savedNote.updated_at,
    sketch_paths: Array.isArray(sketchSource.sketch_paths) ? sketchSource.sketch_paths : [],
    sketch_updated_at: sketchSource.sketch_updated_at || null,
  }
}

function buildFolderSummaries(folders, notes) {
  const byKey = new Map()

  folders.forEach((folder) => {
    byKey.set(folder.id, {
      ...folder,
      key: folder.id,
      noteCount: 0,
      isLegacy: false,
    })
  })

  notes.forEach((note) => {
    const key = getNoteFolderKey(note)
    const name = note.folder || 'Inbox'

    if (!byKey.has(key)) {
      byKey.set(key, {
        id: note.folder_id || null,
        key,
        name,
        user_id: note.user_id,
        noteCount: 0,
        isLegacy: !note.folder_id,
      })
    }

    byKey.get(key).noteCount += 1
  })

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function getNotesForFolder(notes, folder) {
  return notes.filter((note) => getNoteFolderKey(note) === folder.key)
}

function getNoteFolderKey(note) {
  if (note.folder_id) return note.folder_id
  return `legacy-${note.user_id || 'local'}-${slugFolder(note.folder || 'Inbox')}`
}

function getNoteFolderName(note, folders) {
  return folders.find((folder) => folder.key === getNoteFolderKey(note))?.name || note.folder || 'Inbox'
}

function slugFolder(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function stripHtml(html) {
  const node = document.createElement('div')
  node.innerHTML = html || ''
  return node.textContent || node.innerText || ''
}

function markdownBulletsToHtml(text) {
  if (!text) return ''
  const items = text
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`
}

export default App
