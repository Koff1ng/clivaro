import { NextResponse } from 'next/server'
import { networkInterfaces } from 'os'
import * as net from 'net'

export const dynamic = 'force-dynamic'

/**
 * Checks if a port is open on a host
 */
function checkPort(port: number, host: string, timeout = 2000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket()
        let status = false

        // Socket timeout
        socket.setTimeout(timeout)

        socket.on('connect', () => {
            status = true
            socket.destroy()
        })

        socket.on('timeout', () => {
            socket.destroy()
        })

        socket.on('error', (err) => {
            socket.destroy()
        })

        socket.on('close', () => {
            resolve(status)
        })

        socket.connect(port, host)
    })
}

/**
 * Get local subnet base IPs (e.g., "192.168.1")
 */
function getLocalSubnets(): string[] {
    const nets = networkInterfaces()
    const subnets: string[] = []

    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            // Skip internal (localhost) and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                // Assuming /24 subnet for simplicity (common in LANs)
                // "192.168.1.50" -> "192.168.1"
                const parts = net.address.split('.')
                parts.pop()
                subnets.push(parts.join('.'))
            }
        }
    }
    return [...new Set(subnets)] // unique
}

/**
 * GET /api/settings/scan-printers
 * Scans local network for port 9100 (HP JetDirect / RAW)
 */
export async function GET() {
    try {
        const subnets = getLocalSubnets()
        const foundPrinters: string[] = []

        // We scan 1..254 for each subnet
        // This can be slow (~60s sequential). We need concurrency.
        // Batch size 50.

        for (const subnet of subnets) {
            const promises: Promise<void>[] = []

            // Scan range 2 to 254 (skip gateway .1 usually)
            for (let i = 2; i < 255; i++) {
                const ip = `${subnet}.${i}`

                const p = checkPort(9100, ip, 400).then((isOpen) => {
                    if (isOpen) foundPrinters.push(ip)
                })
                promises.push(p)
            }

            // Wait for all in this subnet
            // Note: 254 requests in parallel is tough on Node? 
            // 400ms timeout is short but usually enough for LAN.
            await Promise.all(promises)
        }

        return NextResponse.json({
            devices: foundPrinters.map(ip => ({
                ip,
                name: `Printer ${ip}`,
                port: 9100
            }))
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
