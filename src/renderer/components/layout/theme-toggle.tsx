import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useTheme } from '@renderer/hooks/use-theme'
import { cn } from '@renderer/lib/utils'
import type { ThemeMode } from '@renderer/store/theme-store'

const themeOrder: ThemeMode[] = ['light', 'dark', 'system']

const themeConfig = {
  light: {
    icon: Sun,
    label: 'Light',
    ariaLabel: 'Current theme: Light. Click to switch to Dark mode.',
  },
  dark: {
    icon: Moon,
    label: 'Dark',
    ariaLabel: 'Current theme: Dark. Click to switch to System mode.',
  },
  system: {
    icon: Monitor,
    label: 'System',
    ariaLabel: 'Current theme: System. Click to switch to Light mode.',
  },
} as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const handleCycle = () => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  const config = themeConfig[theme]
  const Icon = config.icon

  return (
    <Button variant="ghost" size="sm" onClick={handleCycle} aria-label={config.ariaLabel}>
      <Icon className={cn('h-4 w-4')} />
      <span className={cn('group-data-[collapsible=icon]:hidden')}>{config.label}</span>
    </Button>
  )
}
