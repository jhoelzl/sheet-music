import { useEffect, useState } from 'react'

export function UploadStatus({ message }: { message: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [])
  return <p className="document-upload-status" role="status">{message} Keep this page open.{slow && ' This is taking longer than usual; the app will report a timeout if the request does not finish.'}</p>
}
