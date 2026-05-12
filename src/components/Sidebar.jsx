import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { FiBookOpen, FiFileText, FiFolder } from 'react-icons/fi'

function Sidebar({
  notes,
  pdfs,
  activeNoteId,
  activePdfId,
  onSelectNote,
  onSelectPdf,
  onGoHome,
}) {
  const folders = [...new Set(notes.map((note) => note.folder || 'Inbox'))]

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
            <Box className="folder-chip" key={folder}>
              {folder}
            </Box>
          ))}
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
