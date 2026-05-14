import { useEffect, useMemo, useState, type FC, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Divider,
  Dropdown,
  Input,
  Label,
  Option,
  SpinButton,
  Switch,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  ColorRegular,
  DismissRegular,
  PaintBrushRegular,
  TextFontRegular,
  WindowConsoleRegular,
} from '@fluentui/react-icons'
import { useLocale } from '@/hooks/useLocale'
import { usePreferences } from '@/hooks/usePreferences'
import type { AppThemePreference, LocalePreference } from '@/shared/preferencesTypes'
import type { ShellSummary } from '@/shared/shellTypes'
import { TERMINAL_THEMES } from '@/components/Terminal/terminalThemes'

export interface PreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreferencesSection = 'appearance' | 'terminal'

const useStyles = makeStyles({
  surface: {
    width: 'min(960px, 92vw)',
    maxWidth: 'min(960px, 92vw)',
    height: 'min(680px, 86vh)',
    maxHeight: 'min(680px, 86vh)',
  },
  body: {
    height: '100%',
    minHeight: 0,
  },
  title: {
    flexShrink: 0,
  },
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(200px, 1fr) minmax(0, 3fr)',
    minHeight: 0,
    height: '100%',
    padding: 0,
    overflow: 'hidden',
  },
  navigation: {
    minWidth: 0,
    padding: tokens.spacingHorizontalM,
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    overflowY: 'auto',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  navButton: {
    justifyContent: 'flex-start',
    width: '100%',
    minHeight: '34px',
    borderRadius: tokens.borderRadiusMedium,
  },
  navButtonActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    color: tokens.colorNeutralForeground1Selected,
    fontWeight: tokens.fontWeightSemibold,
    borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorCompoundBrandStroke}`,
  },
  detail: {
    minWidth: 0,
    padding: tokens.spacingHorizontalXL,
    overflow: 'auto',
  },
  detailInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    maxWidth: '720px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 220px) minmax(280px, 1fr)',
    alignItems: 'center',
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
  },
  control: {
    width: '100%',
    maxWidth: '360px',
  },
  themeOption: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  themeName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  swatchGroup: {
    display: 'flex',
    flexShrink: 0,
    gap: '2px',
  },
  swatch: {
    width: '10px',
    height: '10px',
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
})

function PreferenceSectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  const styles = useStyles()

  return (
    <div className={styles.sectionHeader}>
      {icon}
      <span>{title}</span>
    </div>
  )
}

function getShellDisplayName(shell: ShellSummary): string {
  return shell.group ? `${shell.name} (${shell.group})` : shell.name
}

export const PreferencesDialog: FC<PreferencesDialogProps> = ({ open, onOpenChange }) => {
  const styles = useStyles()
  const { t } = useTranslation()
  const {
    appThemePreference,
    terminalPreferences,
    setAppThemePreference,
    setTerminalFontFamily,
    setTerminalFontSize,
    setTerminalFontLigatures,
    setTerminalThemeId,
    setDefaultLocalShellId,
  } = usePreferences()
  const {
    localePreference,
    setLocalePreference,
    supportedLocales,
  } = useLocale()
  const [activeSection, setActiveSection] = useState<PreferencesSection>('appearance')
  const [localShells, setLocalShells] = useState<ShellSummary[]>([])

  useEffect(() => {
    if (!open) return

    async function loadLocalShells() {
      try {
        const summaries = await window.shellAPI.listShellSummaries()
        setLocalShells(
          summaries
            .filter(shell => shell.protocol === 'local')
            .sort((left, right) => left.name.localeCompare(right.name)),
        )
      } catch {
        setLocalShells([])
      }
    }

    void loadLocalShells()
  }, [open])

  const selectedShellLabel = useMemo(() => {
    const shell = localShells.find(item => item.id === terminalPreferences.defaultLocalShellId)
    return shell ? getShellDisplayName(shell) : t('preferences.terminal.defaultShellAuto')
  }, [localShells, t, terminalPreferences.defaultLocalShellId])

  const selectedTerminalTheme = useMemo(
    () => TERMINAL_THEMES.find(theme => theme.id === terminalPreferences.themeId) ?? TERMINAL_THEMES[0],
    [terminalPreferences.themeId],
  )

  function getLocaleLabel(preference: LocalePreference): string {
    return preference === 'system'
      ? t('preferences.option.system')
      : t(`locale.${preference}`)
  }

  function renderThemeOption(themeId: string): ReactNode {
    const themeDefinition = TERMINAL_THEMES.find(theme => theme.id === themeId) ?? TERMINAL_THEMES[0]
    const colors = [
      themeDefinition.theme.background,
      themeDefinition.theme.foreground,
      themeDefinition.theme.blue,
      themeDefinition.theme.green,
      themeDefinition.theme.red,
      themeDefinition.theme.yellow,
    ].filter((color): color is string => Boolean(color))

    return (
      <span className={styles.themeOption}>
        <span className={styles.swatchGroup} aria-hidden="true">
          {colors.map((color, index) => (
            <span
              className={styles.swatch}
              key={`${themeDefinition.id}-${index}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <span className={styles.themeName}>{themeDefinition.name}</span>
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <DialogTitle
            action={(
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label={t('common.close')}
                  icon={<DismissRegular />}
                  size="small"
                />
              </DialogTrigger>
            )}
            className={styles.title}
          >
            {t('preferences.title')}
          </DialogTitle>
          <DialogContent className={styles.content}>
            <aside className={styles.navigation}>
              <div className={styles.navList}>
                <Button
                  appearance="subtle"
                  className={mergeClasses(
                    styles.navButton,
                    activeSection === 'appearance' ? styles.navButtonActive : undefined,
                  )}
                  icon={<PaintBrushRegular />}
                  onClick={() => setActiveSection('appearance')}
                >
                  {t('preferences.navigation.appearance')}
                </Button>
                <Button
                  appearance="subtle"
                  className={mergeClasses(
                    styles.navButton,
                    activeSection === 'terminal' ? styles.navButtonActive : undefined,
                  )}
                  icon={<WindowConsoleRegular />}
                  onClick={() => setActiveSection('terminal')}
                >
                  {t('preferences.navigation.terminal')}
                </Button>
              </div>
            </aside>

            <div className={styles.detail}>
              <div className={styles.detailInner}>
                {activeSection === 'appearance' && (
                  <section className={styles.section}>
                    <PreferenceSectionTitle icon={<PaintBrushRegular />} title={t('preferences.appearance.section')} />
                    <div className={styles.fieldGrid}>
                      <Label htmlFor="preferences-app-theme">{t('preferences.appearance.appTheme')}</Label>
                      <Dropdown
                        className={styles.control}
                        id="preferences-app-theme"
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) {
                            setAppThemePreference(data.optionValue as AppThemePreference)
                          }
                        }}
                        selectedOptions={[appThemePreference]}
                        value={t(`preferences.theme.${appThemePreference}`)}
                      >
                        <Option value="system">{t('preferences.theme.system')}</Option>
                        <Option value="light">{t('preferences.theme.light')}</Option>
                        <Option value="dark">{t('preferences.theme.dark')}</Option>
                      </Dropdown>

                      <Label htmlFor="preferences-language">{t('preferences.appearance.language')}</Label>
                      <Dropdown
                        className={styles.control}
                        id="preferences-language"
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) {
                            setLocalePreference(data.optionValue as LocalePreference)
                          }
                        }}
                        selectedOptions={[localePreference]}
                        value={getLocaleLabel(localePreference)}
                      >
                        <Option value="system">{t('preferences.option.system')}</Option>
                        {supportedLocales.map(locale => (
                          <Option key={locale} value={locale}>
                            {t(`locale.${locale}`)}
                          </Option>
                        ))}
                      </Dropdown>
                    </div>
                  </section>
                )}

                {activeSection === 'terminal' && (
                  <>
                    <section className={styles.section}>
                      <PreferenceSectionTitle icon={<TextFontRegular />} title={t('preferences.terminal.fontSection')} />
                      <div className={styles.fieldGrid}>
                        <Label htmlFor="preferences-terminal-font">{t('preferences.terminal.fontFamily')}</Label>
                        <Input
                          className={styles.control}
                          id="preferences-terminal-font"
                          onChange={(_, data) => setTerminalFontFamily(data.value)}
                          value={terminalPreferences.fontFamily}
                        />

                        <Label htmlFor="preferences-terminal-font-size">{t('preferences.terminal.fontSize')}</Label>
                        <SpinButton
                          className={styles.control}
                          id="preferences-terminal-font-size"
                          max={32}
                          min={8}
                          onChange={(_, data) => {
                            const value = data.value ?? Number(data.displayValue)
                            if (Number.isFinite(value)) {
                              setTerminalFontSize(value)
                            }
                          }}
                          precision={0}
                          step={1}
                          value={terminalPreferences.fontSize}
                        />

                        <Label htmlFor="preferences-terminal-ligatures">{t('preferences.terminal.fontLigatures')}</Label>
                        <Switch
                          checked={terminalPreferences.fontLigatures}
                          id="preferences-terminal-ligatures"
                          onChange={(_, data) => setTerminalFontLigatures(data.checked)}
                        />
                      </div>
                    </section>

                    <Divider />

                    <section className={styles.section}>
                      <PreferenceSectionTitle icon={<ColorRegular />} title={t('preferences.terminal.themeSection')} />
                      <div className={styles.fieldGrid}>
                        <Label htmlFor="preferences-terminal-theme">{t('preferences.terminal.terminalTheme')}</Label>
                        <Dropdown
                          className={styles.control}
                          id="preferences-terminal-theme"
                          onOptionSelect={(_, data) => {
                            if (data.optionValue) {
                              setTerminalThemeId(data.optionValue)
                            }
                          }}
                          selectedOptions={[selectedTerminalTheme.id]}
                          value={selectedTerminalTheme.name}
                        >
                          {TERMINAL_THEMES.map(theme => (
                            <Option key={theme.id} text={theme.name} value={theme.id}>
                              {renderThemeOption(theme.id)}
                            </Option>
                          ))}
                        </Dropdown>
                      </div>
                    </section>

                    <Divider />

                    <section className={styles.section}>
                      <PreferenceSectionTitle icon={<WindowConsoleRegular />} title={t('preferences.terminal.defaultShellSection')} />
                      <div className={styles.fieldGrid}>
                        <Label htmlFor="preferences-default-shell">{t('preferences.terminal.defaultShell')}</Label>
                        <Dropdown
                          className={styles.control}
                          id="preferences-default-shell"
                          onOptionSelect={(_, data) => {
                            setDefaultLocalShellId(data.optionValue === 'auto' ? null : data.optionValue ?? null)
                          }}
                          selectedOptions={[terminalPreferences.defaultLocalShellId ?? 'auto']}
                          value={selectedShellLabel}
                        >
                          <Option value="auto">{t('preferences.terminal.defaultShellAuto')}</Option>
                          {localShells.map(shell => (
                            <Option key={shell.id} value={shell.id}>
                              {getShellDisplayName(shell)}
                            </Option>
                          ))}
                        </Dropdown>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
