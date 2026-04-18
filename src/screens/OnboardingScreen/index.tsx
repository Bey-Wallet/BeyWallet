import React, { useState } from 'react'
import { WelcomeStep } from './WelcomeStep'
import { CreatingStep } from './CreatingStep'
import { SeedStep } from './SeedStep'
import { BiometricStep } from './BiometricStep'
import { ImportSeedStep } from './ImportSeedStep'
import { MintConfirmationStep } from './MintConfirmationStep'
import { RestoreProgressStep } from './RestoreProgressStep'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useSettingsStore } from '../../store/settingsStore'
import { seedService } from '../../services/seedService'
import { initService, mintManager, nostrService } from '../../services/core'
import { useWalletStore } from '../../store/walletStore'
import { walletFileService } from '../../services/walletFileService'
import { ActivityIndicator, Alert } from 'react-native'
import { YStack, Text } from 'tamagui'
import { DEFAULT_MINT } from '../../store/constants'
import { Buffer } from 'buffer'

export function OnboardingScreen() {
    const { currentStep, setStep, setGeneratedMnemonic, generatedMnemonic, completeOnboarding } = useOnboardingStore()
    const initialize = useWalletStore(state => state.initialize)
    const restoreAllMints = useWalletStore(state => state.restoreAllMints)
    const mintRestoreStatuses = useWalletStore(state => state.mintRestoreStatuses)
    const isRestoring = useWalletStore(state => state.isRestoring)

    const [isImporting, setIsImporting] = useState(false)
    const [isFinishing, setIsFinishing] = useState(false)
    const [importStatus, setImportStatus] = useState('')
    // Extra mints from a backup file
    const [extraRestoreMints, setExtraRestoreMints] = useState<string[]>([])

    // ── Navigation ──────────────────────────────────────────────

    const handleCreateWallet = () => setStep('creating')
    const handleImportWallet = () => setStep('import')

    const handleCreatingComplete = (mnemonic: string) => {
        setGeneratedMnemonic(mnemonic)
        setStep('seed')
    }

    const handleSeedContinue = () => setStep('biometric')

    // After biometric → go to mint picker (new wallet flow only)
    const handleBiometricComplete = async () => {
        if (!generatedMnemonic) {
            console.error('[Onboarding] No mnemonic found')
            return
        }

        setIsFinishing(true)
        try {
            await initService.createWallet(generatedMnemonic)
            await useSettingsStore.getState().initialize(true)
            await initialize()
        } catch (err) {
            console.error('[Onboarding] Failed to init wallet:', err)
            setIsFinishing(false)
            return
        }
        setIsFinishing(false)

        // Move to mint picker — wallet is ready but onboarding not yet marked complete
        setStep('mintpicker')
    }

    // Called when user confirms default mints on new wallet
    const handleMintPickerComplete = async (selectedMintUrls: string[]) => {
        setIsFinishing(true)
        try {
            // Add all selected mints
            for (const url of selectedMintUrls) {
                await mintManager.addMint(url, { trusted: true })
            }

            // Restore from the first one as a baseline (minibits)
            if (selectedMintUrls.length > 0) {
                await useSettingsStore.getState().setDefaultMintUrl(selectedMintUrls[0])
            }

            await completeOnboarding()
        } catch (err) {
            console.error('[Onboarding] mint confirmation failed:', err)
        } finally {
            setIsFinishing(false)
        }
    }

    const handleMintPickerSkip = async () => {
        setIsFinishing(true)
        try {
            await completeOnboarding()
        } finally {
            setIsFinishing(false)
        }
    }

    // ── Seed import (restore flow) ──────────────────────────────

    const handleImportSeed = async (mnemonic: string, options: {
        additionalMints?: string[],
        backupState?: any
    } = {}) => {
        const { additionalMints = [], backupState } = options
        setIsImporting(true)
        setImportStatus('Initializing wallet…')
        try {
            console.log('[Onboarding] Importing wallet from seed...')

            // Check Nostr for mint backups
            let nostrMints: string[] = []
            try {
                setImportStatus('Checking for Nostr backups…')
                const keys = await seedService.getNostrKeys(mnemonic)
                // keys.pubkey is already a hex string in modern nostr-tools
                const pubkeyHex = keys.pubkey
                nostrMints = await nostrService.fetchMintsFromNostr(pubkeyHex)
                
                if (nostrMints.length === 0) {
                    Alert.alert('Nostr Restore', 'No mints found in Nostr backup.')
                } else {
                    console.log(`[Onboarding] Found ${nostrMints.length} mints in Nostr backup`)
                }
            } catch (err) {
                console.warn('[Onboarding] Failed to fetch Nostr backup mints:', err)
            }

            setImportStatus('Initializing wallet…')
            // 1. Setup the wallet and repositories
            // Use quiet mode if we have a backupState to avoid DB locks during insertion
            await initService.restoreWallet(mnemonic, { quiet: !!backupState })

            // 2. If we have full backup state (v3), import it into the DB now
            if (backupState) {
                setImportStatus('Restoring balance and history…')
                const { backupService } = require('~/services/backupService')
                await backupService.importState(backupState)

                // IMPORTANT: Re-initialize to pick up the imported state (mints, keysets, etc.)
                console.log('[Onboarding] Refreshing wallet state after import...')
                await initService.reinitFast()
                console.log('[Onboarding] Full state imported and synced successfully')
            }

            // 3. Store extra mints (from backup file + Nostr backup) for the restore step
            const combinedMints = Array.from(new Set([...additionalMints, ...nostrMints]))
            setExtraRestoreMints(combinedMints)

            // 4. Decide if we need the slow "restoring" step or can go home
            // If we have proofs (money) already in the DB from backup, skip the scan
            const hasFunds = backupState && backupState.proofs && backupState.proofs.length > 0

            if (hasFunds) {
                console.log('[Onboarding] Found funds in backup, skipping deterministic scan.')
                setImportStatus('Welcome back! Finalizing…')
                await completeOnboarding()
                await useSettingsStore.getState().initialize(true)
                await initialize()
            } else {
                console.log('[Onboarding] Navigating to restore progress step...')
                await useSettingsStore.getState().initialize(true)
                setStep('restoring')
            }
        } catch (err) {
            console.error('[Onboarding] Import failed:', err)
            setImportStatus('Import failed. Please try again.')
        } finally {
            setIsImporting(false)
        }
    }

    // Called when RestoreProgressStep mounts — start the actual multi-mint restore
    const handleRestoreStart = () => {
        restoreAllMints(extraRestoreMints)
    }

    // Called when user taps "Go to Wallet" on the progress screen
    const handleRestoreDone = async () => {
        console.log('[Onboarding] Restore done, going home')
        await completeOnboarding()
        await initialize()
    }

    // ── File import (restore from .bey backup file) ─────────────

    const handleImportFromFile = async () => {
        try {
            const backup = await walletFileService.importWalletFromFile()

            // Collect extra mints for the restore screen (v1/v2 compatibility)
            // In v3, backup.mints is already the full database records.
            const extraMints = (backup.mints ?? [])
                .map((m: any) => typeof m === 'string' ? m : (m.url || m.mintUrl))
                .filter((url: string) => url && url !== DEFAULT_MINT)

            // Package up the state if version >= 3
            let backupState: any = undefined
            if (backup.version && backup.version >= 3) {
                backupState = {
                    mints: backup.mints,
                    keysets: backup.keysets,
                    proofs: backup.proofs,
                    counters: backup.counters,
                    history: backup.history,
                    mintQuotes: backup.mintQuotes,
                }
            }

            // Standard seed restore — passes extra mints for the progress screen
            await handleImportSeed(backup.mnemonic, {
                additionalMints: extraMints,
                backupState
            })

            // Restore settings from backup
            const settingsStore = useSettingsStore.getState()
            if (backup.secondaryCurrency) await settingsStore.setSecondaryCurrency(backup.secondaryCurrency)
            if (backup.theme) await settingsStore.setTheme(backup.theme)
            if (backup.defaultMintUrl) await settingsStore.setDefaultMintUrl(backup.defaultMintUrl)
        } catch (err: any) {
            const message = err?.message ?? 'Failed to import wallet from file.'
            if (message !== 'File selection was cancelled.') {
                Alert.alert('Import Failed', message)
            }
        }
    }

    // ── Loading overlay ─────────────────────────────────────────

    if (isImporting || isFinishing) {
        return (
            <YStack flex={1} bg="$background" items="center" justify="center" gap="$4">
                <ActivityIndicator size="large" color="#666" />
                <Text fontSize="$6" fontWeight="700" color="$color">
                    {isImporting ? 'Importing wallet...' : 'Setting up wallet...'}
                </Text>
                <Text color="$gray10" fontSize="$3" text="center" px="$6">
                    {isImporting
                        ? importStatus
                        : 'Preparing your secure wallet. This may take a few moments.'}
                </Text>
            </YStack>
        )
    }

    // ── Step router ─────────────────────────────────────────────

    switch (currentStep) {
        case 'welcome':
            return (
                <WelcomeStep
                    onCreateWallet={handleCreateWallet}
                    onImportWallet={handleImportWallet}
                    onImportFromFile={handleImportFromFile}
                />
            )

        case 'creating':
            return (
                <CreatingStep
                    onComplete={handleCreatingComplete}
                    generateMnemonic={seedService.generateMnemonic}
                />
            )

        case 'seed':
            if (!generatedMnemonic) { setStep('welcome'); return null }
            return (
                <SeedStep
                    mnemonic={generatedMnemonic}
                    onContinue={handleSeedContinue}
                />
            )

        case 'biometric':
            return <BiometricStep onComplete={handleBiometricComplete} />

        case 'mintpicker':
            return (
                <MintConfirmationStep
                    onComplete={handleMintPickerComplete}
                    onSkip={handleMintPickerSkip}
                />
            )

        case 'import':
            return (
                <ImportSeedStep
                    onImport={(mnemonic) => handleImportSeed(mnemonic, {})}
                    onBack={() => setStep('welcome')}
                />
            )

        case 'restoring': {
            const totalRestoredSats = mintRestoreStatuses
                .filter(e => e.status === 'done')
                .reduce((sum, e) => sum + e.restoredBalance, 0)

            // Fire restore on first render of this step
            return (
                <RestoreProgressStepWrapper
                    entries={mintRestoreStatuses}
                    isRestoring={isRestoring}
                    totalRestoredSats={totalRestoredSats}
                    onStart={handleRestoreStart}
                    onDone={handleRestoreDone}
                />
            )
        }

        default:
            return (
                <WelcomeStep
                    onCreateWallet={handleCreateWallet}
                    onImportWallet={handleImportWallet}
                    onImportFromFile={handleImportFromFile}
                />
            )
    }
}

// ── Wrapper that fires restoreAllMints on mount ──────────────────────────────

function RestoreProgressStepWrapper({
    entries,
    isRestoring,
    totalRestoredSats,
    onStart,
    onDone,
}: {
    entries: ReturnType<typeof useWalletStore.getState>['mintRestoreStatuses']
    isRestoring: boolean
    totalRestoredSats: number
    onStart: () => void
    onDone: () => void
}) {
    const [started, setStarted] = React.useState(false)

    React.useEffect(() => {
        if (!started) {
            setStarted(true)
            onStart()
        }
    }, [])

    return (
        <RestoreProgressStep
            entries={entries}
            isRestoring={isRestoring}
            totalRestoredSats={totalRestoredSats}
            onDone={onDone}
        />
    )
}

