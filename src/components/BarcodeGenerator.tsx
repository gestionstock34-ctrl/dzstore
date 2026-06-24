/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BarcodeGeneratorProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  width = 160,
  height = 50,
  showText = true,
}) => {
  // Simple algorithm to generate dummy but perfectly proportional barcodes:
  // We use a pseudo-hash of the characters to draw stable deterministic bars
  const generatePattern = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9]/g, '') || '00000000';
    let pattern = '1011001101'; // start guard
    for (let i = 0; i < clean.length; i++) {
      const charCode = clean.charCodeAt(i);
      // Binary representation mapping
      const bin = (charCode % 16).toString(2).padStart(4, '0');
      // Convert '0' to slim bars, '1' to normal/thick bars
      pattern += bin.split('').map(b => (b === '1' ? '110' : '1001')).join('');
    }
    pattern += '1011001101'; // end guard
    return pattern;
  };

  const pattern = generatePattern(value);
  const barWidth = width / pattern.length;

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-white rounded shadow-sm border border-gray-100">
      <svg width={width} height={height} className="overflow-visible">
        <g id="bars-group">
          {pattern.split('').map((char, index) => {
            if (char === '1') {
              return (
                <rect
                  key={index}
                  x={index * barWidth}
                  y={0}
                  width={barWidth * 0.95}
                  height={height}
                  fill="#111827"
                />
              );
            }
            return null;
          })}
        </g>
      </svg>
      {showText && (
        <span className="text-[10px] uppercase font-mono tracking-[0.2em] mt-1 text-gray-700">
          {value}
        </span>
      )}
    </div>
  );
};
