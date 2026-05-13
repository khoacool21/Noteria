import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Button, HStack, Text } from '@chakra-ui/react'
import {
  FiCornerUpLeft,
  FiCornerUpRight,
  FiEdit3,
  FiMinus,
  FiTrash2,
} from 'react-icons/fi'
import { ReactSketchCanvas } from 'react-sketch-canvas'
import { HexColorInput, HexColorPicker } from 'react-colorful'

const colors = ['#171717', '#e02424', '#ff4f9a', '#1fb6ff', '#39d98a', '#ffd23f']

function SketchCanvasPanel({ note, onSketchChange }) {
  const canvasRef = useRef(null)
  const syncTimer = useRef(null)
  const hydrateTimer = useRef(null)
  const loadedNoteIdRef = useRef(null)
  const isHydratingRef = useRef(false)
  const dirtyRef = useRef(false)
  const dirtyNoteIdRef = useRef(null)
  const latestPathsRef = useRef([])
  const onSketchChangeRef = useRef(onSketchChange)
  const [eraseMode, setEraseMode] = useState(false)
  const [strokeColor, setStrokeColor] = useState(colors[0])
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)

  useEffect(() => {
    onSketchChangeRef.current = onSketchChange
  }, [onSketchChange])

  const flushSketchChange = useCallback(async () => {
    window.clearTimeout(syncTimer.current)

    const shouldFlush = dirtyRef.current
    const targetNoteId = dirtyNoteIdRef.current || loadedNoteIdRef.current
    dirtyRef.current = false

    if (!shouldFlush || !targetNoteId) return

    try {
      const exportedPaths = await canvasRef.current?.exportPaths()
      if (Array.isArray(exportedPaths)) {
        latestPathsRef.current = exportedPaths
      }
    } catch (error) {
      console.warn('Could not export sketch paths', error)
    }

    onSketchChangeRef.current(latestPathsRef.current, targetNoteId)
  }, [])

  useEffect(() => {
    const nextNoteId = note?.id || null
    if (loadedNoteIdRef.current === nextNoteId) return

    const canvas = canvasRef.current
    if (!canvas) return

    if (dirtyRef.current) {
      flushSketchChange()
    }

    window.clearTimeout(hydrateTimer.current)
    isHydratingRef.current = true
    dirtyRef.current = false
    canvas.resetCanvas()
    const paths = Array.isArray(note?.sketch_paths) ? note.sketch_paths : []
    latestPathsRef.current = paths
    dirtyNoteIdRef.current = nextNoteId
    if (paths.length > 0) {
      canvas.loadPaths(paths)
    }
    setEraseMode(false)
    canvas.eraseMode(false)
    loadedNoteIdRef.current = nextNoteId
    hydrateTimer.current = window.setTimeout(() => {
      isHydratingRef.current = false
    }, 150)
  }, [flushSketchChange, note?.id, note?.sketch_paths])

  useEffect(
    () => () => {
      window.clearTimeout(syncTimer.current)
      window.clearTimeout(hydrateTimer.current)
      flushSketchChange()
    },
    [flushSketchChange],
  )

  const queueSketchSave = useCallback((paths, delay = 300) => {
    latestPathsRef.current = paths
    if (isHydratingRef.current) return
    dirtyRef.current = true
    dirtyNoteIdRef.current = loadedNoteIdRef.current || note?.id || null
    window.clearTimeout(syncTimer.current)
    syncTimer.current = window.setTimeout(flushSketchChange, delay)
  }, [flushSketchChange, note?.id])

  const queueCurrentCanvasSave = useCallback((delay = 120) => {
    if (isHydratingRef.current) return
    dirtyRef.current = true
    dirtyNoteIdRef.current = loadedNoteIdRef.current || note?.id || null
    window.clearTimeout(syncTimer.current)
    syncTimer.current = window.setTimeout(flushSketchChange, delay)
  }, [flushSketchChange, note?.id])

  const setTool = (nextEraseMode) => {
    setEraseMode(nextEraseMode)
    canvasRef.current?.eraseMode(nextEraseMode)
  }

  const handleUndo = () => {
    canvasRef.current?.undo()
    queueCurrentCanvasSave()
  }

  const handleRedo = () => {
    canvasRef.current?.redo()
    queueCurrentCanvasSave()
  }

  const handleClear = () => {
    canvasRef.current?.resetCanvas()
    queueCurrentCanvasSave()
  }

  const handleColorChange = (color) => {
    setStrokeColor(color)
    setTool(false)
  }

  return (
    <Box className="sketch-panel">
      <HStack className="sketch-toolbar" gap={2} flexWrap="wrap">
        <Button
          title="Pen"
          className={!eraseMode ? 'tool-active' : ''}
          onClick={() => setTool(false)}
        >
          <FiEdit3 />
        </Button>
        <Button
          title="Eraser"
          className={eraseMode ? 'tool-active' : ''}
          onClick={() => setTool(true)}
        >
          <FiMinus />
        </Button>
        <Button title="Undo" onClick={handleUndo}>
          <FiCornerUpLeft />
        </Button>
        <Button title="Redo" onClick={handleRedo}>
          <FiCornerUpRight />
        </Button>
        <Button title="Clear sketch" onClick={handleClear}>
          <FiTrash2 />
        </Button>

        <HStack className="sketch-swatches" gap={1}>
          {colors.map((color) => (
            <Button
              key={color}
              title={color}
              className={strokeColor === color ? 'swatch active' : 'swatch'}
              style={{ '--swatch-color': color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </HStack>

        <Box className="sketch-color-control">
          <Button
            className="custom-color-button"
            title="Choose custom color"
            onClick={() => setIsColorPickerOpen((current) => !current)}
          >
            <Box className="color-preview" style={{ backgroundColor: strokeColor }} />
            Color
          </Button>
          {isColorPickerOpen && (
            <Box className="color-popover">
              <HexColorPicker color={strokeColor} onChange={handleColorChange} />
              <HStack className="hex-input-row" gap={2}>
                <Text>#</Text>
                <HexColorInput color={strokeColor} onChange={handleColorChange} />
              </HStack>
            </Box>
          )}
        </Box>

        <HStack className="stroke-size-control" gap={2}>
          <Text>Stroke</Text>
          <input
            className="stroke-slider"
            type="range"
            min="2"
            max="24"
            value={strokeWidth}
            onChange={(event) => setStrokeWidth(Number(event.target.value))}
          />
          <Text className="stroke-value">{strokeWidth}px</Text>
        </HStack>
      </HStack>

      <Box className="sketch-canvas-shell">
        <ReactSketchCanvas
          ref={canvasRef}
          id={`note-sketch-${note?.id || 'empty'}`}
          width="100%"
          height="560px"
          canvasColor="#ffffff"
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          eraserWidth={24}
          style={{ border: '0' }}
          svgStyle={{ touchAction: 'none' }}
          onChange={(paths) => queueSketchSave(paths)}
          onStroke={() => queueCurrentCanvasSave(80)}
        />
      </Box>
    </Box>
  )
}

export default SketchCanvasPanel
