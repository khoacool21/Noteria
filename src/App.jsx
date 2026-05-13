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
import {
  createNote,
  deleteNote,
  fetchAccount,
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

function App() {
  const [account, setAccount] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [users, setUsers] = useState([])
  const [notes, setNotes] = useState([])
  const [pdfs, setPdfs] = useState([])
  const [images, setImages] = useState([])
  const [view, setView] = useState('dashboard')
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [activePdfId, setActivePdfId] = useState(null)
  const [summary, setSummary] = useState('')
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [status, setStatus] = useState('Ready for action')
  const saveTimer = useRef(null)

  const activeNote = notes.find((note) => note.id === activeNoteId) || notes[0]
  const activePdf = pdfs.find((pdf) => pdf.id === activePdfId) || null
  const activeNotePdfs = useMemo(
    () => pdfs.filter((pdf) => pdf.note_id === activeNoteId),
    [pdfs, activeNoteId],
  )

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return notes
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.folder?.toLowerCase().includes(query) ||
        stripHtml(note.content).toLowerCase().includes(query),
    )
  }, [notes, search])

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
      setNotes([])
      setPdfs([])
      setImages([])
      setUsers([])
    })
  }, [])

  useEffect(() => {
    if (!account) return
    let ignore = false

    async function loadWorkspace() {
      const [noteRows, pdfRows, imageRows, userRows] = await Promise.all([
        fetchNotes(),
        fetchPdfs(),
        fetchImages(),
        account.role === 'admin' ? fetchUserProfiles() : Promise.resolve([]),
      ])
      if (ignore) return
      setNotes(noteRows)
      setPdfs(pdfRows)
      setImages(imageRows)
      setUsers(userRows)
      setActiveNoteId(noteRows[0]?.id || null)
      setActivePdfId(null)
    }

    loadWorkspace()
    return () => {
      ignore = true
    }
  }, [account])

  const queueNoteSave = useCallback((nextNote) => {
    setNotes((current) =>
      current.map((note) => (note.id === nextNote.id ? nextNote : note)),
    )
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      setIsSaving(true)
      const saved = await saveNote(nextNote, account)
      setIsSaving(false)
      if (saved) {
        if (nextNote.id !== saved.id) {
          setNotes((current) =>
            current.map((note) => (note.id === nextNote.id ? saved : note)),
          )
          setActiveNoteId(saved.id)
        }
        setStatus('Saved to Supabase')
      } else {
        setStatus('Saved locally. Check Supabase env/table setup.')
      }
    }, 650)
  }, [account])

  const handleNoteChange = (patch) => {
    if (!activeNote) return
    queueNoteSave({
      ...activeNote,
      ...patch,
      updated_at: new Date().toISOString(),
    })
  }

  const openNote = (id) => {
    setActiveNoteId(id)
    setActivePdfId(null)
    setView('editor')
  }

  const handleCreateNote = async (folder = 'Inbox') => {
    const optimistic = {
      id: `local-${crypto.randomUUID()}`,
      title: `Untitled Panel ${notes.length + 1}`,
      folder: folder.trim() || 'Inbox',
      content: '<p>Start sketching your thought here...</p>',
      updated_at: new Date().toISOString(),
    }
    setNotes((current) => [optimistic, ...current])
    setActiveNoteId(optimistic.id)
    setActivePdfId(null)
    setView('editor')
    const saved = await createNote(optimistic, account)
    if (saved) {
      setNotes((current) =>
        current.map((note) => (note.id === optimistic.id ? saved : note)),
      )
      setActiveNoteId(saved.id)
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
    setNotes(nextNotes)
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

    setNotes((current) =>
      current.map((note) => (note.id === activeNote.id ? saved : note)),
    )
    setActiveNoteId(saved.id)
    return saved
  }, [activeNote, account])

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
        pdfs={activeNotePdfs}
        activeNoteId={activeNoteId}
        activePdfId={activePdfId}
        onSelectNote={(id) => {
          openNote(id)
        }}
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
              account={account}
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
