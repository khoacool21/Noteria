import { useEffect, useRef } from 'react'
import { Box, Button, HStack, Input, Text } from '@chakra-ui/react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import '@fontsource/inter/700.css'
import '@fontsource/bangers'
import '@fontsource/comic-neue/700.css'
import '@fontsource/permanent-marker'
import {
  FiBold,
  FiImage,
  FiItalic,
  FiPenTool,
  FiType,
  FiUnderline,
} from 'react-icons/fi'

const fonts = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Bangers', value: 'Bangers, cursive' },
  { label: 'Comic Neue', value: '"Comic Neue", cursive' },
  { label: 'Marker', value: '"Permanent Marker", cursive' },
]

const fontSizes = [
  { label: '16 px', value: '16px' },
  { label: '20 px', value: '20px' },
  { label: '24 px', value: '24px' },
  { label: '30 px', value: '30px' },
  { label: '36 px', value: '36px' },
]

const FontSize = Extension.create({
  name: 'textFormatting',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replaceAll('"', ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily?.replaceAll('"', ''),
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {}
              return { style: `font-family: ${attributes.fontFamily}` }
            },
          },
        },
      },
    ]
  },
})

function NoteEditor({ note, onChange, onImageUpload }) {
  const fileRef = useRef(null)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: note?.content || '',
    editorProps: {
      attributes: {
        class: 'rich-editor tiptap-editor',
      },
      handlePaste: (_view, event) => {
        const item = [...event.clipboardData.items].find((entry) =>
          entry.type.startsWith('image/'),
        )
        if (!item) return false
        event.preventDefault()
        handleImageFile(item.getAsFile())
        return true
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange({ content: activeEditor.getHTML() })
    },
  })

  useEffect(() => {
    if (!editor || note?.content === editor.getHTML()) return
    editor.commands.setContent(note?.content || '', { emitUpdate: false })
  }, [editor, note?.id, note?.content])

  if (!note) {
    return (
      <Box className="comic-panel editor-panel">
        <Text>No note selected.</Text>
      </Box>
    )
  }

  const handleImageFile = async (file) => {
    if (!file || !editor) return
    const url = await onImageUpload(file)
    if (url) {
      editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    }
  }

  return (
    <Box className="comic-panel editor-panel">
      <HStack justify="space-between" mb={3} align="start" gap={3}>
        <Box flex="1">
          <Text className="panel-kicker">Note Editor</Text>
          <Input
            className="title-input"
            value={note.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </Box>
        <Input
          className="folder-input"
          value={note.folder || 'Inbox'}
          onChange={(event) => onChange({ folder: event.target.value })}
        />
      </HStack>

      <HStack className="toolbar" gap={2} flexWrap="wrap">
        <Button
          title="Bold"
          className={editor?.isActive('bold') ? 'tool-active' : ''}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <FiBold />
        </Button>
        <Button
          title="Italic"
          className={editor?.isActive('italic') ? 'tool-active' : ''}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <FiItalic />
        </Button>
        <Button
          title="Underline"
          className={editor?.isActive('underline') ? 'tool-active' : ''}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <FiUnderline />
        </Button>
        <Button
          title="Strike"
          className={editor?.isActive('strike') ? 'tool-active' : ''}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <FiPenTool />
        </Button>
        <Button
          title="Heading"
          className={editor?.isActive('heading', { level: 2 }) ? 'tool-active' : ''}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <FiType />
        </Button>
        <select
          className="select-tool font-select"
          defaultValue=""
          onChange={(event) =>
            editor?.chain().focus().setMark('textStyle', { fontFamily: event.target.value }).run()
          }
        >
          <option value="" disabled>
            Font
          </option>
          {fonts.map((font) => (
            <option value={font.value} key={font.label}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          className="select-tool size-select"
          defaultValue=""
          onChange={(event) =>
            editor?.chain().focus().setMark('textStyle', { fontSize: event.target.value }).run()
          }
        >
          <option value="" disabled>
            Size
          </option>
          {fontSizes.map((size) => (
            <option value={size.value} key={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <Button title="Image" onClick={() => fileRef.current?.click()}>
          <FiImage />
        </Button>
        <Input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => handleImageFile(event.target.files?.[0])}
        />
      </HStack>

      <EditorContent editor={editor} />
    </Box>
  )
}

export default NoteEditor
