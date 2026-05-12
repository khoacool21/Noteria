import { Box, Button, Spinner, Text, VStack } from '@chakra-ui/react'
import { FiCornerDownLeft, FiZap } from 'react-icons/fi'

function SummaryPanel({ summary, isLoading, onInsert }) {
  return (
    <Box className="comic-panel summary-panel">
      <Text className="panel-kicker">AI Summary</Text>
      <Text className="panel-title">Gemini recap</Text>

      <VStack align="stretch" className="summary-body">
        {isLoading && (
          <Box className="loading-card">
            <Spinner />
            <Text>Writing concise bullet points...</Text>
          </Box>
        )}

        {!isLoading && !summary && (
          <Box className="empty-summary">
            <FiZap />
            <Text>Select a note or PDF text, then hit AI Summary.</Text>
          </Box>
        )}

        {!isLoading &&
          summary
            .split('\n')
            .filter(Boolean)
            .map((line, index) => (
              <Box className="summary-bullet" key={`${line}-${index}`}>
                {line.replace(/^[-*]\s*/, '')}
              </Box>
            ))}
      </VStack>

      <Button className="comic-button pink full" disabled={!summary || isLoading} onClick={onInsert}>
        <FiCornerDownLeft /> Insert in Note
      </Button>
    </Box>
  )
}

export default SummaryPanel
