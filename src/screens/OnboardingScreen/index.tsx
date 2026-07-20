import React, { useState } from 'react'
import { WelcomeStep } from './WelcomeStep'
import { CreatingWalletSheet } from './CreatingWalletSheet'
import { SeedStep } from './SeedStep'
import { BiometricStep } from './BiometricStep'
import { NotificationStep } from './NotificationStep'
import { ProcessingSheet } from '~/components/UI/ProcessingSheet'
import { NostrStep } from './NostrStep'
import { ImportSeedStep } from './ImportSeedStep'
import { MintConfirmationStep } from './MintConfirmationStep'
import { RestoreProgressStep } from './RestoreProgressStep'
import { ConsentStep } from './ConsentStep'
import { PermissionsStep } from './PermissionsStep'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useSettingsStore } from '../../store/settingsStore'
import { seedService } from '../../services/seedService'
import { initService, mintManager, nostrService } from '../../services/core'
import { useWalletStore } from '../../store/walletStore'
import { useAuthStore } from '../../store/authStore'
import { walletFileService } from '../../services/walletFileService'
import { ActivityIndicator, Alert } from 'react-native'
import { YStack, Text } from 'tamagui'
import { DEFAULT_MINT } from '../../store/constants'
import { generateDeterministicUsername, registerNip05Username } from '../../utils/username'
import { Buffer } from 'buffer'
import { Flex } from '~/components/UI/Flex'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function OnboardingScreen() {
    const { currentStep, setStep, setGeneratedMnemonic, generatedMnemonic, completeOnboarding, resetOnboarding } = useOnboardingStore()
    const initialize = useWalletStore(state => state.initialize)
    const restoreAllMints = useWalletStore(state => state.restoreAllMints)
    const mintRestoreStatuses = useWalletStore(state => state.mintRestoreStatuses)
    const isRestoring = useWalletStore(state => state.isRestoring)

    const [isImporting, setIsImporting] = useState(false)
    const [isFinishing, setIsFinishing] = useState(false)
    const [importStatus, setImportStatus] = useState('')
    const [tempUsername, setTempUsername] = useState('anon')
    const [tempNpub, setTempNpub] = useState('')
    const [isImportingFlow, setIsImportingFlow] = useState(false)
    const [tempBackupState, setTempBackupState] = useState<any>(null)
    const [finishingStatus, setFinishingStatus] = useState('Preparing your secure wallet. This may take a few moments.')
    // Extra mints from a backup file
    const [extraRestoreMints, setExtraRestoreMints] = useState<string[]>([])
    const [hasSavedWallet, setHasSavedWallet] = useState(false)

    // Check on mount if a wallet exists but onboarding was not completed
    React.useEffect(() => {
        const checkWallet = async () => {
            const exists = await initService.walletExists()
            setHasSavedWallet(exists)
        }
        checkWallet()
    }, [])

    const handleResumeRestore = async () => {
        setIsFinishing(true)
        try {
            console.log('[Onboarding] Resuming saved wallet setup...')
            await initService.init()
            await useSettingsStore.getState().initialize(true)
            await initialize()
            setStep('restoring')
        } catch (err) {
            console.error('[Onboarding] Failed to resume wallet:', err)
            Alert.alert('Resume Failed', 'Failed to open saved wallet. You may need to delete it and start over.')
        } finally {
            setIsFinishing(false)
        }
    }

    const handleDeleteSavedWallet = async () => {
        setIsFinishing(true)
        try {
            console.log('[Onboarding] Deleting existing wallet to start over...')
            await initService.destroyWallet()
            await resetOnboarding()
            setHasSavedWallet(false)
            setStep('welcome')
        } catch (err) {
            console.error('[Onboarding] Failed to delete wallet:', err)
            Alert.alert('Error', 'Failed to completely delete the wallet.')
        } finally {
            setIsFinishing(false)
        }
    }

    // ── Navigation ──────────────────────────────────────────────

    const handleCreateWallet = () => {
        setIsImportingFlow(false)
        setStep('consent')
    }
    const handleImportWallet = () => {
        setIsImportingFlow(true)
        setStep('import')
    }

    const handleConsentComplete = () => {
        if (isImportingFlow) {
            setStep('import')
        } else {
            setStep('creating')
        }
    }

    const handleCreatingComplete = async (mnemonic: string) => {
        setGeneratedMnemonic(mnemonic)
        try {
            const keys = await seedService.getNostrKeys(mnemonic)
            setTempNpub(keys.npub)
            const genName = generateDeterministicUsername(keys.pubkey)
            setTempUsername(genName)
        } catch (e) {
            setTempUsername('anon')
        }
        setStep('permissions')
    }

    const handlePermissionsComplete = async (username: string, isBiometricEnabled: boolean) => {
        if (!generatedMnemonic) {
            setStep('welcome')
            return
        }

        setIsFinishing(true)
        try {
            const keys = await seedService.getNostrKeys(generatedMnemonic)
            const pubkeyHex = keys.pubkey
            const privkeyHex = keys.privkey

            if (isImportingFlow) {
                setFinishingStatus('Initializing wallet…')
                await initService.restoreWallet(generatedMnemonic, { quiet: !!tempBackupState })

                await useSettingsStore.getState().setBiometricEnabled(isBiometricEnabled)
                await useSettingsStore.getState().initialize(true)

                if (tempBackupState) {
                    setFinishingStatus('Restoring balance and history…')
                    const { backupService } = require('~/services/backupService')
                    await backupService.importState(tempBackupState)

                    console.log('[Onboarding] Refreshing wallet state after import...')
                    await initService.reinitFast()
                }

                await initialize()

                // Try NIP-05 registration just in case they modified or generated a new one
                try {
                    setFinishingStatus('Registering profile…')
                    const registerResult = await registerNip05Username(username, pubkeyHex, privkeyHex)
                    if (registerResult.ok && registerResult.nip05) {
                        await useSettingsStore.getState().setNip05(registerResult.nip05)
                    } else {
                        await useSettingsStore.getState().setNip05(`${username.toLowerCase()}@bey.cash`)
                    }
                } catch (err) {
                    await useSettingsStore.getState().setNip05(`${username.toLowerCase()}@bey.cash`)
                }

                await mintManager.addMint(DEFAULT_MINT, { trusted: true })
                await useSettingsStore.getState().setDefaultMintUrl(DEFAULT_MINT)

                const hasFunds = tempBackupState && tempBackupState.proofs && tempBackupState.proofs.length > 0

                if (!hasFunds) {
                    console.log('[Onboarding] Kicking off multi-mint scanning in background...')
                    restoreAllMints(extraRestoreMints)
                }

                setFinishingStatus('Finalizing setup…')
                await completeOnboarding()
                useAuthStore.getState().setAuthenticated(true)
            } else {
                setFinishingStatus('Creating secure keypair…')
                await initService.createWallet(generatedMnemonic)
                await useSettingsStore.getState().setBiometricEnabled(isBiometricEnabled)
                await useSettingsStore.getState().initialize(true)
                await initialize()

                try {
                    setFinishingStatus('Registering username…')
                    const registerResult = await registerNip05Username(username, pubkeyHex, privkeyHex)
                    if (registerResult.ok && registerResult.nip05) {
                        await useSettingsStore.getState().setNip05(registerResult.nip05)
                    } else {
                        await useSettingsStore.getState().setNip05(`${username.toLowerCase()}@bey.cash`)
                    }
                } catch (err) {
                    await useSettingsStore.getState().setNip05(`${username.toLowerCase()}@bey.cash`)
                }

                await mintManager.addMint(DEFAULT_MINT, { trusted: true })
                await useSettingsStore.getState().setDefaultMintUrl(DEFAULT_MINT)

                setFinishingStatus('Finalizing setup…')
                await completeOnboarding()
                useAuthStore.getState().setAuthenticated(true)
            }
        } catch (err) {
            console.error('[Onboarding] Onboarding completion failed:', err)
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
            let keys: any = null
            try {
                setImportStatus('Checking for Nostr backups…')
                keys = await seedService.getNostrKeys(mnemonic)
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

            if (!keys) {
                keys = await seedService.getNostrKeys(mnemonic)
            }

            const pubkeyHex = keys.pubkey

            // Remote NIP-05 username lookup
            let fetchedUsername: string | null = null
            try {
                setImportStatus('Checking for registered username…')
                const response = await fetch('https://bey.cash/.well-known/nostr.json')
                if (response.ok) {
                    const data = await response.json()
                    const names = data?.names || {}
                    for (const [name, val] of Object.entries(names)) {
                        if (typeof val === 'string' && val.toLowerCase() === pubkeyHex.toLowerCase()) {
                            fetchedUsername = name
                            break
                        }
                    }
                }
            } catch (err) {
                console.warn('[Onboarding] Remote NIP-05 lookup failed:', err)
            }

            if (fetchedUsername) {
                console.log(`[Onboarding] Found remote username: ${fetchedUsername}`)
                setTempUsername(fetchedUsername)
            } else {
                const genName = generateDeterministicUsername(pubkeyHex)
                setTempUsername(genName)
            }

            // Save variables for execution inside handlePermissionsComplete
            setGeneratedMnemonic(mnemonic)
            setTempNpub(keys.npub)
            setTempBackupState(backupState)

            const combinedMints = Array.from(new Set([...additionalMints, ...nostrMints]))
            setExtraRestoreMints(combinedMints)

            setIsImporting(false)
            setStep('permissions')
        } catch (err) {
            console.error('[Onboarding] Import failed:', err)
            setImportStatus('Import failed. Please try again.')
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
        useAuthStore.getState().setAuthenticated(true)
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

            // Package up the state if proofs exist in the backup (v3 or cashu.me compatible)
            let backupState: any = undefined
            if (backup.proofs && backup.proofs.length > 0) {
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
    // Replaced by ProcessingSheet in the render tree below
    
    // ── Step router ─────────────────────────────────────────────
    
    const insets = useSafeAreaInsets()
    const renderStep = () => {
        switch (currentStep) {
        case 'creating':
        case 'welcome':
        default:
            return (
    
   
        <Flex fill bg="$background" pb={insets.bottom || 16}>
           
        
    
                    <WelcomeStep
                        onCreateWallet={handleCreateWallet}
                        onImportWallet={handleImportWallet}
                        onImportFromFile={handleImportFromFile}
                        hasSavedWallet={hasSavedWallet}
                        onOpenSavedWallet={handleResumeRestore}
                        onDeleteSavedWallet={handleDeleteSavedWallet}
                    />
                    <CreatingWalletSheet
                        open={currentStep === 'creating'}
                        onComplete={handleCreatingComplete}
                        generateMnemonic={seedService.generateMnemonic}
                    />
               </Flex>
            )

        case 'consent':
            return (
                <ConsentStep
                    onComplete={handleConsentComplete}
                    onBack={() => setStep('welcome')}
                />
            )

        case 'permissions':
            return (
                <PermissionsStep
                    initialUsername={tempUsername}
                    npub={tempNpub}
                    onComplete={handlePermissionsComplete}
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
        } // close switch
    } // close renderStep

    return (
        <YStack flex={1}>
            {renderStep()}
            
            <ProcessingSheet 
                visible={isImporting || isFinishing}
                status="processing"
                title={isImporting ? 'Importing wallet...' : 'Setting up wallet...'}
                detail={isImporting ? importStatus : finishingStatus}
            />
        </YStack>
    )
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

