'use client'

import React, { useRef } from 'react'
import {
    motion,
    useScroll,
    useSpring,
    useTransform,
    useMotionValue,
    useVelocity,
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
    const { scrollY } = useScroll()
    const scrollVelocity = useVelocity(scrollY)
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400
    })

    // Use a transform to convert velocity to a factor. 
    // We keep the direction somewhat constant but speed up.
    // The 'velocity' from scroll can be positive or negative. 
    // We want to add magnitude to our base velocity, but keep direction consistent if desired.
    // However, scroll velocity effect usually implies "scrolling down makes it go faster left", "scrolling up makes it go faster right" (or faster left).
    // The user said: "vaya en una sola direccion" (go in a single direction).
    // This implies: Default moves left. Scroll Down -> Moves FASTER left. Scroll Up -> Still moves left (maybe faster or slower).

    // Let's assume we always move left (baseVelocity > 0 implies moving right with logic below, so we start negative).
    // Standard logic: x -= moveBy.

    const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
        clamp: false
    })

    // We need to know the wrapping bounds. Since we don't know exact width inside this component easily without measuring,
    // we can use percentages if we assume the children are duplicated enough to fill 100% and we wrap at -25% or -50%.
    // But a more robust way for "infinite cards" is using a percentage based wrap assuming 
    // the children are rendered multiple times (e.g. 4 times) to cover the screen.

    // A standard trick for these text marquees is wrapping -20% to -45% based on content length.
    // Given we are rendering the items 4 times (implied below), we can wrap at -25% (one full set).
    // Wait, if we render 2 sets, we wrap at -50%.
    // Let's render 4 sets to be safe and wrap at -25%.

    const x = useTransform(baseX, (v) => `${wrap(-25, -50, v)}%`)

    const directionFactor = useRef<number>(1)

    useAnimationFrame((t, delta) => {
        let moveBy = directionFactor.current * baseVelocity * (delta / 1000)

        // Add scroll velocity effect. 
        // If we want single direction, we ensure (moveBy + velocity) is always same sign, or we apply velocity magnitude in same direction.
        // If baseVelocity is positive (moving right?), wait.
        // Let's say base is moving Left.
        // Scroll Down (velocity > 0) -> Should move faster Left?
        // Scroll Up (velocity < 0) -> Should move faster Left? Or Slower?
        // Usually "Velocity" style means it reacts to the direction of scroll.
        // "Single direction" might mean "Don't reverse direction".
        // So we take absolute value of velocity?

        // The link provided shows text moving right, then left when scrolling up.
        // User says "Infinite animation like this BUT SINGLE DIRECTION".
        // So if I scroll down, it speeds up. If I scroll up, it also speeds up (or just keeps going), but DOES NOT REVERSE.

        // So we take `Math.abs(velocityFactor.get())`.

        if (velocityFactor.get() < 0) {
            // directionFactor.current = -1; // This would reverse it. We DON'T want this.
        }

        moveBy += directionFactor.current * Math.abs(velocityFactor.get()) * moveBy

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
    // Determine base velocity
    // If direction is left, we want negative velocity usually for "x".
    // But our wrap logic above: wrap(-25, -50, v).
    // If v decreases (negative velocity), it goes -25 -> -50 -> wrap to -25.
    // This looks like moving LEFT.

    // If v increases (positive velocity), it goes -25 -> -20 -> wrap (wait bounds).
    // wrap(min, max, v).

    // Let's stick to: Moving Left = v moves negative.

    let baseVelocity = -1 // default
    if (speed === 'fast') baseVelocity = -5
    if (speed === 'normal') baseVelocity = -2
    if (speed === 'slow') baseVelocity = -0.5

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
