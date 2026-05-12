import { useState } from 'react'
import { Box, Button, Grid, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { FiLogIn, FiMail, FiUserPlus } from 'react-icons/fi'
import { signIn, signUpUser } from '../lib/supabase.js'

const emptyRegister = {
  name: '',
  email: '',
  phone: '',
  gender: '',
  country: '',
  password: '',
  confirmPassword: '',
}

function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [login, setLogin] = useState({ email: '', password: '' })
  const [register, setRegister] = useState(emptyRegister)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    const { error } = await signIn(login.email, login.password)
    setIsLoading(false)
    setMessage(error?.message || '')
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    if (register.password !== register.confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }
    setIsLoading(true)
    const { error } = await signUpUser(register)
    setIsLoading(false)
    setMessage(
      error?.message ||
        'Account created. Check your email and verify the account before signing in.',
    )
    if (!error) setRegister(emptyRegister)
  }

  return (
    <Box className="auth-shell">
      <Grid className="auth-grid">
        <Box className="auth-poster">
          <Text className="panel-kicker">Noterira</Text>
          <Text as="h1">Private comic notes</Text>
          <Text>
            Sign in to see your own notes. Admins can review every note and manage user
            roles from the dashboard.
          </Text>
        </Box>

        <Box className="auth-card">
          <HStack className="auth-tabs">
            <Button
              className={mode === 'signin' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => setMode('signin')}
            >
              <FiLogIn /> Sign In
            </Button>
            <Button
              className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => setMode('register')}
            >
              <FiUserPlus /> Register
            </Button>
          </HStack>

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn}>
              <VStack align="stretch" gap={3}>
                <Text className="auth-title">Welcome back</Text>
                <Field
                  label="Email"
                  type="email"
                  value={login.email}
                  onChange={(value) => setLogin((current) => ({ ...current, email: value }))}
                />
                <Field
                  label="Password"
                  type="password"
                  value={login.password}
                  onChange={(value) =>
                    setLogin((current) => ({ ...current, password: value }))
                  }
                />
                <Button className="comic-button pink full" type="submit" loading={isLoading}>
                  <FiMail /> Sign In
                </Button>
              </VStack>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <VStack align="stretch" gap={3}>
                <Text className="auth-title">Create user account</Text>
                <Field
                  label="Name"
                  value={register.name}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, name: value }))
                  }
                />
                <Field
                  label="Email"
                  type="email"
                  value={register.email}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, email: value }))
                  }
                />
                <Field
                  label="Phone number"
                  value={register.phone}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, phone: value }))
                  }
                />
                <SelectField
                  label="Gender"
                  value={register.gender}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, gender: value }))
                  }
                />
                <Field
                  label="Country"
                  value={register.country}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, country: value }))
                  }
                />
                <Field
                  label="Password"
                  type="password"
                  value={register.password}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, password: value }))
                  }
                />
                <Field
                  label="Confirm Password"
                  type="password"
                  value={register.confirmPassword}
                  onChange={(value) =>
                    setRegister((current) => ({ ...current, confirmPassword: value }))
                  }
                />
                <Button className="comic-button full" type="submit" loading={isLoading}>
                  <FiUserPlus /> Register User
                </Button>
              </VStack>
            </form>
          )}

          {message && <Box className="auth-message">{message}</Box>}
        </Box>
      </Grid>
    </Box>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="form-field">
      <Text>{label}</Text>
      <Input
        value={value}
        type={type}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function SelectField({ label, value, onChange }) {
  return (
    <label className="form-field">
      <Text>{label}</Text>
      <select
        className="form-select"
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          Select gender
        </option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>
    </label>
  )
}

export default AuthPage
