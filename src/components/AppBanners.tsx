interface AppBannersProps {
  online: boolean
  saveError: string | null
  syncNotice: string | null
}

export function AppBanners({ online, saveError, syncNotice }: AppBannersProps) {
  return (
    <>
      {!online ? (
        <div className="banner warning">
          <strong>Offline.</strong> Local tracking still works, and sync will resume when you reconnect.
        </div>
      ) : null}

      {saveError ? (
        <div className="banner error">
          <strong>Local save problem.</strong> {saveError}
        </div>
      ) : null}

      {syncNotice ? <div className="banner info">{syncNotice}</div> : null}
    </>
  )
}
