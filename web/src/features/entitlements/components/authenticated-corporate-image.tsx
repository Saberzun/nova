import { useEffect, useState } from 'react'

import { api } from '@/lib/http-client'

interface AuthenticatedCorporateImageProps {
  path: string
  alt: string
  className?: string
  openOriginal?: boolean
}

/**
 * Corporate-transfer image endpoints require dashboard authentication. A
 * native img request cannot include the bearer token injected by our axios
 * client, so fetch the bytes through that client and render an object URL.
 */
export function AuthenticatedCorporateImage(
  props: AuthenticatedCorporateImageProps
) {
  const [objectUrl, setObjectUrl] = useState<string>()

  useEffect(() => {
    let active = true
    let nextObjectUrl: string | undefined

    setObjectUrl(undefined)
    void api
      .get<Blob>(props.path, {
        responseType: 'blob',
        skipErrorHandler: true,
      })
      .then((response) => {
        if (!active) return
        nextObjectUrl = URL.createObjectURL(response.data)
        setObjectUrl(nextObjectUrl)
      })
      .catch(() => {
        if (active) setObjectUrl(undefined)
      })

    return () => {
      active = false
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl)
    }
  }, [props.path])

  if (!objectUrl) return null

  const image = (
    <img src={objectUrl} alt={props.alt} className={props.className} />
  )
  if (!props.openOriginal) return image

  return (
    <a href={objectUrl} target='_blank' rel='noreferrer'>
      {image}
    </a>
  )
}
