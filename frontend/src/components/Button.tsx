import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline-light'
  size?: 'sm' | 'md'
}

export default function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: Props) {
  const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'outline-light' ? 'btn-outline-light' : 'btn-secondary'
  const sizeClass = size === 'sm' ? 'btn-sm' : ''
  return <button className={`btn ${variantClass} ${sizeClass} ${className}`.trim()} {...rest} />
}
