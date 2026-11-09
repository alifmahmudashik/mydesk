/** The MyDesk flame logo tile, shown at the top of the sidebar for every workspace. */
export function WorkspaceLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="logo" style={{ width: size, height: size, flex: 'none' }}>
      <img src="/mydesk-fire.png" alt="" style={{ width: size * 0.7, height: size * 0.7 }} />
    </div>
  )
}
