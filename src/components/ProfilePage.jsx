import { Box, Grid, Text } from '@chakra-ui/react'

function ProfilePage({ account }) {
  const isAdmin = account?.role === 'admin'
  const profile = account?.profile || {}

  return (
    <Box className="dashboard">
      <Box className="dashboard-hero profile-hero">
        <Box>
          <Text className="panel-kicker">Profile</Text>
          <Text as="h1">{isAdmin ? 'Admin' : profile.name || 'User'}</Text>
          <Text className="dashboard-copy">
            {isAdmin
              ? 'Admin profile information is intentionally limited.'
              : 'Your account details are attached to your notes and protected by ownership rules.'}
          </Text>
        </Box>
      </Box>

      {!isAdmin && (
        <Grid className="profile-grid">
          <ProfileTile label="Email" value={profile.email || account.email} />
          <ProfileTile label="Name" value={profile.name} />
          <ProfileTile label="Age" value={profile.age || 'Not set'} />
          <ProfileTile label="Gender" value={profile.gender || 'Not set'} />
          <ProfileTile label="Country" value={profile.country || 'Not set'} />
          <ProfileTile label="Phone" value={profile.phone || 'Not set'} />
        </Grid>
      )}
    </Box>
  )
}

function ProfileTile({ label, value }) {
  return (
    <Box className="profile-tile">
      <Text className="panel-kicker">{label}</Text>
      <Text>{value}</Text>
    </Box>
  )
}

export default ProfilePage
