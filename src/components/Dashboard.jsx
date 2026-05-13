import { useMemo, useState } from 'react'
import { Box, Button, Grid, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { FiFileText, FiFolder, FiImage, FiPlus, FiTrash2, FiUploadCloud } from 'react-icons/fi'

function Dashboard({
  notes,
  pdfs,
  images,
  folders,
  account,
  onOpenFolder,
  onOpenNote,
  onCreateNote,
  onDeleteNote,
  canDeleteNote,
}) {
  const folderNames = useMemo(
    () => [...new Set(folders.map((item) => item.name))],
    [folders],
  )
  const [folder, setFolder] = useState(folderNames[0] || 'Inbox')

  return (
    <Box className="dashboard">
      <Box className="dashboard-hero">
        <Box>
          <Text className="panel-kicker">Homepage</Text>
          <Text as="h1">Your note panels</Text>
          <Text className="dashboard-copy">
            {account?.role === 'admin'
              ? 'Admin view shows every note created by every user.'
              : 'Only notes attached to your account are shown here.'}
          </Text>
        </Box>

        <Box className="new-note-card">
          <Text className="panel-kicker">Create Note</Text>
          <Text className="new-note-title">Pick a folder</Text>
          <HStack gap={2} align="stretch">
            <Input
              className="dashboard-folder-input"
              list="dashboard-folders"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              placeholder="Inbox"
            />
            <datalist id="dashboard-folders">
              {folderNames.map((item) => (
                <option value={item} key={item} />
              ))}
            </datalist>
            <Button className="comic-button" onClick={() => onCreateNote(folder || 'Inbox')}>
              <FiPlus /> Add Note
            </Button>
          </HStack>
        </Box>
      </Box>

      <HStack className="dashboard-folder-strip" gap={2} flexWrap="wrap">
        {folders.map((item) => (
          <Button
            className="folder-chip folder-chip-button"
            key={item.key}
            onClick={() => onOpenFolder(item.key)}
          >
            <FiFolder />
            <Text as="span">{item.name}</Text>
            <Text as="span">{item.noteCount}</Text>
          </Button>
        ))}
      </HStack>

      <Grid className="note-grid">
        {notes.map((note) => {
          const pdfCount = pdfs.filter((pdf) => pdf.note_id === note.id).length
          const imageCount = images.filter((image) => image.note_id === note.id).length
          const updated = note.updated_at
            ? new Intl.DateTimeFormat(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(note.updated_at))
            : 'Just now'

          return (
            <Box className="note-card" key={note.id}>
              <HStack justify="space-between" align="start" gap={3}>
                <Box minW="0">
                  <Text className="note-card-folder">
                    <FiFolder /> {note.folder || 'Inbox'}
                  </Text>
                  <Text className="note-card-title">{note.title}</Text>
                  <Text className="note-card-owner">By {note.user_name || 'Unknown user'}</Text>
                </Box>
                <Text className="note-card-date">{updated}</Text>
              </HStack>

              <Text className="note-card-preview">{stripHtml(note.content)}</Text>

              <HStack className="note-card-stats" gap={2} flexWrap="wrap">
                <Text>
                  <FiImage /> {imageCount} images
                </Text>
                <Text>
                  <FiUploadCloud /> {pdfCount} PDFs
                </Text>
              </HStack>

              <HStack className="note-card-actions" gap={2} align="stretch">
                <Button className="comic-button blue" onClick={() => onOpenNote(note.id)}>
                  <FiFileText /> Open Note
                </Button>
                {canDeleteNote?.(note) && (
                  <Button
                    className="comic-button pink note-delete-button"
                    title="Delete note"
                    onClick={() => onDeleteNote(note)}
                  >
                    <FiTrash2 />
                  </Button>
                )}
              </HStack>
            </Box>
          )
        })}
      </Grid>

      {notes.length === 0 && (
        <VStack className="empty-dashboard">
          <Text>No notes yet.</Text>
          <Button className="comic-button" onClick={() => onCreateNote(folder || 'Inbox')}>
            <FiPlus /> Add Note
          </Button>
        </VStack>
      )}
    </Box>
  )
}

function stripHtml(html) {
  const node = document.createElement('div')
  node.innerHTML = html || ''
  return node.textContent || node.innerText || 'No text yet.'
}

export default Dashboard
