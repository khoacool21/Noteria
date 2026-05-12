import { Box, Button, Grid, HStack, Text } from '@chakra-ui/react'
import { FiShield, FiUser } from 'react-icons/fi'

function AdminDashboard({ users, onRoleChange }) {
  return (
    <Box className="dashboard">
      <Box className="dashboard-hero admin-hero">
        <Box>
          <Text className="panel-kicker">Admin Dashboard</Text>
          <Text as="h1">User command center</Text>
          <Text className="dashboard-copy">
            Review registered users and update their role. Notes remain owned by the
            original user ID.
          </Text>
        </Box>
      </Box>

      <Grid className="admin-user-list">
        {users.map((user) => (
          <Box className="admin-user-card" key={user.id}>
            <HStack justify="space-between" align="start" gap={4}>
              <Box>
                <Text className="note-card-title">{user.name}</Text>
                <Text className="note-card-folder">{user.email}</Text>
              </Box>
              <Box className={user.role === 'admin' ? 'role-badge admin' : 'role-badge'}>
                {user.role === 'admin' ? <FiShield /> : <FiUser />}
                {user.role}
              </Box>
            </HStack>

            <Grid className="admin-info-grid">
              <Info label="Phone" value={user.phone || 'Not set'} />
              <Info label="Gender" value={user.gender || 'Not set'} />
              <Info label="Country" value={user.country || 'Not set'} />
              <Info label="Created" value={new Date(user.created_at).toLocaleDateString()} />
            </Grid>

            <HStack gap={2} flexWrap="wrap">
              <Button
                className="comic-button blue"
                disabled={user.role === 'user'}
                onClick={() => onRoleChange(user.id, 'user')}
              >
                Make User
              </Button>
              <Button
                className="comic-button pink"
                disabled={user.role === 'admin'}
                onClick={() => onRoleChange(user.id, 'admin')}
              >
                Make Admin
              </Button>
            </HStack>
          </Box>
        ))}
      </Grid>
    </Box>
  )
}

function Info({ label, value }) {
  return (
    <Box>
      <Text className="panel-kicker">{label}</Text>
      <Text fontWeight="900">{value}</Text>
    </Box>
  )
}

export default AdminDashboard
