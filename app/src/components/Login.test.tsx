import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'
import { Login } from './Login'
import { supabase } from '../supabase'

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}))

const signInWithPassword = vi.mocked(supabase.auth.signInWithPassword)
const signUp = vi.mocked(supabase.auth.signUp)

describe('Login', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
    signUp.mockReset()
  })

  afterEach(cleanup)

  it('submits entered credentials and shows authentication errors', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    })
    const user = userEvent.setup()

    render(<Login />)
    await user.type(screen.getByLabelText('Email'), 'pianist@example.com')
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'pianist@example.com',
        password: 'not-a-real-password',
      })
    })
    expect(await screen.findByText('Invalid login credentials')).toBeTruthy()
  })

  it('starts account creation and displays the confirmation prompt', async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    render(<Login />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'a-password' })
    })
    expect(await screen.findByText('Check your email if confirmation is required.')).toBeTruthy()
  })
})
