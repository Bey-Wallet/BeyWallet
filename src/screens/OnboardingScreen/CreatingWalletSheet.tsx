import React, { useEffect, useState, useRef } from 'react'
import { YStack } from 'tamagui'
import { ProcessingSheet } from '~/components/UI/ProcessingSheet'
import * as Haptics from 'expo-haptics'

interface CreatingWalletSheetProps {
    open: boolean
    onComplete: (mnemonic: string) => void
    generateMnemonic: () => string
}

type ProgressStep = {
    id: string
    label: string
    status: 'pending' | 'active' | 'complete'
}

export function CreatingWalletSheet({ open, onComplete, generateMnemonic }: CreatingWalletSheetProps) {
    const [currentDetail, setCurrentDetail] = useState('Gathering entropy...')

    useEffect(() => {
        if (open) {
            runCreation()
        } else {
            setCurrentDetail('Gathering entropy...')
        }
    }, [open])

    const runCreation = async () => {
        let cancelled = false
        
        setCurrentDetail('Gathering entropy...')
        await delay(800)
        if (cancelled) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        setCurrentDetail('Generating seed phrase...')
        await delay(600)
        const generatedMnemonic = generateMnemonic()
        if (cancelled) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        setCurrentDetail('Deriving keys...')
        await delay(700)
        if (cancelled) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        setCurrentDetail('Securing wallet...')
        await delay(500)
        if (cancelled) return
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        setCurrentDetail('Done!')
        await delay(400)
        if (cancelled) return
        
        if (generatedMnemonic) {
            onComplete(generatedMnemonic)
        }
    }

    return (
        <ProcessingSheet
            visible={open}
            title="Creating Your Wallet"
            detail={currentDetail}
            status="processing"
        />
    )
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}
