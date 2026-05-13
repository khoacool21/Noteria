import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { FiBookOpen, FiFileText, FiFolder } from 'react-icons/fi'

function Sidebar({
  notes,
  folders,
  pdfs,
  activeNoteId,
  activePdfId,
  onSelectFolder,
  onSelectNote,
  onSelectPdf,
  onGoHome,
}) {
  return (
    <Box className="sidebar" display={{ base: 'none', md: 'block' }}>
      <Box className="brand-burst" role="button" tabIndex={0} onClick={onGoHome}>
        <Text as="h1">Noterira</Text>
        <Text>Comic notes, PDFs, and AI recap panels</Text>
      </Box>

      <VStack align="stretch" gap={5}>
        <Box>
          <HStack className="nav-heading">
            <FiFolder />
            <Text>Folders</Text>
          </HStack>
          {folders.map((folder) => (
            <Button
              className="folder-chip folder-chip-button"
              key={folder.key}
              onClick={() => onSelectFolder(folder.key)}
            >
              <Text as="span">{folder.name}</Text>
              <Text as="span">{folder.noteCount}</Text>
            </Button>
          ))}
          {folders.length === 0 && <Text className="muted">No folders yet.</Text>}
        </Box>

        <Box>
          <HStack className="nav-heading">
            <FiFileText />
            <Text>Notes</Text>
          </HStack>
          <VStack align="stretch" gap={2}>
            {notes.map((note) => (
              <Button
                key={note.id}
                className={note.id === activeNoteId ? 'nav-card active' : 'nav-card'}
                onClick={() => onSelectNote(note.id)}
              >
                <Text as="span">{note.title}</Text>
              </Button>
            ))}
          </VStack>
        </Box>

        <Box>
          <HStack className="nav-heading">
            <FiBookOpen />
            <Text>Note PDFs</Text>
          </HStack>
          <VStack align="stretch" gap={2}>
            {pdfs.length === 0 && <Text className="muted">No PDFs attached to this note yet.</Text>}
            {pdfs.map((pdf) => (
              <Button
                key={pdf.id}
                className={pdf.id === activePdfId ? 'nav-card pdf active' : 'nav-card pdf'}
                onClick={() => onSelectPdf(pdf.id)}
              >
                <Text as="span">{pdf.title}</Text>
              </Button>
            ))}
          </VStack>
        </Box>
      </VStack>
    </Box>
  )
}

export default Sidebar
