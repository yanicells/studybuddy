import iconUrl from '../../assets/icon.svg?url'

export function AppIcon({ size = 'medium' }: Readonly<{ size?: 'small' | 'medium' | 'large' }>) {
  return (
    <span className={`app-icon app-icon--${size}`} aria-hidden="true">
      <img src={iconUrl} alt="" />
    </span>
  )
}
