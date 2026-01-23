import React from 'react'

interface IconProps extends React.SVGProps<SVGSVGElement> {
    accentColor?: string
}

const DefaultAccent = "#22d3ee" // Cyan-400 equivalent

export const HardwareIcon = ({ accentColor = DefaultAccent, ...props }: IconProps) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="20" cy="44" r="14" fill={accentColor} />
        <path d="M48 16L34 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M52 12C54.2091 9.79086 54.2091 6.20914 52 4C49.7909 1.79086 46.2091 1.79086 44 4L28 20L24 24L20 28C18.8954 29.1046 18.8954 30.8954 20 32C21.1046 33.1046 22.8954 33.1046 24 32L32 24L44 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 48L24 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 52L20 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M38 46L26 58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 42C44.7614 39.2386 44.7614 34.7614 42 32C39.2386 29.2386 34.7614 29.2386 32 32L28 36L46 54L50 50C52.7614 47.2386 52.7614 42.7614 50 40L42 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const PaintIcon = ({ accentColor = DefaultAccent, ...props }: IconProps) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="48" cy="44" r="14" fill={accentColor} />
        <path d="M12 20H36V48C36 50.2091 34.2091 52 32 52H16C13.7909 52 12 50.2091 12 48V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 20H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 20V14C24 11.7909 25.7909 10 28 10H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M38 28H54L50 48H42L38 28Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M44 48V52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M48 48V54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 32H28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
)

export const ConstructionIcon = ({ accentColor = DefaultAccent, ...props }: IconProps) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="24" cy="24" r="14" fill={accentColor} />
        <path d="M8 56H56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 56V32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M48 56V24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 32L32 16L48 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 44H48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 38V50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M40 38V50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 16V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 10H36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
)

export const ElectricalIcon = ({ accentColor = DefaultAccent, ...props }: IconProps) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="32" cy="32" r="14" fill={accentColor} />
        <path d="M32 12C24.268 12 18 18.268 18 26C18 31.6 21.5 36.4 26 38.6V46H38V38.6C42.5 36.4 46 31.6 46 26C46 18.268 39.732 12 32 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 46V52H36V46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 24L30 30L34 22L40 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 26H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M58 26H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 6V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
)

export const LocksmithIcon = ({ accentColor = DefaultAccent, ...props }: IconProps) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="44" cy="24" r="14" fill={accentColor} />
        <path d="M24 32H16C13.7909 32 12 33.7909 12 36V48C12 50.2091 13.7909 52 16 52H24C26.2091 52 28 50.2091 28 48V36C28 33.7909 26.2091 32 24 32Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 32V24C16 19.5817 19.5817 16 24 16C28.4183 16 32 19.5817 32 24V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 42H20.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 30L40 36L42 44L56 50L60 46L54 38L52 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="54" cy="22" r="2" fill="currentColor" />
    </svg>
)

export const PlumbingIcon = ({ accentColor = DefaultAccent, ...props }: IconProps) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="20" cy="50" r="10" fill={accentColor} />
        <path d="M48 20V12H16V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 20V36C24 38.2091 25.7909 40 28 40H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M48 32V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M44 46L52 54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M38 12V6C38 3.79086 36.2091 2 34 2H30C27.7909 2 26 3.79086 26 6V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M38 52C38 54.2091 36.2091 56 34 56C31.7909 56 30 54.2091 30 52C30 49.7909 34 46 34 46C34 46 38 49.7909 38 52Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)
