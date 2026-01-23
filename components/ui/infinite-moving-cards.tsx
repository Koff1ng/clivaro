'use client'

import { cn } from '@/lib/utils'
import React, { useEffect, useState } from 'react'

export const InfiniteMovingCards = ({
    items,
    direction = 'left',
    speed = 'fast',
    pauseOnHover = true,
    className,
}: {
    items: {
        name: string
        icon: React.ElementType
    }[]
    direction?: 'left' | 'right'
    speed?: 'fast' | 'normal' | 'slow'
    pauseOnHover?: boolean
    className?: string
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const scrollerRef = React.useRef<HTMLUListElement>(null)

    useEffect(() => {
        addAnimation()
    }, [])

    const [start, setStart] = useState(false)

    function addAnimation() {
        if (containerRef.current && scrollerRef.current) {
            const scrollerContent = Array.from(scrollerRef.current.children)

            scrollerContent.forEach((item) => {
                const duplicatedItem = item.cloneNode(true)
                if (scrollerRef.current) {
                    scrollerRef.current.appendChild(duplicatedItem)
                }
            })

            getDirection()
            getSpeed()
            setStart(true)
        }
    }

    const getDirection = () => {
        if (containerRef.current) {
            if (direction === 'left') {
                containerRef.current.style.setProperty('--animation-direction', 'forwards')
            } else {
                containerRef.current.style.setProperty('--animation-direction', 'reverse')
            }
        }
    }

    const getSpeed = () => {
        if (containerRef.current) {
            if (speed === 'fast') {
                containerRef.current.style.setProperty('--animation-duration', '20s')
            } else if (speed === 'normal') {
                containerRef.current.style.setProperty('--animation-duration', '40s')
            } else {
                containerRef.current.style.setProperty('--animation-duration', '80s')
            }
        }
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                'scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]',
                className
            )}
        >
            <ul
                ref={scrollerRef}
                className={cn(
                    'flex min-w-full shrink-0 gap-4 py-4 w-max flex-nowrap',
                    start && 'animate-scroll',
                    pauseOnHover && 'hover:[animation-play-state:paused]'
                )}
            >
                {items.map((item, idx) => {
                    const Icon = item.icon
                    return (
                        <li
                            key={item.name + idx}
                            className="w-[200px] h-[150px] max-w-full relative rounded-2xl border border-b-0 flex-shrink-0 border-slate-200 dark:border-slate-800 px-8 py-6 md:w-[250px] bg-white dark:bg-slate-950 flex flex-col items-center justify-center gap-4 hover:border-blue-500 transition-colors group shadow-sm"
                        >
                            <div className="h-12 w-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
                                <Icon className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                                {item.name}
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
