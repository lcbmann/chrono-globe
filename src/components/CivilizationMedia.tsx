import { useState } from 'react'
import { ExternalLink, Flag, ImageIcon } from 'lucide-react'
import { commonsFileUrl, commonsImageUrl, commonsSearchUrl } from '../data/civilizationMedia'
import type { CivilizationMedia as CivilizationMediaRecord, FreeMediaAsset } from '../types'

interface MediaFigureProps {
  asset: FreeMediaAsset
  className?: string
}

function MediaFigure({ asset, className = '' }: MediaFigureProps) {
  const [failedFile, setFailedFile] = useState<string | null>(null)
  const failed = failedFile === asset.file

  if (failed) {
    return (
      <a className={`media-unavailable ${className}`} href={commonsFileUrl(asset)} target="_blank" rel="noreferrer">
        <ImageIcon size={15} /> Preview unavailable · open the source file
      </a>
    )
  }

  return (
    <figure className={`civilization-media ${className}`}>
      <a className="media-image-link" href={commonsFileUrl(asset)} target="_blank" rel="noreferrer" aria-label={`Open source for ${asset.caption}`}>
        <img
          src={commonsImageUrl(asset)}
          alt={asset.alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedFile(asset.file)}
        />
      </a>
      <figcaption>
        <strong>{asset.caption}</strong>
        <span>
          {asset.credit} · <a href={asset.licenseUrl} target="_blank" rel="noreferrer">{asset.license}</a> ·{' '}
          <a href={commonsFileUrl(asset)} target="_blank" rel="noreferrer">source <ExternalLink size={9} /></a>
        </span>
      </figcaption>
    </figure>
  )
}

interface CivilizationMediaProps {
  name: string
  media?: CivilizationMediaRecord
}

export function CivilizationMedia({ name, media }: CivilizationMediaProps) {
  if (!media) {
    return (
      <a className="commons-search-link" href={commonsSearchUrl(name)} target="_blank" rel="noreferrer">
        <ImageIcon size={12} /> Browse reusable media for {name} on Wikimedia Commons
      </a>
    )
  }

  return (
    <section className="profile-media" aria-label={`Free media for ${name}`}>
      {media.image && <MediaFigure asset={media.image} />}
      {media.symbol && (
        <div className="historical-symbol">
          <div className="historical-symbol-image"><MediaFigure asset={media.symbol} className="symbol-figure" /></div>
          <div className="historical-symbol-copy">
            <span><Flag size={10} /> Historical {media.symbol.kind}</span>
            <strong>{media.symbol.caption}</strong>
            <p>{media.symbol.context}</p>
          </div>
        </div>
      )}
    </section>
  )
}
