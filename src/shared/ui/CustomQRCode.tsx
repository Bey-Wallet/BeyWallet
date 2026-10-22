import React, { useMemo } from 'react';
import Svg, { Circle, Rect, Path, G } from 'react-native-svg';
import QRCode from 'qrcode';
import { useTheme } from 'tamagui';
import BeyIcon from '~/shared/icons/BeyIcon';

export interface CustomQRCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  logo?: boolean;
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
  const activeBgColor = backgroundColor || theme.background?.val || '#ffffff';
  const safeLogoSize = Math.max(0, Math.min(logoSize, size * 0.18));

  const { modules, moduleCount } = useMemo(() => {
    try {
      // Generate matrix with 0 margin, we will handle margin ourselves
      const qr = QRCode.create(value, {
        errorCorrectionLevel: 'H',
      });
      const modules = qr.modules.data;
      const moduleCount = qr.modules.size;

      return {
        modules,
        moduleCount,
      };
    } catch {
      console.warn('[CustomQRCode] Could not generate QR matrix');
      return {
        modules: new Uint8Array(),
        moduleCount: 0,
      };
    }
  }, [value]);
  const marginModules = 4;
  const cellSize = size / (moduleCount + 2 * marginModules);

  const renderedModules = useMemo(() => {
    if (moduleCount === 0) return null;

    const cells: string[] = [];

    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        const index = y * moduleCount + x;

        // Skip if cell is empty
        if (!modules[index]) continue;

        // Skip cells inside finder patterns (handled separately)
        if (isInsideFinder(x, y, moduleCount)) continue;

        const cx = (x + marginModules) * cellSize + cellSize / 2;
        const cy = (y + marginModules) * cellSize + cellSize / 2;
        const r = cellSize * 0.48;

        if (dotShape === 'circle') {
          cells.push(
            `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`,
          );
        } else if (dotShape === 'diamond') {
          cells.push(`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`);
        } else {
          // Square cell
          const pad = cellSize * 0.08;
          const x0 = (x + marginModules) * cellSize + pad;
          const y0 = (y + marginModules) * cellSize + pad;
          const side = cellSize - 2 * pad;
          cells.push(`M ${x0} ${y0} h ${side} v ${side} h ${-side} Z`);
        }
      }
    }

    return cells.join(' ');
  }, [modules, moduleCount, cellSize, dotShape]);

  const renderFinder = (startX: number, startY: number, key: string) => {
    const x = (startX + marginModules) * cellSize;
    const y = (startY + marginModules) * cellSize;
    const rounded = finderStyle === 'rounded';

    return (
      <G key={key}>
        {/* Outer Ring */}
        <Rect
          x={x}
          y={y}
          width={7 * cellSize}
          height={7 * cellSize}
          rx={rounded ? 1.8 * cellSize : 0}
          fill={activeColor}
        />
        <Rect
          x={x + cellSize}
          y={y + cellSize}
          width={5 * cellSize}
          height={5 * cellSize}
          rx={rounded ? cellSize : 0}
          fill={activeBgColor}
        />
        <Rect
          x={x + 2 * cellSize}
          y={y + 2 * cellSize}
          width={3 * cellSize}
          height={3 * cellSize}
          rx={rounded ? 0.7 * cellSize : 0}
          fill={activeColor}
        />
      </G>
    );
  };

  if (moduleCount === 0) return null;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      accessibilityRole="image"
      accessibilityLabel="Profile QR code"
    >
      {/* Background */}
      <Rect x={0} y={0} width={size} height={size} fill={activeBgColor} />

      {/* QR Modules */}
      <Path d={renderedModules || ''} fill={activeColor} />

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
            r={safeLogoSize / 2 + cellSize}
            fill={activeBgColor}
          />
          <G
            transform={`translate(${(size - (safeLogoSize * 500) / 512) / 2}, ${(size - (safeLogoSize * 467) / 512) / 2})`}
          >
            <BeyIcon size={safeLogoSize} color={activeColor} />
          </G>
        </G>
      )}
    </Svg>
  );
}
