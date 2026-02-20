import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { HashRouter, Routes, Route, Link } from 'react-router'

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Link to="/settings">Go to Settings</Link>
    </div>
  )
}

function Settings() {
  return (
    <div>
      <h1>Settings</h1>
      <Link to="/">Go to Dashboard</Link>
    </div>
  )
}

function TestApp() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  )
}

describe('HashRouter', () => {
  beforeEach(() => {
    // Reset hash location between tests so each test starts at root
    window.location.hash = '#/'
  })

  it('should render Dashboard at root path', () => {
    render(<TestApp />)

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('should navigate to Settings when link is clicked', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Go to Settings' }))

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('should navigate back to Dashboard from Settings', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    await user.click(screen.getByRole('link', { name: 'Go to Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }))
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
