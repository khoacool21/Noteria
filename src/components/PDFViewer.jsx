import { useState } from 'react'
import { Box, Button, HStack, Text } from '@chakra-ui/react'
import { Document, Page, pdfjs } from 'react-pdf'
import { FiMinus, FiPlus, FiZap } from 'react-icons/fi'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

function PDFViewer({ pdf, onSummarize, isSummarizing }) {
  const [pages, setPages] = useState(0)
  const [scale, setScale] = useState(1)

  return (
    <Box className="comic-panel pdf-panel">
      <HStack className="pdf-header" justify="space-between" mb={3}>
        <Box className="pdf-title-block">
          <Text className="panel-kicker">PDF Reader</Text>
          <Text className="panel-title pdf-title">{pdf.title}</Text>
        </Box>
        <HStack className="pdf-controls">
          <Button
            className="mini-button pdf-summary-button"
            title="Summarize selected PDF text"
            onClick={onSummarize}
            loading={isSummarizing}
          >
            <FiZap />
            <Text as="span">Summary</Text>
          </Button>
          <Button className="mini-button" onClick={() => setScale((value) => Math.max(0.65, value - 0.1))}>
            <FiMinus />
          </Button>
          <Text fontWeight="900">{Math.round(scale * 100)}%</Text>
          <Button className="mini-button" onClick={() => setScale((value) => Math.min(1.8, value + 0.1))}>
            <FiPlus />
          </Button>
        </HStack>
      </HStack>

      <Box className="pdf-scroll">
        <Document
          file={pdf.url}
          onLoadSuccess={({ numPages }) => setPages(numPages)}
          loading={<Text>Loading PDF...</Text>}
          error={<Text>Could not load this PDF. Check storage permissions.</Text>}
        >
          {Array.from(new Array(pages), (_, index) => (
            <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={scale} />
          ))}
        </Document>
      </Box>
    </Box>
  )
}

export default PDFViewer
