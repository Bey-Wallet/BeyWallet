/**
 * Wallet File Service — Export & Import wallet backup as a .bey file.
 *
 * Backup JSON shape (v2):
 * {
 *   version: 3,
 *   mnemonic: "...",
 *   mints: [...], // Full coco_cashu_mints records
 *   keysets: [...], // Full coco_cashu_keysets records
 *   proofs: [...],
 *   counters: [...],
 *   history: [...],
 *   mintQuotes: [...],
 *   defaultMintUrl: "...",
 *   secondaryCurrency: "USD",
 *   theme: "system" | "light" | "dark",
 *   exportedAt: "ISO date"
 * }
 * }
 * }
 *
 * Export flow:
 *   1. Reads mnemonic, trusted mints, and settings from the live stores/repos
 *   2. Serialises to JSON and writes to cache dir
 *   3. Opens OS share sheet via expo-sharing
 *
 * Import flow:
 *   1. Opens document picker
 *   2. Reads + parses JSON, validates mnemonic
 *   3. Returns the full backup payload for the caller to handle
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as bip39 from 'bip39';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';

const BACKUP_VERSION = 3;

export interface MintEntry {
    url: string;
    nickname: string | null;
}

export interface WalletBackup {
    version: number;
    mnemonic: string;
    mints: any[]; // Changed from MintEntry[] to any[] for full records in v3
    keysets?: any[];
    proofs?: any[];
    counters?: any[];
    history?: any[];
    mintQuotes?: any[];
    defaultMintUrl: string;
    secondaryCurrency: string;
    theme: 'system' | 'light' | 'dark';
    exportedAt: string;
}

function getFormattedDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export const walletFileService = {
    /**
     * Export the full wallet backup as a stamped .json file.
     * On Android, saves directly to the user's selected Downloads/Backups directory.
     * On iOS, uses standard Share Sheet.
     */
    exportWallet: async (
        mnemonic: string,
        opts: {
            mints: any[];
            keysets: any[];
            proofs: any[];
            counters: any[];
            history: any[];
            mintQuotes: any[];
            defaultMintUrl: string;
            secondaryCurrency: string;
            theme: 'system' | 'light' | 'dark';
        }
    ): Promise<string> => {
        console.log('[WalletFileService] Exporting wallet backup...');

        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic — cannot export.');
        }

        const backup: WalletBackup = {
            version: 3,
            mnemonic,
            mints: opts.mints,
            keysets: opts.keysets,
            proofs: opts.proofs,
            counters: opts.counters,
            history: opts.history,
            mintQuotes: opts.mintQuotes,
            defaultMintUrl: opts.defaultMintUrl,
            secondaryCurrency: opts.secondaryCurrency,
            theme: opts.theme,
            exportedAt: new Date().toISOString(),
        };

        const fileName = `bey_wallet_backup_${getFormattedDate()}.json`;
        const serialized = JSON.stringify(backup, null, 2);

        if (Platform.OS === 'android') {
            const settingsStore = useSettingsStore.getState();
            let uri = settingsStore.backupDirectoryUri;

            if (!uri) {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (!permissions.granted) {
                    throw new Error('Permission to choose backup directory was denied.');
                }
                uri = permissions.directoryUri;
                await settingsStore.setBackupDirectoryUri(uri);
            }

            let fileUri: string;
            try {
                fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    uri,
                    fileName,
                    'application/json'
                );
            } catch {
                // If it fails (e.g. permission revoked), prompt directory selection again
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (!permissions.granted) {
                    throw new Error('Permission to choose backup directory was denied.');
                }
                uri = permissions.directoryUri;
                await settingsStore.setBackupDirectoryUri(uri);
                fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    uri,
                    fileName,
                    'application/json'
                );
            }

            await FileSystem.writeAsStringAsync(fileUri, serialized, {
                encoding: 'utf8',
            });
            console.log(`[WalletFileService] ✅ Saved directly to: ${fileUri}`);
            return fileName;
        } else {
            // iOS: Write to temporary directory and show share sheet
            const filePath =
                (FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '') +
                fileName;

            await FileSystem.writeAsStringAsync(filePath, serialized, {
                encoding: 'utf8',
            });

            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                throw new Error('Sharing is not available on this device.');
            }

            await Sharing.shareAsync(filePath, {
                mimeType: 'application/json',
                dialogTitle: 'Save your Bey Wallet backup',
                UTI: 'public.json',
            });

            console.log('[WalletFileService] ✅ Shared backup file.');
            return fileName;
        }
    },

    /**
     * Open the document picker and parse a backup file (.json or .bey).
     * Returns the full WalletBackup payload so the caller can restore everything.
     */
    importWalletFromFile: async (): Promise<WalletBackup> => {
        console.log('[WalletFileService] Opening document picker...');

        const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            multiple: false,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
            throw new Error('File selection was cancelled.');
        }

        const asset = result.assets[0];
        console.log('[WalletFileService] File selected:', asset.name);

        const contents = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'utf8',
        });

        let backup: Partial<WalletBackup>;
        try {
            backup = JSON.parse(contents);
        } catch {
            throw new Error('The selected file is not a valid Bey wallet backup.');
        }

        let mnemonic = backup.mnemonic;
        if (!mnemonic && (backup as any)['cashu.mnemonic']) {
            mnemonic = (backup as any)['cashu.mnemonic'];
        }

        if (!mnemonic || typeof mnemonic !== 'string') {
            throw new Error('The backup file does not contain a mnemonic.');
        }

        if (!bip39.validateMnemonic(mnemonic.trim())) {
            throw new Error('The mnemonic in the backup file is invalid. It may be corrupted.');
        }

        // Extract proofs from cashu.me if double-serialized
        let proofs = backup.proofs ?? [];
        if (proofs.length === 0 && (backup as any)['cashu.dexie.db.proofs']) {
            try {
                proofs = JSON.parse((backup as any)['cashu.dexie.db.proofs']);
            } catch (e) {
                console.warn('[WalletFileService] Failed to parse cashu.me dexie proofs:', e);
            }
        }

        // Extract defaultMintUrl from cashu.me
        let defaultMintUrl = backup.defaultMintUrl ?? '';
        if (!defaultMintUrl && (backup as any)['cashu.activeMintUrl']) {
            defaultMintUrl = (backup as any)['cashu.activeMintUrl'];
        }

        // Extract secondaryCurrency from cashu.me
        let secondaryCurrency = backup.secondaryCurrency ?? 'USD';
        if (secondaryCurrency === 'USD' && (backup as any)['cashu.settings.bitcoinPriceCurrency']) {
            secondaryCurrency = (backup as any)['cashu.settings.bitcoinPriceCurrency'];
        }

        console.log('[WalletFileService] ✅ Valid wallet backup parsed successfully.');

        // Return with safe defaults for fields that may be missing in older v1/v2 backups
        return {
            version: backup.version ?? 1,
            mnemonic: mnemonic.trim(),
            mints: backup.mints ?? [],
            keysets: backup.keysets ?? [],
            proofs,
            counters: backup.counters ?? [],
            history: backup.history ?? [],
            mintQuotes: backup.mintQuotes ?? [],
            defaultMintUrl,
            secondaryCurrency,
            theme: backup.theme ?? 'system',
            exportedAt: backup.exportedAt ?? '',
        };
    },

    /**
     * Export active proofs as a .json file containing the proofs array.
     */
    exportProofsToFile: async (proofs: any[]): Promise<string> => {
        console.log('[WalletFileService] Exporting proofs to file...');
        const payload = {
            type: 'bey-cashu-proofs',
            proofs,
            exportedAt: new Date().toISOString(),
        };

        const fileName = `bey_cashu_proofs_${getFormattedDate()}.json`;
        const serialized = JSON.stringify(payload, null, 2);

        if (Platform.OS === 'android') {
            const settingsStore = useSettingsStore.getState();
            let uri = settingsStore.backupDirectoryUri;

            if (!uri) {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (!permissions.granted) {
                    throw new Error('Permission to choose backup directory was denied.');
                }
                uri = permissions.directoryUri;
                await settingsStore.setBackupDirectoryUri(uri);
            }

            let fileUri: string;
            try {
                fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    uri,
                    fileName,
                    'application/json'
                );
            } catch {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (!permissions.granted) {
                    throw new Error('Permission to choose backup directory was denied.');
                }
                uri = permissions.directoryUri;
                await settingsStore.setBackupDirectoryUri(uri);
                fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    uri,
                    fileName,
                    'application/json'
                );
            }

            await FileSystem.writeAsStringAsync(fileUri, serialized, {
                encoding: 'utf8',
            });
            console.log(`[WalletFileService] ✅ Proofs saved directly to: ${fileUri}`);
            return fileName;
        } else {
            const filePath =
                (FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '') +
                fileName;

            await FileSystem.writeAsStringAsync(filePath, serialized, {
                encoding: 'utf8',
            });

            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                throw new Error('Sharing is not available on this device.');
            }

            await Sharing.shareAsync(filePath, {
                mimeType: 'application/json',
                dialogTitle: 'Export Cashu Proofs File',
                UTI: 'public.json',
            });

            return fileName;
        }
    },

    /**
     * Import proofs from a selected .json file.
     * Returns the array of proofs.
     */
    importProofsFromFile: async (): Promise<any[]> => {
        console.log('[WalletFileService] Importing proofs from file...');
        const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            multiple: false,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
            throw new Error('File selection was cancelled.');
        }

        const asset = result.assets[0];
        const contents = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'utf8',
        });

        let data: any;
        try {
            data = JSON.parse(contents);
        } catch {
            throw new Error('The selected file is not a valid JSON file.');
        }

        let proofsArray: any[] = [];
        if (data && data.type === 'bey-cashu-proofs' && Array.isArray(data.proofs)) {
            proofsArray = data.proofs;
        } else if (Array.isArray(data)) {
            proofsArray = data;
        } else if (data && typeof data === 'object' && 'cashu.dexie.db.proofs' in data) {
            try {
                // cashu.me double serialises proofs list in backup as a JSON string
                const proofsStr = data['cashu.dexie.db.proofs'];
                proofsArray = JSON.parse(proofsStr);
            } catch {
                throw new Error('Could not parse the cashu.me proofs database string inside the backup file.');
            }
        } else {
            throw new Error('The file does not contain a valid list of Cashu proofs.');
        }

        for (const proof of proofsArray) {
            if (!proof.secret || !proof.C || !proof.amount || !proof.id || !proof.mintUrl) {
                throw new Error('The file contains invalid or incomplete Cashu proofs.');
            }
        }

        return proofsArray;
    },
};
