import { Sun, Moon, Monitor } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { Label } from '@renderer/components/ui/label'
import { useThemeStore } from '@renderer/store'
import type { ThemeMode } from '@renderer/store'

const themeOptions: { value: ThemeMode; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    description: 'Use a light color scheme with bright backgrounds.',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Use a dark color scheme that is easier on the eyes.',
  },
  {
    value: 'system',
    label: 'System',
    icon: Monitor,
    description: 'Automatically match your operating system theme.',
  },
]

export function AppearanceSettings() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const currentOption = themeOptions.find((o) => o.value === theme)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">Theme</h3>
        <p className="text-sm text-muted-foreground mb-4">Select your preferred color scheme.</p>
      </div>

      <RadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeMode)}>
        <div className="grid gap-3">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <Label
              key={value}
              htmlFor={`theme-${value}`}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value={value} id={`theme-${value}`} />
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
            </Label>
          ))}
        </div>
      </RadioGroup>

      {currentOption && <p className="text-sm text-muted-foreground">{currentOption.description}</p>}
    </div>
  )
}
