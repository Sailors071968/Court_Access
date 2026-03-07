// ============================================
// Court Access — Virus Scanner Service
// Phase 29: Real Virus Scanning
//
// Uses ClamAV daemon for file scanning.
// Falls back to basic heuristic checks if ClamAV is unavailable.
// ============================================

import net from 'net';
import { config } from '../config/index.js';

/**
 * Scan a file buffer using ClamAV's INSTREAM protocol.
 *
 * ClamAV INSTREAM protocol:
 * 1. Send "zINSTREAM\0"
 * 2. Send file data in chunks: [4-byte big-endian length][data]
 * 3. Send [0x00000000] to signal end
 * 4. Read response: "stream: OK\0" or "stream: <virus_name> FOUND\0"
 *
 * @param fileBuffer - Buffer containing file data
 * @returns {{ safe: boolean, threat?: string, scanner: string }}
 */
export async function scanFile(fileBuffer) {
  // Try ClamAV first
  try {
    const result = await scanWithClamAV(fileBuffer);
    return result;
  } catch (err) {
    console.warn(`[VirusScanner] ClamAV unavailable (${err.message}), using heuristic scan`);
    return heuristicScan(fileBuffer);
  }
}

/**
 * Scan using ClamAV daemon via TCP socket.
 */
function scanWithClamAV(fileBuffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const chunks = [];
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        socket.destroy();
        reject(new Error('ClamAV scan timeout'));
      }
    }, 30000); // 30 second timeout

    socket.connect(config.clamavPort, config.clamavHost, () => {
      // Send INSTREAM command
      socket.write('zINSTREAM\0');

      // Send file data in chunks (max 2MB each)
      const CHUNK_SIZE = 2 * 1024 * 1024;
      let offset = 0;

      while (offset < fileBuffer.length) {
        const end = Math.min(offset + CHUNK_SIZE, fileBuffer.length);
        const chunk = fileBuffer.slice(offset, end);

        // Send 4-byte big-endian length prefix
        const lengthBuf = Buffer.alloc(4);
        lengthBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lengthBuf);
        socket.write(chunk);

        offset = end;
      }

      // Send zero-length chunk to signal end of stream
      const endBuf = Buffer.alloc(4, 0);
      socket.write(endBuf);
    });

    socket.on('data', (data) => {
      chunks.push(data);
    });

    socket.on('end', () => {
      if (responded) return;
      responded = true;
      clearTimeout(timeout);

      const response = Buffer.concat(chunks).toString('utf8').trim();
      console.log(`[VirusScanner] ClamAV response: ${response}`);

      if (response.includes('FOUND')) {
        const threatMatch = response.match(/stream: (.+) FOUND/);
        const threat = threatMatch ? threatMatch[1] : 'Unknown threat';
        resolve({ safe: false, threat, scanner: 'clamav', response });
      } else if (response.includes('OK')) {
        resolve({ safe: true, scanner: 'clamav', response });
      } else {
        reject(new Error(`ClamAV unexpected response: ${response}`));
      }
    });

    socket.on('error', (err) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Heuristic scan — basic checks when ClamAV is unavailable.
 * This is NOT a replacement for real antivirus scanning.
 * It catches obvious threats like EICAR test files and double extensions.
 */
function heuristicScan(fileBuffer) {
  const fileStr = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 4096));

  // Check for EICAR test string (standard antivirus test)
  const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  if (fileStr.includes(EICAR)) {
    return { safe: false, threat: 'EICAR-Test-File', scanner: 'heuristic' };
  }

  // Check for PE executable headers in unexpected file types
  if (fileBuffer.length >= 2 && fileBuffer[0] === 0x4D && fileBuffer[1] === 0x5A) {
    return { safe: false, threat: 'Suspicious-PE-Executable', scanner: 'heuristic' };
  }

  // Check for embedded scripts in image-like files
  const scriptPatterns = [
    /<script[\s>]/i,
    /javascript:/i,
    /vbscript:/i,
    /on(error|load|click|mouseover)\s*=/i,
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(fileStr)) {
      return { safe: false, threat: 'Embedded-Script-Detected', scanner: 'heuristic' };
    }
  }

  return { safe: true, scanner: 'heuristic' };
}

/**
 * Check if ClamAV daemon is available.
 */
export async function isClamAVAvailable() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    socket.connect(config.clamavPort, config.clamavHost, () => {
      socket.write('zPING\0');
    });

    socket.on('data', (data) => {
      clearTimeout(timeout);
      const response = data.toString().trim();
      socket.destroy();
      resolve(response === 'PONG');
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
