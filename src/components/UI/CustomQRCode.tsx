import React, { useMemo } from 'react';
import Svg, { Circle, Rect, Path, G } from 'react-native-svg';
import QRCode from 'qrcode';
import { useTheme } from 'tamagui';
import BeyIcon from '../icons/BeyIcon';

export interface CustomQRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: any;
    logoSize?: number;
    dotShape?: 'circle' | 'square' | 'diamond';
    finderStyle?: 'rounded' | 'square';
}

const isInsideFinder = (x: number, y: number, moduleCount: number): boolean => {
    // Top-Left Finder
    if (x < 7 && y < 7) return true;
    // Top-Right Finder
    if (x >= moduleCount - 7 && y < 7) return true;
    // Bottom-Left Finder
    if (x < 7 && y >= moduleCount - 7) return true;
    return false;
};

const isInsideLogoZone = (x: number, y: number, moduleCount: number, logoModules: number): boolean => {
    const center = moduleCount / 2;
    const half = logoModules / 2;
    return (
        x >= Math.floor(center - half) &&
        x <= Math.floor(center + half) &&
        y >= Math.floor(center - half) &&
        y <= Math.floor(center + half)
    );
};

export function CustomQRCode({
    value,
    size = 250,
    color,
    backgroundColor,
    logo,
    logoSize = 50,
    dotShape = 'circle',
    finderStyle = 'rounded',
}: CustomQRCodeProps) {
    const theme = useTheme();
    const activeColor = color || theme.color?.val || '#000000';
    const activeBgColor = backgroundColor || 'transparent';
    const themeBgColor = theme.background?.val || '#ffffff';

    const { modules, moduleCount, cellSize, marginModules } = useMemo(() => {
        try {
            // Generate matrix with 0 margin, we will handle margin ourselves
            const qr = QRCode.create(value, {
                errorCorrectionLevel: 'H',
                margin: 0,
            });
            const modules = qr.modules.data;
            const moduleCount = qr.modules.size;

            // Standard quiet zone margin of 4 modules
            const marginModules = 4;
            const totalModules = moduleCount + 2 * marginModules;
            const cellSize = size / totalModules;

            return {
                modules,
                moduleCount,
                cellSize,
                marginModules,
            };
        } catch (err) {
            console.error('[CustomQRCode] Error generating QR matrix:', err);
            return {
                modules: new Uint8Array(),
                moduleCount: 0,
                cellSize: 0,
                marginModules: 0,
            };
        }
    }, [value, size]);

    const logoModules = useMemo(() => {
        if (!logo || cellSize === 0) return 0;
        let count = Math.ceil(logoSize / cellSize);
        // Force odd count for perfect centering
        if (count % 2 === 0) count += 0;
        return count;
    }, [logo, logoSize, cellSize]);

    const renderedModules = useMemo(() => {
        if (moduleCount === 0) return null;

        const cells: React.ReactNode[] = [];

        for (let y = 0; y < moduleCount; y++) {
            for (let x = 0; x < moduleCount; x++) {
                const index = y * moduleCount + x;

                // Skip if cell is empty
                if (!modules[index]) continue;

                // Skip cells inside finder patterns (handled separately)
                if (isInsideFinder(x, y, moduleCount)) continue;

                // Skip cells inside the center logo zone
                if (logoModules > 0 && isInsideLogoZone(x, y, moduleCount, logoModules)) continue;

                const cx = (x + marginModules) * cellSize + cellSize / 2;
                const cy = (y + marginModules) * cellSize + cellSize / 2;
                const r = cellSize * 0.42;

                if (dotShape === 'circle') {
                    cells.push(
                        <Circle
                            key={`${x}-${y}`}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill={activeColor}
                        />
                    );
                } else if (dotShape === 'diamond') {
                    cells.push(
                        <Path
                            key={`${x}-${y}`}
                            d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
                            fill={activeColor}
                        />
                    );
                } else {
                    // Square cell
                    const pad = cellSize * 0.08;
                    cells.push(
                        <Rect
                            key={`${x}-${y}`}
                            x={(x + marginModules) * cellSize + pad}
                            y={(y + marginModules) * cellSize + pad}
                            width={cellSize - 2 * pad}
                            height={cellSize - 2 * pad}
                            fill={activeColor}
                        />
                    );
                }
            }
        }

        return cells;
    }, [modules, moduleCount, cellSize, marginModules, activeColor, dotShape, logoModules]);

    const renderFinder = (startX: number, startY: number, key: string) => {
        const x = (startX + marginModules) * cellSize;
        const y = (startY + marginModules) * cellSize;
        const rxValue = finderStyle === 'rounded' ? 1.8 * cellSize : 0;
        const ryValue = finderStyle === 'rounded' ? 1.8 * cellSize : 0;

        return (
            <G key={key}>
                {/* Outer Ring */}
                <Rect
                    x={x + cellSize / 2}
                    y={y + cellSize / 2}
                    width={6 * cellSize}
                    height={6 * cellSize}
                    rx={rxValue}
                    ry={ryValue}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth={cellSize}
                />
                {/* Inner Dot */}
                <Circle
                    cx={x + 3.5 * cellSize}
                    cy={y + 3.5 * cellSize}
                    r={1.5 * cellSize}
                    fill={activeColor}
                />
            </G>
        );
    };

    if (moduleCount === 0) return null;

    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background */}
            <Rect x={0} y={0} width={size} height={size} fill={activeBgColor} />

            {/* QR Modules */}
            {renderedModules}

            {/* Custom Finder Patterns */}
            {renderFinder(0, 0, 'top-left')}
            {renderFinder(moduleCount - 7, 0, 'top-right')}
            {renderFinder(0, moduleCount - 7, 'bottom-left')}

            {/* Center Logo */}
            {logo && (
                <G>
                    {/* Clear background behind the logo */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={logoSize / 2 + 4}
                        fill={themeBgColor}
                    />
                    <G transform={`translate(${(size - logoSize) / 2}, ${(size - logoSize) / 2})`}>
                        <BeyIcon size={logoSize} color={activeColor} />
                    </G>
                </G>
            )}


        </Svg>
    );
}
