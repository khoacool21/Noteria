import { Box, Button, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { FiFileText, FiFolder, FiPlus, FiTrash2, FiX } from 'react-icons/fi'

function FolderNotesDialog({
  folder,
  notes,
  onClose,
  onCreateNote,
  onDeleteNote,
  onOpenNote,
  canDeleteNote,
}) {
  if (!folder) return null

  return (
    <Box className="folder-dialog-backdrop" role="presentation" onClick={onClose}>
      <Box
        className="folder-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${folder.name} notes`}
        onClick={(event) => event.stopPropagation()}
      >
        <HStack justify="space-between" align="start" gap={3}>
          <Box minW="0">
            <Text className="panel-kicker">Folder</Text>
            <Text className="folder-dialog-title">
              <FiFolder /> {folder.name}
            </Text>
            <Text className="dashboard-copy">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} in this folder
            </Text>
          </Box>
          <Button className="mini-button" title="Close" onClick={onClose}>
            <FiX />
          </Button>
        </HStack>

        <Grid className="folder-note-list">
          {notes.map((note) => (
            <Box className="folder-note-row" key={note.id}>
              <Box minW="0">
                <Text className="note-card-title">{note.title}</Text>
                <Text className="note-card-owner">By {note.user_name || 'Unknown user'}</Text>
                <Text className="note-card-preview">{stripHtml(note.content)}</Text>
              </Box>
              <HStack gap={2} flexWrap="wrap">
                <Button className="comic-button blue" onClick={() => onOpenNote(note.id)}>
                  <FiFileText /> Open
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
          ))}
        </Grid>

        {notes.length === 0 && (
          <VStack className="empty-folder">
            <Text>No notes in this folder yet.</Text>
          </VStack>
        )}

        <Button className="comic-button full" onClick={() => onCreateNote(folder.name)}>
          <FiPlus /> Add Note
        </Button>
      </Box>
    </Box>
  )
}

function stripHtml(html) {
  const node = document.createElement('div')
  node.innerHTML = html || ''
  return node.textContent || node.innerText || 'No text yet.'
}

export default FolderNotesDialog
