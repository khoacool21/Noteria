import { Button, Flex, HStack, Input } from '@chakra-ui/react'
import { FiHome, FiLogOut, FiSearch, FiShield, FiUploadCloud, FiUser } from 'react-icons/fi'

function TopBar({
  search,
  onSearch,
  onUploadPdf,
  canUploadPdf,
  account,
  onGoHome,
  onProfile,
  onAdmin,
  onSignOut,
}) {
  return (
    <Flex className="topbar" align="center" gap={3} wrap="wrap">
      <HStack className="search-box" flex="1" minW={{ base: '100%', md: '280px' }}>
        <FiSearch />
        <Input
          variant="unstyled"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search panels, folders, and clues..."
        />
      </HStack>

      <Button
        as="label"
        className="comic-button blue"
        disabled={!canUploadPdf}
        title={canUploadPdf ? 'Attach PDF to selected note' : 'Create a note first'}
      >
        <FiUploadCloud /> Upload PDF
        <Input
          type="file"
          accept="application/pdf"
          hidden
          disabled={!canUploadPdf}
          onChange={(event) => onUploadPdf(event.target.files?.[0])}
        />
      </Button>

      <Button className="comic-button ghost" onClick={onGoHome}>
        <FiHome /> Home
      </Button>

      <Button className="comic-button ghost" onClick={onProfile}>
        <FiUser /> Profile
      </Button>

      {account?.role === 'admin' && (
        <Button className="comic-button pink" onClick={onAdmin}>
          <FiShield /> Admin
        </Button>
      )}

      <Button className="comic-button ghost" onClick={onSignOut}>
        <FiLogOut /> Sign Out
      </Button>
    </Flex>
  )
}

export default TopBar
