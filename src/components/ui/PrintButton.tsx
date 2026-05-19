import { usePrint } from '../../hooks/usePrint'
import { Icon } from './Icon'

interface PrintButtonProps {
  orientation?: 'portrait' | 'landscape'
  label?: string
  className?: string
}

export function PrintButton({ orientation = 'portrait', label = 'พิมพ์', className = 'btn' }: PrintButtonProps) {
  const { print } = usePrint()
  return (
    <button className={className} onClick={() => print(orientation)}>
      <Icon name="download" size={15} /> {label}
    </button>
  )
}
