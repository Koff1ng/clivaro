'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'

/**
 * FacebookPixel — loads the Meta Pixel only on public pages.
 * Internal ERP routes (dashboard, pos, settings, admin, etc.) are excluded
 * to avoid unnecessary tracking and the "preloaded resource not used" warning.
 */

const PUBLIC_PREFIXES = ['/', '/login', '/register', '/pricing', '/contact', '/about', '/blog', '/terms', '/privacy']

export function FacebookPixel() {
    const pathname = usePathname()

    // Only load on public pages — not internal ERP routes
    const isPublicPage = PUBLIC_PREFIXES.some(prefix => {
        if (prefix === '/') return pathname === '/'
        return pathname?.startsWith(prefix)
    })

    if (!isPublicPage) return null

    return (
        <>
            <Script id="facebook-pixel" strategy="lazyOnload">
                {`
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '26336803186005029');
                    fbq('track', 'PageView');
                `}
            </Script>
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height="1"
                    width="1"
                    style={{ display: 'none' }}
                    src="https://www.facebook.com/tr?id=26336803186005029&ev=PageView&noscript=1"
                    alt=""
                    loading="lazy"
                />
            </noscript>
        </>
    )
}
