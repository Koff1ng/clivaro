'use client'

import React, { useRef } from 'react'
import {
    motion,
    useTransform,
    useMotionValue,
    useAnimationFrame
} from 'framer-motion'
import { cn } from '@/lib/utils'

const wrap = (min: number, max: number, v: number) => {
    const rangeSize = max - min
    return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min
}

interface ParallaxProps {
    children: React.ReactNode
    baseVelocity: number
}

function ParallaxText({ children, baseVelocity = 100 }: ParallaxProps) {
    const baseX = useMotionValue(0)

    // We loop between -25% and -50% because we render 4 copies.
    const x = useTransform(baseX, (v) => `${wrap(-25, -50, v)}%`)

    const directionFactor = useRef<number>(1)

    useAnimationFrame((t, delta) => {
        let moveBy = directionFactor.current * baseVelocity * (delta / 1000)
        baseX.set(baseX.get() + moveBy)
    })

    return (
        <div className="overflow-hidden m-0 flex flex-nowrap whitespace-nowrap">
            <motion.div className="flex flex-nowrap gap-4 py-4" style={{ x }}>
                {children}
                {children}
                {children}
                {children}
            </motion.div>
        </div>
    )
}

export const InfiniteMovingCards = ({
    items,
    direction = 'left',
    speed = 'fast',
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
    // Very slow speeds for "flujo lento"
    let baseVelocity = -0.5 // slow default
    if (speed === 'fast') baseVelocity = -1
    if (speed === 'normal') baseVelocity = -0.5
    if (speed === 'slow') baseVelocity = -0.25

    // If direction is right, invert.
    if (direction === 'right') baseVelocity = -baseVelocity

    return (
        <div className={cn("relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]", className)}>
            <ParallaxText baseVelocity={baseVelocity}>
                {items.map((item, idx) => {
                    const Icon = item.icon
                    return (
                        <div
                            key={item.name + idx}
                            className="w-[200px] h-[150px] inline-flex relative rounded-2xl border border-b-0 flex-shrink-0 border-slate-200 dark:border-slate-800 px-8 py-6 md:w-[250px] bg-white dark:bg-slate-950 flex-col items-center justify-center gap-4 hover:border-blue-500 transition-colors group shadow-sm mr-4"
                        >
                            <div className="h-12 w-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
                                <Icon className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                                {item.name}
                            </span>
                        </div>
                    )
                })}
            </ParallaxText>
        </div>
    )
}
