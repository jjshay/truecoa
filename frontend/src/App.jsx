import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_CONTRACT_URL = 'https://polygonscan.com/address/0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1'
const SCOREDETECT_HOME_URL = 'https://scoredetect.com'
const OPENSEA_COLLECTION_URL = 'https://opensea.io/collection/gauntlet-gallery-coa'
const CERTIFICATE_SIGNER = 'Gauntlet Gallery'
const IMAGE_UPLOAD_TARGET_BYTES = 2.5 * 1024 * 1024
const IMAGE_UPLOAD_MAX_DIMENSION = 2400
const PRINT_COPY_LIMITS = {
  condition: 42,
  description: 348,
  provenance: 232
}
const PRINT_COPY_TOTAL_TARGET = Object.values(PRINT_COPY_LIMITS).reduce((total, limit) => total + limit, 0)
const PRINT_COPY_TOTAL_GRACE = 60
const CONDITION_OPTIONS = [
  { value: 'A+ / Mint', label: 'A+ / Mint' },
  { value: 'A / Excellent', label: 'A / Excellent' },
  { value: 'B / Very Good', label: 'B / Very Good' },
  { value: 'C / Good', label: 'C / Good' },
  { value: 'D / Fair', label: 'D / Fair' },
  { value: 'F / Poor', label: 'F / Poor' }
]
const CONDITION_DETAIL_OPTIONS = [
  { value: 'no visible wear', label: 'No visible wear' },
  { value: 'light handling wear', label: 'Light wear' },
  { value: 'minor edge wear', label: 'Edge wear' },
  { value: 'soft corners', label: 'Soft corners' },
  { value: 'surface scuffing', label: 'Scuffing' },
  { value: 'framing-ready', label: 'Framing-ready' }
]
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, index) => String(CURRENT_YEAR - index))
const DATE_MODE_OPTIONS = [
  { value: 'exact', label: 'Exact year' },
  { value: 'circa', label: 'Circa' },
  { value: 'dated', label: 'Dated on work' },
  { value: 'range', label: 'Year range' },
  { value: 'undated', label: 'Undated' },
  { value: 'unknown', label: 'Unknown' }
]
const PROVENANCE_PRESETS = [
  {
    id: 'direct-artist',
    label: 'Direct artist',
    value: 'Acquired directly from the artist.',
    platform: 'Artist / studio'
  },
  {
    id: 'gallery',
    label: 'Gallery',
    value: 'Acquired from a reputable art gallery.',
    platform: 'Art gallery'
  },
  {
    id: 'ebay-dealer',
    label: 'eBay dealer',
    value: 'Acquired from a reputable dealer via eBay; source documentation retained by Gauntlet Gallery.',
    platform: 'eBay'
  },
  {
    id: 'private-collection',
    label: 'Private collection',
    value: 'Acquired from a private collection; source documentation retained by Gauntlet Gallery.',
    platform: 'Private sale'
  }
]
const PROVENANCE_SOURCE_OPTIONS = [
  { value: '', label: 'Select source' },
  ...PROVENANCE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
  { value: 'auction-house', label: 'Auction house' },
  { value: 'estate', label: 'Estate / collection' },
  { value: 'other', label: 'Other source' }
]
const EVIDENCE_PLATFORM_OPTIONS = [
  '',
  'Artist / studio',
  'Art gallery',
  'Auction house',
  'eBay',
  'Private sale',
  'Estate',
  'Other'
]
const EVIDENCE_DOCUMENT_OPTIONS = [
  '',
  'Invoice/order retained',
  'Seller messages retained',
  'COA/receipt retained',
  'Listing screenshots retained',
  'No source docs yet'
]
const COA_TYPE_TEMPLATES = [
  {
    id: 'artwork',
    label: 'Artwork',
    helper: 'Fine art, prints, paintings, drawings, sculptures, and editions.',
    defaults: {}
  },
  {
    id: 'sports',
    label: 'Sports / NFL',
    helper: 'Jerseys, helmets, footballs, cards, photos, and signed sports memorabilia.',
    defaults: {
      medium: 'Sports memorabilia',
      evidencePlatform: 'Other'
    }
  },
  {
    id: 'autograph',
    label: 'Autograph',
    helper: 'Signed photos, books, albums, posters, flats, and documents.',
    defaults: {
      medium: 'Autographed collectible'
    }
  },
  {
    id: 'collectible',
    label: 'Collectible',
    helper: 'Designer collectibles, figures, trading cards, toys, and limited objects.',
    defaults: {
      medium: 'Collectible'
    }
  },
  {
    id: 'music',
    label: 'Music',
    helper: 'Signed guitars, records, posters, gold records, and concert memorabilia.',
    defaults: {
      medium: 'Music memorabilia'
    }
  },
  {
    id: 'space',
    label: 'Space',
    helper: 'Astronaut autographs, mission patches, flown items, and NASA memorabilia.',
    defaults: {
      medium: 'Space memorabilia'
    }
  }
]
const MEDIUM_OPTIONS_BY_TYPE = {
  artwork: [
    'Acrylic on canvas',
    'Oil on canvas',
    'Mixed media on canvas',
    'Watercolor on paper',
    'Graphite on paper',
    'Ink on paper',
    'Screenprint on paper',
    'Lithograph on paper',
    'Giclee print on paper',
    'Archival pigment print on fine art paper',
    'Spray paint on paper',
    'Spray paint and stencil on canvas',
    'Sculpture',
    'Mixed media'
  ],
  sports: [
    'Sports memorabilia',
    'Signed jersey',
    'Signed helmet',
    'Signed football',
    'Signed photo',
    'Trading card',
    'Game-used item',
    'Ticket / program',
    'Other sports memorabilia'
  ],
  autograph: [
    'Autographed collectible',
    'Signed photograph',
    'Signed poster',
    'Signed book',
    'Signed album cover',
    'Signed document',
    'Signed trading card',
    'Signed flat'
  ],
  collectible: [
    'Collectible',
    'Designer collectible',
    'Limited edition figure',
    'Vinyl art toy',
    'Resin sculpture',
    'Trading card',
    'Collectible object',
    'Mixed media collectible'
  ],
  music: [
    'Music memorabilia',
    'Signed guitar',
    'Signed vinyl record',
    'Signed album cover',
    'Concert poster',
    'Gold/platinum record',
    'Stage-used item',
    'Tour memorabilia'
  ],
  space: [
    'Space memorabilia',
    'Signed mission photograph',
    'Mission patch',
    'Flown artifact',
    'NASA document',
    'Signed lithograph',
    'Mission hardware',
    'Space program collectible'
  ]
}
const SPORTS_LEAGUE_OPTIONS = ['', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'MLS', 'Other']
const SPORTS_ITEM_TYPE_OPTIONS = [
  '',
  'Signed jersey',
  'Signed helmet',
  'Signed football',
  'Signed photo',
  'Trading card',
  'Game-used item',
  'Ticket / program',
  'Other memorabilia'
]
const SPORTS_AUTHENTICATOR_OPTIONS = [
  '',
  'PSA/DNA',
  'JSA',
  'Beckett',
  'Fanatics Authentic',
  'TriStar',
  'Upper Deck Authenticated',
  'Other'
]
const DEFAULT_CREATE_FORM = {
  coaType: 'artwork',
  coaCode: '',
  signer: '',
  title: '',
  assignor: 'TrueCOA',
  date: '',
  dateMode: 'exact',
  dateYear: '',
  dateRangeStart: '',
  dateRangeEnd: '',
  medium: '',
  mediumMode: 'standard',
  dimensions: '',
  edition: '',
  condition: '',
  conditionGrade: '',
  conditionDetails: '',
  description: '',
  provenance: '',
  provenanceSource: '',
  evidenceReference: '',
  evidenceSeller: '',
  evidencePlatform: '',
  evidenceDocuments: '',
  evidenceNotes: '',
  sportsPlayer: '',
  sportsTeam: '',
  sportsLeague: 'NFL',
  sportsItemType: '',
  sportsSignature: '',
  sportsAuthenticator: '',
  sportsCertNumber: '',
  sportsSource: '',
  authenticator: '',
  authenticatorNumber: '',
  authenticatorLink: '',
  authNotes: '',
  imageUrl: '',
  sku: '',
  recipient: '',
  sourceCurationId: '',
  createScoreDetect: true,
  mintPolygon: true
}
const COA_ASSISTANT_FIELDS = [
  'signer',
  'title',
  'date',
  'medium',
  'dimensions',
  'edition',
  'condition',
  'description',
  'provenance',
  'sku'
]
const COA_ASSISTANT_LABELS = {
  signer: 'Artist / Signer',
  title: 'Title',
  date: 'Date',
  medium: 'Medium',
  dimensions: 'Dimensions',
  edition: 'Edition',
  condition: 'Condition',
  description: 'Description',
  provenance: 'Provenance',
  sku: 'SKU'
}

const INITIAL_CURATION_ITEMS = [
  {
    id: 'cur-1',
    artist: 'Shepard Fairey',
    title: 'Workers Rights',
    category: 'Street art',
    priority: 'High',
    status: 'Ready for COA',
    notes: 'Publisher provenance and authentication copy ready.'
  },
  {
    id: 'cur-2',
    artist: 'KAWS',
    title: 'Companion Figure',
    category: 'Designer collectible',
    priority: 'High',
    status: 'Reviewing',
    notes: 'Confirm edition markings and packaging images.'
  },
  {
    id: 'cur-3',
    artist: 'NASA Apollo',
    title: 'Signed Mission Photo',
    category: 'Space memorabilia',
    priority: 'Medium',
    status: 'Needs source image',
    notes: 'Waiting on final scan before COA creation.'
  }
]

const INITIAL_WISHLIST_ITEMS = [
  {
    id: 'wish-1',
    artist: 'Banksy',
    title: 'Unsigned print candidate',
    priority: 'High',
    notes: 'Watch for clean provenance and condition photos.'
  },
  {
    id: 'wish-2',
    artist: 'Death NYC',
    title: 'Simpsons LV AP',
    priority: 'Medium',
    notes: 'Match to current collector demand.'
  }
]

const EMPTY_WISHLIST_DRAFT = {
  artist: '',
  title: '',
  priority: 'Medium',
  notes: ''
}
function formatDisplayDate(value) {
  if (!value) return ''

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return value
}

function buildQrValue(result) {
  return result.coa.shortUrl || result.external_url || `${window.location.origin}/AUTHENTICATE/${result.coa.code}`
}

function buildBlockchainLink(result) {
  if (result.coa.blockchainUrl) return result.coa.blockchainUrl
  if (result.blockchain?.verified && result.blockchain.tokenId) {
    return `https://polygonscan.com/token/${result.blockchain.contractAddress}?a=${result.blockchain.tokenId}`
  }
  return ''
}

function buildOpenSeaItemUrl(contractAddress, tokenId) {
  const contract = String(contractAddress || '').trim()
  const token = String(tokenId || '').trim()
  if (!contract || !token) return ''

  return `https://opensea.io/item/polygon/${contract}/${encodeURIComponent(token)}`
}

function normalizeOpenSeaItemUrl(url) {
  const value = String(url || '').trim()
  const match = value.match(/^https?:\/\/(?:www\.)?opensea\.io\/(?:assets\/matic|item\/polygon)\/([^/?#]+)\/([^/?#]+)/i)

  return match ? buildOpenSeaItemUrl(match[1], match[2]) : value
}

function buildNftLink(result) {
  const itemUrl = buildOpenSeaItemUrl(result?.blockchain?.contractAddress, result?.blockchain?.tokenId)
  if (itemUrl) return itemUrl

  return normalizeOpenSeaItemUrl(result?.coa?.nftUrl)
}

function getCurationCoaCode(item) {
  const source = String(item?.source || '')
  const match = source.match(/^coa:(.+)$/i)
  return match?.[1] || ''
}

function buildPolygonCoaImageUrl(code) {
  if (!code) return ''
  return `${API_URL}/api/coa-image/${encodeURIComponent(code)}.svg`
}

function isScoreDetectUrl(url) {
  return /scoredetect/i.test(String(url || ''))
}

function extractScoreDetectCode(scoreDetect, url) {
  if (scoreDetect?.certId) return String(scoreDetect.certId)
  if (!isScoreDetectUrl(url)) return ''

  const match = String(url)
    .replace(/[?#].*$/, '')
    .match(/\/([A-Za-z0-9_-]{8,})\/?$/)

  return match?.[1] || ''
}

function buildCertificateImageUrl(result) {
  if (!result?.coa?.imageUrl) return ''
  if (result.coa.imageProxy === false) return result.coa.imageUrl
  return `${API_URL}/api/image/${result.coa.code}`
}

function buildCreateButtonLabel(form, creating) {
  if (creating) return 'Creating...'
  if (form.createScoreDetect && form.mintPolygon) return 'Create COA + Issue All Proofs'
  if (form.createScoreDetect) return 'Create + ScoreDetect'
  if (form.mintPolygon) return 'Create + Mint Polygon NFT'
  return 'Create COA Record'
}

function buildCreatedVerificationResult(createResult) {
  const coa = createResult?.coa
  if (!coa?.coaCode) return null

  const code = coa.coaCode
  const imageUrl = coa.imageUrl || ''
  const polygon = createResult.polygon
  const scoreDetect = createResult.scoreDetect
  const verificationUrl = `${window.location.origin}/AUTHENTICATE/${code}`

  return {
    success: true,
    name: `TrueCOA - ${coa.title || 'Untitled'}`,
    image: imageUrl,
    external_url: verificationUrl,
    coa: {
      code,
      artist: coa.signer || coa.artist || '',
      title: coa.title || 'Untitled',
      date: coa.date || '',
      completionDate: coa.completionDate || new Date().toISOString().slice(0, 10),
      size: coa.dimensions || coa.size || '',
      edition: coa.edition || '',
      medium: coa.medium || '',
      condition: coa.condition || '',
      description: coa.description || '',
      provenance: coa.provenance || '',
      assignor: coa.assignor || '',
      assignee: coa.assignee || '',
      authNotes: coa.authNotes || '',
      authenticator: coa.authenticator || '',
      authenticatorNumber: coa.authenticatorNumber || '',
      authenticatorDate: coa.authenticatorDate || '',
      authenticatorLink: coa.authenticatorLink || '',
      qrCodeUrl: coa.qrCode || '',
      shortUrl: verificationUrl,
      blockchainUrl: coa.blockchainUrl || polygon?.blockchainUrl || '',
      nftUrl: coa.nftUrl || polygon?.nftUrl || '',
      nftTokenId: coa.nftTokenId || polygon?.tokenId || '',
      polygonCoaImageUrl: buildPolygonCoaImageUrl(code),
      certUrl: coa.certUrl || scoreDetect?.verificationUrl || '',
      sku: coa.sku || '',
      imageUrl,
      imageProxy: imageUrl.includes('drive.google.com') && !createResult.warning
    },
    blockchain: polygon?.tokenId ? {
      verified: true,
      tokenId: polygon.tokenId,
      owner: polygon.owner,
      contractAddress: polygon.contractAddress,
      network: 'Polygon'
    } : {
      verified: false,
      reason: 'NFT not minted on Polygon'
    },
    scoreDetect,
    verifiedAt: new Date().toISOString()
  }
}

function displayLinkText(url, fallback) {
  if (!url) return fallback
  return url.replace(/^https?:\/\//, '')
}

function inferArtworkOrientationFromDimensions(value) {
  const clean = String(value || '').replace(/[“”]/g, '"').replace(/[×]/g, 'x')
  const match = clean.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ches)?\.?)?\s*x\s*(\d+(?:\.\d+)?)/i)
  if (!match) return ''

  const width = Number(match[1])
  const height = Number(match[2])
  if (!width || !height || width === height) return ''
  return height > width ? 'portrait' : 'landscape'
}

async function readApiJson(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  let data = {}

  if (text && (contentType.includes('application/json') || /^[\[{]/.test(text.trim()))) {
    try {
      data = JSON.parse(text)
    } catch (error) {
      throw new Error(`Backend returned invalid JSON from ${response.url}`)
    }
  } else if (text) {
    data = { message: text.replace(/\s+/g, ' ').trim().slice(0, 220) }
  }

  if (!response.ok && response.status !== 207) {
    const message = data.message || data.error || fallbackMessage
    throw new Error(`${message} (${response.status} ${response.statusText || 'HTTP error'}: ${response.url})`)
  }

  if (!contentType.includes('application/json') && !/^[\[{]/.test(text.trim())) {
    throw new Error(`Backend returned HTML/text instead of JSON (${response.status}: ${response.url})`)
  }

  return data
}

function isLikelyUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim())
}

function extractFirstUrl(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && isLikelyUrl(line)) || ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })
}

function dataUrlFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not encode image file'))
    reader.readAsDataURL(blob)
  })
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not compress image'))
    }, type, quality)
  })
}

function replaceImageExtension(fileName, extension) {
  const clean = String(fileName || 'artwork-image').replace(/\.[a-z0-9]{2,5}$/i, '')
  return `${clean || 'artwork-image'}.${extension}`
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function countPrintChars(value) {
  return String(value || '').trim().length
}

function getPrintCopyStatus(count, target, grace = PRINT_COPY_TOTAL_GRACE) {
  if (count <= target) return 'good'
  if (count <= target + grace) return 'near'
  return 'over'
}

function buildPrintCopyMessage(count) {
  const difference = count - PRINT_COPY_TOTAL_TARGET
  if (difference <= 0) return `${Math.abs(difference)} chars available across condition, description, and provenance.`
  if (difference <= PRINT_COPY_TOTAL_GRACE) return `${difference} chars over the soft target. That is usually fine if the certificate preview still looks clean.`
  return `${difference} chars over the safe print target. Trim one or more fields before creating the COA.`
}

function splitTokenList(value) {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildConditionValue(grade, detailsValue) {
  const cleanGrade = String(grade || '').trim()
  const details = splitTokenList(detailsValue)
  if (!cleanGrade) return details.join(', ')
  if (!details.length) return cleanGrade
  return `${cleanGrade}; ${details.join(', ')}`
}

function buildDateValue(form) {
  const mode = form.dateMode || 'exact'
  const year = String(form.dateYear || '').trim()
  const rangeStart = String(form.dateRangeStart || '').trim()
  const rangeEnd = String(form.dateRangeEnd || '').trim()

  if (mode === 'unknown') return 'Unknown'
  if (mode === 'undated') return 'Undated'
  if (mode === 'circa') return year ? `c. ${year}` : ''
  if (mode === 'dated') return year ? `Dated ${year}` : ''
  if (mode === 'range') {
    if (rangeStart && rangeEnd) return `${rangeStart}-${rangeEnd}`
    return rangeStart || rangeEnd
  }

  return year
}

function inferDateBuilder(value) {
  const clean = String(value || '').trim()
  if (!clean) return {}
  if (/^unknown$/i.test(clean)) return { dateMode: 'unknown', date: 'Unknown', dateYear: '', dateRangeStart: '', dateRangeEnd: '' }
  if (/^undated$/i.test(clean)) return { dateMode: 'undated', date: 'Undated', dateYear: '', dateRangeStart: '', dateRangeEnd: '' }

  const circaMatch = clean.match(/^c(?:irca)?\.?\s*(\d{4})$/i)
  if (circaMatch) return { dateMode: 'circa', dateYear: circaMatch[1], dateRangeStart: '', dateRangeEnd: '', date: `c. ${circaMatch[1]}` }

  const datedMatch = clean.match(/^dated\s+(\d{4})$/i)
  if (datedMatch) return { dateMode: 'dated', dateYear: datedMatch[1], dateRangeStart: '', dateRangeEnd: '', date: `Dated ${datedMatch[1]}` }

  const rangeMatch = clean.match(/^(\d{4})\s*[-/]\s*(\d{4})$/)
  if (rangeMatch) {
    return {
      dateMode: 'range',
      dateYear: '',
      dateRangeStart: rangeMatch[1],
      dateRangeEnd: rangeMatch[2],
      date: `${rangeMatch[1]}-${rangeMatch[2]}`
    }
  }

  if (/^\d{4}$/.test(clean)) return { dateMode: 'exact', dateYear: clean, dateRangeStart: '', dateRangeEnd: '', date: clean }
  return { date: clean }
}

function inferConditionBuilder(value) {
  const clean = String(value || '').trim()
  if (!clean) return {}

  const matchedGrade = CONDITION_OPTIONS.find((option) => (
    clean.toLowerCase() === option.value.toLowerCase() ||
    clean.toLowerCase().startsWith(`${option.value.toLowerCase()};`)
  ))
  if (!matchedGrade) return { condition: clean, conditionGrade: clean, conditionDetails: '' }

  const detailText = clean.slice(matchedGrade.value.length).replace(/^;\s*/, '')
  const selectedDetails = CONDITION_DETAIL_OPTIONS
    .filter((option) => detailText.toLowerCase().includes(option.value.toLowerCase()))
    .map((option) => option.value)
    .join('|')

  return {
    condition: clean,
    conditionGrade: matchedGrade.value,
    conditionDetails: selectedDetails
  }
}

function buildEvidenceSummary(form) {
  return [
    form.evidencePlatform,
    form.evidenceSeller && `Seller: ${form.evidenceSeller}`,
    form.evidenceReference && `Ref: ${form.evidenceReference}`,
    form.evidenceDocuments,
    form.evidenceNotes
  ].filter(Boolean).join(' | ')
}

function getCoaTypeTemplate(id) {
  return COA_TYPE_TEMPLATES.find((template) => template.id === id) || COA_TYPE_TEMPLATES[0]
}

function getMediumOptionsForType(coaType) {
  return MEDIUM_OPTIONS_BY_TYPE[coaType] || MEDIUM_OPTIONS_BY_TYPE.artwork
}

function isStandardMedium(coaType, medium) {
  return getMediumOptionsForType(coaType).includes(String(medium || '').trim())
}

function buildSportsTemplatePatch(form) {
  const player = String(form.sportsPlayer || '').trim()
  const team = String(form.sportsTeam || '').trim()
  const league = String(form.sportsLeague || '').trim()
  const itemType = String(form.sportsItemType || '').trim()
  const signature = String(form.sportsSignature || '').trim()
  const authenticator = String(form.sportsAuthenticator || '').trim()
  const certNumber = String(form.sportsCertNumber || '').trim()
  const source = String(form.sportsSource || '').trim()
  const subject = [player, team].filter(Boolean).join(' - ')
  const title = [subject || player || team, itemType].filter(Boolean).join(' ')
  const authText = [
    authenticator && certNumber && `${authenticator} cert ${certNumber}`,
    authenticator && !certNumber && authenticator,
    !authenticator && certNumber && `cert ${certNumber}`
  ].filter(Boolean)[0] || ''
  const descriptionParts = [
    [league, itemType || 'sports memorabilia'].filter(Boolean).join(' '),
    player && `associated with ${player}`,
    team && `of the ${team}`,
    signature && `Signature notes: ${signature}.`,
    authText && `Third-party authentication: ${authText}.`
  ].filter(Boolean)
  const provenanceParts = [
    source && `Source: ${source}.`,
    form.evidenceDocuments && `${form.evidenceDocuments}.`
  ].filter(Boolean)

  return {
    signer: player || form.signer,
    title: title || form.title,
    medium: itemType || form.medium || 'Sports memorabilia',
    mediumMode: 'standard',
    description: descriptionParts.join(' ').replace(/\s+/g, ' ').trim(),
    provenance: provenanceParts.join(' ').replace(/\s+/g, ' ').trim() || form.provenance,
    authenticator: authenticator || form.authenticator,
    authenticatorNumber: certNumber || form.authenticatorNumber,
    authNotes: [signature, authText].filter(Boolean).join(' | '),
    evidenceSeller: source || form.evidenceSeller
  }
}

function buildTemplatePatch(form) {
  if (form.coaType === 'sports') return buildSportsTemplatePatch(form)

  const template = getCoaTypeTemplate(form.coaType)
  return {
    ...template.defaults,
    mediumMode: 'standard',
    medium: form.medium || template.defaults.medium || ''
  }
}

function getImagePreflightStatus(form, imageUpload, imagePreviewStatus) {
  if (imageUpload.status === 'uploading') {
    return { status: 'warn', detail: 'Image upload is still running.' }
  }
  if (imageUpload.status === 'error' || imagePreviewStatus === 'error') {
    return { status: 'error', detail: 'Artwork image did not load. Replace the URL or upload the file.' }
  }
  if (!form.imageUrl) {
    return { status: 'warn', detail: 'No artwork image selected.' }
  }
  if (form.imageUrl.startsWith('data:') || imageUpload.status === 'ready' || imagePreviewStatus === 'loaded') {
    return { status: 'good', detail: 'Artwork image is ready.' }
  }
  return { status: 'warn', detail: 'Image URL added; preview is still checking.' }
}

function buildPreflightChecks({ form, printCopyStatus, imageUpload, imagePreviewStatus }) {
  const missingRequired = [
    !form.signer && 'artist/signer',
    !form.title && 'title'
  ].filter(Boolean)
  const imageStatus = getImagePreflightStatus(form, imageUpload, imagePreviewStatus)
  const hasEvidence = Boolean(form.evidenceReference || form.evidenceSeller || form.evidenceDocuments || form.evidenceNotes)
  const hasProvenanceSource = Boolean(form.provenanceSource || form.provenance)

  return [
    {
      key: 'required',
      label: 'Required fields',
      status: missingRequired.length ? 'error' : 'good',
      detail: missingRequired.length ? `Missing ${missingRequired.join(' and ')}.` : 'Artist/signer and title are ready.'
    },
    {
      key: 'image',
      label: 'Artwork image',
      ...imageStatus
    },
    {
      key: 'copy',
      label: 'Print copy',
      status: printCopyStatus === 'over' ? 'error' : printCopyStatus === 'near' ? 'warn' : 'good',
      detail: printCopyStatus === 'over'
        ? 'Copy is over the safe print target.'
        : printCopyStatus === 'near'
          ? 'Copy is a little tight; preview should still be checked.'
          : 'Copy is inside the safe print target.'
    },
    {
      key: 'provenance',
      label: 'Provenance',
      status: hasProvenanceSource ? 'good' : 'warn',
      detail: hasProvenanceSource ? 'Source language is recorded.' : 'Choose a source or add provenance copy.'
    },
    {
      key: 'evidence',
      label: 'Evidence',
      status: hasEvidence ? 'good' : 'warn',
      detail: hasEvidence ? 'Source evidence is logged for operations.' : 'Add invoice, seller, or retained-doc notes when available.'
    },
    {
      key: 'scoredetect',
      label: 'ScoreDetect',
      status: form.createScoreDetect ? 'good' : 'warn',
      detail: form.createScoreDetect ? 'Will create a ScoreDetect record.' : 'Not selected for this create.'
    },
    {
      key: 'polygon',
      label: 'Polygon',
      status: form.mintPolygon ? 'good' : 'warn',
      detail: form.mintPolygon ? 'Will mint the Polygon NFT.' : 'Not selected for this create.'
    }
  ]
}

async function prepareImageUpload(file) {
  if (file.type === 'image/gif') {
    return {
      fileName: file.name,
      contentType: file.type,
      dataUrl: await readFileAsDataUrl(file),
      compressed: false,
      originalBytes: file.size,
      uploadBytes: file.size
    }
  }

  const image = await loadImageFromFile(file)
  const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  const scale = Math.min(1, IMAGE_UPLOAD_MAX_DIMENSION / largestSide)
  const shouldCompress = file.size > IMAGE_UPLOAD_TARGET_BYTES || scale < 1

  if (!shouldCompress) {
    return {
      fileName: file.name,
      contentType: file.type,
      dataUrl: await readFileAsDataUrl(file),
      compressed: false,
      originalBytes: file.size,
      uploadBytes: file.size
    }
  }

  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))

  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let quality = 0.86
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  while (blob.size > IMAGE_UPLOAD_TARGET_BYTES && quality > 0.58) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  }

  return {
    fileName: replaceImageExtension(file.name, 'jpg'),
    contentType: 'image/jpeg',
    dataUrl: await dataUrlFromBlob(blob),
    compressed: true,
    originalBytes: file.size,
    uploadBytes: blob.size
  }
}

function App() {
  const [mode, setMode] = useState('verify')
  const [coaCode, setCoaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showCert, setShowCert] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM)
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [imageDragActive, setImageDragActive] = useState(false)
  const [imageUpload, setImageUpload] = useState({ status: 'idle', message: '' })
  const [coaAssistantPrompt, setCoaAssistantPrompt] = useState('')
  const [coaAssistantLoading, setCoaAssistantLoading] = useState(false)
  const [coaAssistantError, setCoaAssistantError] = useState(null)
  const [coaAssistantResult, setCoaAssistantResult] = useState(null)
  const [imagePreviewStatus, setImagePreviewStatus] = useState('idle')
  const [certificateArtOrientation, setCertificateArtOrientation] = useState('landscape')
  const [integrationHealth, setIntegrationHealth] = useState(null)
  const [integrationHealthLoading, setIntegrationHealthLoading] = useState(false)
  const [integrationHealthError, setIntegrationHealthError] = useState(null)
  const [authRetrying, setAuthRetrying] = useState('')
  const [authRetryError, setAuthRetryError] = useState(null)
  const [curationItems, setCurationItems] = useState(INITIAL_CURATION_ITEMS)
  const [wishlistItems, setWishlistItems] = useState(INITIAL_WISHLIST_ITEMS)
  const [wishlistDraft, setWishlistDraft] = useState(EMPTY_WISHLIST_DRAFT)
  const [managementLoading, setManagementLoading] = useState(false)
  const [managementSaving, setManagementSaving] = useState(false)
  const [managementError, setManagementError] = useState(null)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const imageFileInputRef = useRef(null)

  // Reinitialize ScoreDetect widget when result is shown
  useEffect(() => {
    if (result && window.SDWidgets) {
      window.SDWidgets.init()
    }
  }, [result])

  // Check URL for code parameter (supports ?code=X and /AUTHENTICATE/X and /verify/X)
  useEffect(() => {
    // Check query parameter first
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    if (codeParam) {
      setCoaCode(codeParam)
      handleVerify(codeParam)
      return
    }

    // Check path-based routes: /AUTHENTICATE/290745 or /verify/290745
    const path = window.location.pathname
    const authenticateMatch = path.match(/\/(?:AUTHENTICATE|authenticate|verify)\/([A-Za-z0-9-]+)/i)
    if (authenticateMatch) {
      const code = authenticateMatch[1]
      setCoaCode(code)
      handleVerify(code)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadStoredManagementItems = async () => {
      setManagementLoading(true)
      setManagementError(null)

      try {
        const [curationResponse, wishlistResponse] = await Promise.all([
          fetch(`${API_URL}/api/curation`),
          fetch(`${API_URL}/api/wishlist`)
        ])
        const [curationData, wishlistData] = await Promise.all([
          readApiJson(curationResponse, 'Failed to load curation records'),
          readApiJson(wishlistResponse, 'Failed to load wishlist records')
        ])

        if (cancelled) return
        setCurationItems(Array.isArray(curationData.items) ? curationData.items : [])
        setWishlistItems(Array.isArray(wishlistData.items) ? wishlistData.items : [])
      } catch (err) {
        if (!cancelled) {
          setManagementError(`Stored lists are unavailable: ${err.message || 'Unable to load records'}`)
        }
      } finally {
        if (!cancelled) setManagementLoading(false)
      }
    }

    loadStoredManagementItems()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!createForm.imageUrl) {
      setImagePreviewStatus('idle')
      return
    }

    setImagePreviewStatus(createForm.imageUrl.startsWith('data:') ? 'loaded' : 'checking')
  }, [createForm.imageUrl])

  useEffect(() => {
    setCertificateArtOrientation(inferArtworkOrientationFromDimensions(result?.coa?.size) || 'landscape')
  }, [result?.coa?.code, result?.coa?.size])

  const handleVerify = async (code = coaCode) => {
    if (!code.trim()) {
      setError('Please enter a COA code')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/api/verify/${encodeURIComponent(code.trim())}`)
      const data = await readApiJson(response, 'Verification failed')

      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to verify COA')
    } finally {
      setLoading(false)
    }
  }

  const startScanner = async () => {
    setShowScanner(true)

    // Dynamically import html5-qrcode
    const { Html5Qrcode } = await import('html5-qrcode')

    setTimeout(async () => {
      if (scannerRef.current && !html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader')
        try {
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              // Extract code from various formats
              let code = decodedText

              // Handle "AUTHENTICATE/290745" format from stickers
              const authMatch = decodedText.match(/AUTHENTICATE\/([A-Za-z0-9-]+)/i)
              if (authMatch) {
                code = authMatch[1]
              } else {
                // Try URL format
                try {
                  const url = new URL(decodedText)
                  code = url.searchParams.get('code') || url.pathname.match(/\/([A-Za-z0-9-]+)$/)?.[1] || decodedText
                } catch {}
              }

              setCoaCode(code)
              stopScanner()
              handleVerify(code)
            },
            () => {}
          )
        } catch (err) {
          setError('Failed to start camera. Please enter code manually.')
          setShowScanner(false)
        }
      }
    }, 100)
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      } catch {}
    }
    setShowScanner(false)
  }

  const resetForm = () => {
    setResult(null)
    setError(null)
    setShowCert(false)
    setCoaCode('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError(null)
    setCreateError(null)
    setShowCert(false)
  }

  const handleCreateChange = (event) => {
    const { name, value, type, checked } = event.target
    setCreateForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleCoaTypeChange = (value) => {
    const template = getCoaTypeTemplate(value)
    setCreateForm((current) => ({
      ...current,
      ...template.defaults,
      coaType: value,
      mediumMode: template.defaults.medium ? 'standard' : 'standard'
    }))
    setCreateError(null)
    setIntegrationHealth(null)
  }

  const handleMediumPresetChange = (value) => {
    setCreateForm((current) => ({
      ...current,
      mediumMode: value === '__custom' ? 'custom' : 'standard',
      medium: value === '__custom' ? (isStandardMedium(current.coaType, current.medium) ? '' : current.medium) : value
    }))
    setCreateError(null)
  }

  const applyTemplateCopy = () => {
    setCreateForm((current) => ({
      ...current,
      ...buildTemplatePatch(current)
    }))
    setCreateError(null)
  }

  const handleDateBuilderChange = (name, value) => {
    setCreateForm((current) => {
      const next = {
        ...current,
        [name]: value
      }
      return {
        ...next,
        date: buildDateValue(next)
      }
    })
    setCreateError(null)
  }

  const handleConditionGradeChange = (value) => {
    setCreateForm((current) => {
      const next = {
        ...current,
        conditionGrade: value
      }
      return {
        ...next,
        condition: buildConditionValue(value, next.conditionDetails)
      }
    })
    setCreateError(null)
  }

  const toggleConditionDetail = (value) => {
    setCreateForm((current) => {
      const selected = splitTokenList(current.conditionDetails)
      const nextSelected = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
      const conditionDetails = nextSelected.join('|')
      return {
        ...current,
        conditionDetails,
        condition: buildConditionValue(current.conditionGrade, conditionDetails)
      }
    })
    setCreateError(null)
  }

  const handleCreateImageUrlChange = (event) => {
    const { value } = event.target
    setCreateForm((current) => ({
      ...current,
      imageUrl: value
    }))
    setImageUpload(value ? { status: 'ready', message: 'Image link ready' } : { status: 'idle', message: '' })
    setIntegrationHealth(null)
  }

  const uploadCreateImage = async (file) => {
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      setImageUpload({ status: 'error', message: 'Use a JPG, PNG, WEBP, or GIF image' })
      return
    }

    setImageUpload({ status: 'uploading', message: 'Preparing image...' })
    setCreateError(null)

    try {
      const preparedImage = await prepareImageUpload(file)
      setImageUpload({
        status: 'uploading',
        message: preparedImage.compressed
          ? `Compressed ${formatBytes(preparedImage.originalBytes)} to ${formatBytes(preparedImage.uploadBytes)}. Uploading...`
          : 'Uploading image...'
      })
      const response = await fetch(`${API_URL}/api/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: preparedImage.fileName,
          contentType: preparedImage.contentType,
          dataUrl: preparedImage.dataUrl
        })
      })
      const data = await readApiJson(response, 'Image upload failed')

      setCreateForm((current) => ({
        ...current,
        imageUrl: data.imageUrl
      }))
      setImageUpload({
        status: 'ready',
        message: preparedImage.compressed
          ? `Image uploaded (${formatBytes(preparedImage.originalBytes)} compressed to ${formatBytes(preparedImage.uploadBytes)})`
          : 'Image uploaded'
      })
    } catch (err) {
      setImageUpload({ status: 'error', message: err.message || 'Image upload failed' })
    }
  }

  const handleImageFileSelect = (event) => {
    uploadCreateImage(event.target.files?.[0])
    event.target.value = ''
  }

  const handleImageDrop = (event) => {
    event.preventDefault()
    setImageDragActive(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      uploadCreateImage(droppedFile)
      return
    }

    const droppedUrl = extractFirstUrl(event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain'))
    if (droppedUrl) {
      setCreateForm((current) => ({
        ...current,
        imageUrl: droppedUrl
      }))
      setImageUpload({ status: 'ready', message: 'Image link ready' })
    }
  }

  const handleImagePaste = (event) => {
    const pastedFile = Array.from(event.clipboardData.files || []).find((file) => file.type.startsWith('image/'))
    if (pastedFile) {
      event.preventDefault()
      uploadCreateImage(pastedFile)
    }
  }

  const handleCoaAssistantSubmit = async (event) => {
    event.preventDefault()
    if (imageUpload.status === 'uploading') return

    setCoaAssistantLoading(true)
    setCoaAssistantError(null)
    setCoaAssistantResult(null)

    try {
      const response = await fetch(`${API_URL}/api/coa-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: coaAssistantPrompt,
          form: createForm
        })
      })
      const data = await readApiJson(response, 'COA helper failed')

      setCoaAssistantResult(data)
    } catch (err) {
      setCoaAssistantError(err.message || 'COA helper failed')
    } finally {
      setCoaAssistantLoading(false)
    }
  }

  const applyCoaAssistantSuggestions = () => {
    const suggestions = coaAssistantResult?.suggestions || {}
    setCreateForm((current) => {
      const next = { ...current }
      COA_ASSISTANT_FIELDS.forEach((field) => {
        const value = String(suggestions[field] || '').trim()
        if (!value) return
        if (field === 'date') {
          Object.assign(next, inferDateBuilder(value))
        } else if (field === 'condition') {
          Object.assign(next, inferConditionBuilder(value))
        } else if (field === 'medium') {
          next.medium = value
          next.mediumMode = isStandardMedium(next.coaType, value) ? 'standard' : 'custom'
        } else {
          next[field] = value
        }
      })
      return next
    })
    setCreateError(null)
  }

  const applyProvenancePreset = (preset) => {
    setCreateForm((current) => ({
      ...current,
      provenanceSource: preset.id,
      provenance: preset.value,
      evidencePlatform: preset.platform || current.evidencePlatform
    }))
    setCreateError(null)
  }

  const handleProvenanceSourceChange = (value) => {
    const preset = PROVENANCE_PRESETS.find((item) => item.id === value)
    setCreateForm((current) => ({
      ...current,
      provenanceSource: value,
      provenance: preset?.value || current.provenance,
      evidencePlatform: preset?.platform || current.evidencePlatform
    }))
    setCreateError(null)
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    if (imageUpload.status === 'uploading') return
    if (createForm.createScoreDetect && !createForm.imageUrl.trim()) {
      setCreateError('Upload an artwork image before creating a ScoreDetect record.')
      return
    }
    setCreating(true)
    setCreateError(null)
    setCreateResult(null)
    setAuthRetryError(null)

    const payload = {
      ...createForm,
      evidenceSummary: buildEvidenceSummary(createForm),
      recipient: createForm.recipient.trim() || undefined
    }
    const retryRecipient = createForm.recipient.trim()
    const requestedServices = {
      scoreDetect: Boolean(createForm.createScoreDetect),
      polygon: Boolean(createForm.mintPolygon)
    }

    try {
      const response = await fetch(`${API_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await readApiJson(response, 'Failed to create COA')

      setCreateResult({
        ...data,
        retryRecipient,
        requestedServices
      })
      if (data.curation?.item) {
        setCurationItems((items) => {
          const existingIndex = items.findIndex((item) => item.id === data.curation.item.id)
          if (existingIndex === -1) return [data.curation.item, ...items]
          return items.map((item, index) => index === existingIndex ? data.curation.item : item)
        })
      }
      setCreateForm(DEFAULT_CREATE_FORM)
      setCoaAssistantPrompt('')
      setCoaAssistantResult(null)
      setImageUpload({ status: 'idle', message: '' })
    } catch (err) {
      setCreateError(err.message || 'Failed to create COA')
    } finally {
      setCreating(false)
    }
  }

  const runIntegrationHealthCheck = async () => {
    setIntegrationHealthLoading(true)
    setIntegrationHealthError(null)

    try {
      const response = await fetch(`${API_URL}/api/health/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: createForm.imageUrl
        })
      })
      const data = await readApiJson(response, 'Integration health check failed')
      setIntegrationHealth(data)
    } catch (err) {
      setIntegrationHealthError(err.message || 'Integration health check failed')
    } finally {
      setIntegrationHealthLoading(false)
    }
  }

  const retryAuthenticationService = async (service) => {
    if (!createResult?.coa || authRetrying) return

    setAuthRetrying(service)
    setAuthRetryError(null)

    try {
      const response = await fetch(`${API_URL}/api/create/retry-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coa: createResult.coa,
          service,
          createScoreDetect: service === 'ScoreDetect',
          mintPolygon: service === 'Polygon',
          recipient: createResult.retryRecipient || undefined
        })
      })
      const data = await readApiJson(response, `Failed to retry ${service}`)

      setCreateResult((current) => {
        const remainingErrors = (current.operationErrors || []).filter((operationError) => operationError.service !== service)
        return {
          ...current,
          ...data,
          coa: {
            ...current.coa,
            ...data.coa
          },
          scoreDetect: data.scoreDetect || current.scoreDetect,
          polygon: data.polygon || current.polygon,
          operationErrors: [
            ...remainingErrors,
            ...(data.operationErrors || [])
          ],
          retryRecipient: current.retryRecipient
        }
      })
    } catch (err) {
      setAuthRetryError(err.message || `Failed to retry ${service}`)
    } finally {
      setAuthRetrying('')
    }
  }

  const startCreateFromItem = (item) => {
    setCreateForm({
      ...DEFAULT_CREATE_FORM,
      signer: item.artist || '',
      title: item.title || '',
      medium: item.category || '',
      description: item.notes || '',
      sku: item.sku || '',
      sourceCurationId: item.id || ''
    })
    setImageUpload({ status: 'idle', message: '' })
    setCoaAssistantPrompt('')
    setCoaAssistantResult(null)
    setCoaAssistantError(null)
    setCreateResult(null)
    setAuthRetryError(null)
    switchMode('create')
  }

  const updateCurationStatus = async (id, status) => {
    const previousItems = curationItems
    setCurationItems((items) => items.map((item) => (
      item.id === id ? { ...item, status } : item
    )))
    setManagementError(null)

    try {
      const response = await fetch(`${API_URL}/api/curation/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await readApiJson(response, 'Failed to update curation status')
      if (data.item) {
        setCurationItems((items) => items.map((item) => (
          item.id === id ? data.item : item
        )))
      }
    } catch (err) {
      setCurationItems(previousItems)
      setManagementError(err.message || 'Failed to update curation status')
    }
  }

  const handleWishlistDraftChange = (event) => {
    const { name, value } = event.target
    setWishlistDraft((draft) => ({
      ...draft,
      [name]: value
    }))
  }

  const handleWishlistSubmit = async (event) => {
    event.preventDefault()
    const artist = wishlistDraft.artist.trim()
    const title = wishlistDraft.title.trim()
    if (!artist && !title) return

    setManagementSaving(true)
    setManagementError(null)
    try {
      const response = await fetch(`${API_URL}/api/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist,
          title,
          priority: wishlistDraft.priority,
          notes: wishlistDraft.notes.trim()
        })
      })
      const data = await readApiJson(response, 'Failed to store wishlist record')
      setWishlistItems((items) => data.item ? [data.item, ...items] : items)
      setWishlistDraft(EMPTY_WISHLIST_DRAFT)
    } catch (err) {
      setManagementError(err.message || 'Failed to store wishlist record')
    } finally {
      setManagementSaving(false)
    }
  }

  const addWishlistToCuration = async (item) => {
    setManagementSaving(true)
    setManagementError(null)

    try {
      const response = await fetch(`${API_URL}/api/curation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: item.artist,
          title: item.title,
          category: 'Wishlist',
          priority: item.priority,
          status: 'Reviewing',
          notes: item.notes,
          source: `wishlist:${item.id}`
        })
      })
      const data = await readApiJson(response, 'Failed to store curation record')
      setCurationItems((items) => data.item ? [data.item, ...items] : items)
      switchMode('curation')
    } catch (err) {
      setManagementError(err.message || 'Failed to store curation record')
    } finally {
      setManagementSaving(false)
    }
  }

  const removeWishlistItem = async (id) => {
    const previousItems = wishlistItems
    setWishlistItems((items) => items.filter((item) => item.id !== id))
    setManagementError(null)

    try {
      const response = await fetch(`${API_URL}/api/wishlist/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
      await readApiJson(response, 'Failed to remove wishlist record')
    } catch (err) {
      setWishlistItems(previousItems)
      setManagementError(err.message || 'Failed to remove wishlist record')
    }
  }

  const verifyCreatedCOA = () => {
    const code = createResult?.coa?.coaCode
    if (!code) return
    switchMode('verify')
    setCoaCode(code)
    handleVerify(code)
  }

  const downloadCreatedCOA = () => {
    const createdResult = buildCreatedVerificationResult(createResult)
    if (!createdResult) return
    setMode('verify')
    setError(null)
    setCreateError(null)
    setCoaCode(createdResult.coa.code)
    setResult(createdResult)
    printCertificate()
  }

  const printCertificate = () => {
    setShowCert(true)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(async () => {
        const images = Array.from(document.querySelectorAll('.coa-certificate img'))
        const waitForImage = (image) => {
          if (image.complete) return Promise.resolve()

          return new Promise((resolve) => {
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              image.removeEventListener('load', finish)
              image.removeEventListener('error', finish)
              window.clearTimeout(timeout)
              resolve()
            }
            const timeout = window.setTimeout(finish, 5000)
            image.addEventListener('load', finish, { once: true })
            image.addEventListener('error', finish, { once: true })
          })
        }

        await Promise.all(images.map(waitForImage))
        if (document.fonts?.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise((resolve) => window.setTimeout(resolve, 1000))
          ])
        }
        window.print()
      })
    })
  }

  const verificationUrl = result ? buildQrValue(result) : ''
  const blockchainUrl = result ? buildBlockchainLink(result) : ''
  const footerBlockchainUrl = blockchainUrl || DEFAULT_CONTRACT_URL
  const nftUrl = result ? buildNftLink(result) : ''
  const polygonCoaImageUrl = result ? result.coa.polygonCoaImageUrl || buildPolygonCoaImageUrl(result.coa.code) : ''
  const certificateUrl = result?.coa.certUrl || ''
  const scoreDetectRecord = result?.scoreDetect || null
  const scoreDetectUrl = scoreDetectRecord?.verificationUrl || result?.coa?.scoreDetectUrl || (isScoreDetectUrl(certificateUrl) ? certificateUrl : '')
  const scoreDetectCode = extractScoreDetectCode(scoreDetectRecord, scoreDetectUrl)
  const scoreDetectTransactionUrl = scoreDetectRecord?.transactionUrl || ''
  const certificateImageUrl = buildCertificateImageUrl(result)
  const hasPolygonRecord = Boolean(result?.blockchain?.verified || result?.coa.blockchainUrl)
  const polygonTokenId = result?.blockchain?.tokenId || result?.coa?.nftTokenId || ''
  const createImagePreviewUrl = createForm.imageUrl && !createForm.imageUrl.startsWith('data:') ? createForm.imageUrl : ''
  const imageUploading = imageUpload.status === 'uploading'
  const createdCoaCode = createResult?.coa?.coaCode || ''
  const createdVerificationUrl = createdCoaCode ? `${window.location.origin}/AUTHENTICATE/${encodeURIComponent(createdCoaCode)}` : ''
  const createdMetadataUrl = createdCoaCode ? `${API_URL}/api/nft/${encodeURIComponent(createdCoaCode)}` : ''
  const createdPolygonCoaImageUrl = createdCoaCode ? buildPolygonCoaImageUrl(createdCoaCode) : ''
  const createdScoreDetectUrl = createResult?.scoreDetect?.verificationUrl || createResult?.coa?.scoreDetectUrl || (isScoreDetectUrl(createResult?.coa?.certUrl) ? createResult.coa.certUrl : '')
  const createdScoreDetectTransactionUrl = createResult?.scoreDetect?.transactionUrl || createResult?.coa?.scoreDetectTransactionUrl || ''
  const createdBlockchainUrl = createResult?.polygon?.blockchainUrl || createResult?.coa?.blockchainUrl || ''
  const createdNftUrl = buildOpenSeaItemUrl(createResult?.polygon?.contractAddress, createResult?.polygon?.tokenId)
    || normalizeOpenSeaItemUrl(createResult?.polygon?.nftUrl || createResult?.coa?.nftUrl)
  const scoreDetectLink = scoreDetectUrl || SCOREDETECT_HOME_URL
  const openSeaLink = nftUrl || OPENSEA_COLLECTION_URL
  const createdPolygonTransactionUrl = createResult?.polygon?.transactionUrl || ''
  const createdScoreDetectError = (createResult?.operationErrors || []).find((item) => item.service === 'ScoreDetect')?.message || ''
  const createdPolygonError = (createResult?.operationErrors || []).find((item) => item.service === 'Polygon')?.message || ''
  const requestedScoreDetect = createResult?.requestedServices?.scoreDetect ?? Boolean(createResult?.scoreDetect)
  const requestedPolygon = createResult?.requestedServices?.polygon ?? Boolean(createResult?.polygon)
  const createdScoreDetectState = createdScoreDetectUrl
    ? { label: 'View ScoreDetect', detail: 'Timestamp certificate ready', status: 'ready' }
    : createdScoreDetectError
      ? { label: 'ScoreDetect needs retry', detail: createdScoreDetectError, status: 'needs-attention' }
      : requestedScoreDetect
        ? { label: 'ScoreDetect pending', detail: 'The timestamp certificate is still being prepared.', status: 'pending' }
        : { label: 'ScoreDetect not selected', detail: 'No ScoreDetect certificate was requested for this COA.', status: 'not-selected' }
  const createdOpenSeaState = createdNftUrl
    ? { label: 'View NFT on OpenSea', detail: 'Polygon NFT ready', status: 'ready' }
    : createdPolygonError
      ? { label: 'Polygon mint needs retry', detail: createdPolygonError, status: 'needs-attention' }
      : requestedPolygon
        ? { label: 'OpenSea pending', detail: 'The Polygon NFT is still being prepared.', status: 'pending' }
        : { label: 'Polygon mint not selected', detail: 'No Polygon NFT was requested for this COA.', status: 'not-selected' }
  const issuedProofCount = [createdCoaCode, createdScoreDetectUrl, createdNftUrl].filter(Boolean).length
  const createdPlatformLinks = [
    { label: 'View COA', url: createdVerificationUrl },
    { label: 'TrueCOA metadata', url: createdMetadataUrl },
    { label: 'COA image', url: createdPolygonCoaImageUrl },
    { label: 'ScoreDetect', url: createdScoreDetectUrl },
    { label: 'ScoreDetect transaction', url: createdScoreDetectTransactionUrl },
    { label: 'Polygon token', url: createdBlockchainUrl },
    { label: 'Polygon transaction', url: createdPolygonTransactionUrl },
    { label: 'OpenSea NFT', url: createdNftUrl }
  ].filter((link) => link.url)
  const promotedCreatedLinkLabels = ['View COA', 'ScoreDetect', 'OpenSea NFT']
  const createdSecondaryLinks = createdPlatformLinks.filter(
    (link) => !promotedCreatedLinkLabels.includes(link.label)
  )
  const coaAssistantSuggestions = coaAssistantResult?.suggestions || {}
  const visibleCoaAssistantSuggestions = COA_ASSISTANT_FIELDS
    .map((field) => ({
      field,
      label: COA_ASSISTANT_LABELS[field],
      value: String(coaAssistantSuggestions[field] || '').trim()
    }))
    .filter((item) => item.value)
  const printCopyStats = [
    {
      field: 'condition',
      label: 'Condition',
      count: countPrintChars(createForm.condition),
      target: PRINT_COPY_LIMITS.condition,
      note: 'one-line row'
    },
    {
      field: 'description',
      label: 'Description / Summary',
      count: countPrintChars(createForm.description),
      target: PRINT_COPY_LIMITS.description,
      note: '6 print lines'
    },
    {
      field: 'provenance',
      label: 'Provenance',
      count: countPrintChars(createForm.provenance),
      target: PRINT_COPY_LIMITS.provenance,
      note: '4 print lines'
    }
  ].map((item) => ({
    ...item,
    status: getPrintCopyStatus(item.count, item.target, item.field === 'condition' ? 18 : PRINT_COPY_TOTAL_GRACE)
  }))
  const printCopyTotal = printCopyStats.reduce((total, item) => total + item.count, 0)
  const printCopyStatus = getPrintCopyStatus(printCopyTotal, PRINT_COPY_TOTAL_TARGET)
  const printCopyMeterWidth = `${Math.min(100, Math.round((printCopyTotal / PRINT_COPY_TOTAL_TARGET) * 100))}%`
  const printCopyMessage = buildPrintCopyMessage(printCopyTotal)
  const selectedConditionDetails = splitTokenList(createForm.conditionDetails)
  const selectedProvenancePreset = PROVENANCE_PRESETS.find((preset) => preset.id === createForm.provenanceSource)
  const selectedCoaTemplate = getCoaTypeTemplate(createForm.coaType)
  const isSportsTemplate = createForm.coaType === 'sports'
  const evidenceSummary = buildEvidenceSummary(createForm)
  const preflightChecks = buildPreflightChecks({
    form: createForm,
    printCopyStatus,
    imageUpload,
    imagePreviewStatus
  })
  const preflightReadyCount = preflightChecks.filter((check) => check.status === 'good').length
  const preflightErrorCount = preflightChecks.filter((check) => check.status === 'error').length
  const showDateYearSelect = ['exact', 'circa', 'dated'].includes(createForm.dateMode)
  const showDateRangeSelects = createForm.dateMode === 'range'
  const createPreviewImageUrl = createForm.imageUrl || ''
  const createPreviewCode = createForm.coaCode || 'Auto-generated'
  const retryableServices = [...new Set((createResult?.operationErrors || [])
    .map((operationError) => operationError.service)
    .filter((service) => ['ScoreDetect', 'Polygon'].includes(service)))]
  const integrationChecks = integrationHealth?.checks || []
  const integrationReadyCount = integrationChecks.filter((check) => check.status === 'good').length
  const hasCustomConditionValue = Boolean(
    createForm.condition &&
    !CONDITION_OPTIONS.some((option) => option.value === createForm.condition)
  )
  const hasThirdPartyAuthentication = Boolean(
    result?.coa.authenticator ||
    result?.coa.authenticatorNumber ||
    result?.coa.authenticatorDate ||
    result?.coa.authenticatorLink ||
    result?.coa.authNotes
  )

  return (
    <div className="app">
      <header>
        <div className="logo">
          <img src="/logo-white.png" alt="TrueCOA" className="logo-image" />
        </div>
        <nav className="top-nav" aria-label="TrueCOA tools">
          <button className={mode === 'verify' ? 'active' : ''} onClick={() => switchMode('verify')}>Verify</button>
          <button className={mode === 'create' ? 'active' : ''} onClick={() => switchMode('create')}>Create COA</button>
          <button className={mode === 'curation' ? 'active' : ''} onClick={() => switchMode('curation')}>Curation</button>
          <button className={mode === 'wishlist' ? 'active' : ''} onClick={() => switchMode('wishlist')}>Wishlist</button>
        </nav>
      </header>

      <main>
        {mode === 'curation' ? (
          <div className="management-section">
            <div className="management-header">
              <h1>Curation</h1>
              <div className="metric-row" aria-label="Curation summary">
                <div className="metric-card"><span>{curationItems.length}</span><strong>Works</strong></div>
                <div className="metric-card"><span>{curationItems.filter((item) => item.priority === 'High').length}</span><strong>High Priority</strong></div>
                <div className="metric-card"><span>{curationItems.filter((item) => item.status === 'Ready for COA').length}</span><strong>Ready</strong></div>
              </div>
            </div>

            {managementLoading && <p className="management-status">Loading stored records...</p>}
            {managementError && <div className="error-message management-error">{managementError}</div>}

            {curationItems.length ? (
              <div className="record-grid">
                {curationItems.map((item) => (
                  <article className="record-card" key={item.id}>
                    <div>
                      <div className="record-kicker">{item.category} / {item.priority}</div>
                      <h2>{item.title || 'Untitled'}</h2>
                      <p>{item.artist || 'Unknown artist'}</p>
                    </div>
                    {item.notes && <p className="record-notes">{item.notes}</p>}
                    <div className="record-meta">
                      <span>{item.status}</span>
                      <select value={item.status} onChange={(event) => updateCurationStatus(item.id, event.target.value)} aria-label={`Status for ${item.title || item.artist}`} disabled={managementSaving}>
                        <option>Reviewing</option>
                        <option>Needs source image</option>
                        <option>Ready for COA</option>
                        <option>COA complete</option>
                      </select>
                    </div>
                    <div className="record-actions">
                      {getCurationCoaCode(item) ? (
                        <>
                          <a className="verify-btn compact" href={`/AUTHENTICATE/${encodeURIComponent(getCurationCoaCode(item))}`} target="_blank" rel="noopener noreferrer">View COA</a>
                          <a className="scan-btn compact" href={`${API_URL}/api/nft/${encodeURIComponent(getCurationCoaCode(item))}`} target="_blank" rel="noopener noreferrer">Metadata</a>
                        </>
                      ) : (
                        <button type="button" className="verify-btn compact" onClick={() => startCreateFromItem(item)}>Create COA</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : !managementLoading && (
              <p className="empty-state">No curation records stored yet.</p>
            )}
          </div>
        ) : mode === 'wishlist' ? (
          <div className="management-section">
            <div className="management-header">
              <h1>Wishlist</h1>
              <div className="metric-row" aria-label="Wishlist summary">
                <div className="metric-card"><span>{wishlistItems.length}</span><strong>Targets</strong></div>
                <div className="metric-card"><span>{wishlistItems.filter((item) => item.priority === 'High').length}</span><strong>High Priority</strong></div>
              </div>
            </div>

            {managementLoading && <p className="management-status">Loading stored records...</p>}
            {managementError && <div className="error-message management-error">{managementError}</div>}

            <form className="inline-form" onSubmit={handleWishlistSubmit}>
              <input name="artist" value={wishlistDraft.artist} onChange={handleWishlistDraftChange} placeholder="Artist / maker" />
              <input name="title" value={wishlistDraft.title} onChange={handleWishlistDraftChange} placeholder="Target work" />
              <select name="priority" value={wishlistDraft.priority} onChange={handleWishlistDraftChange} aria-label="Wishlist priority">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <input name="notes" value={wishlistDraft.notes} onChange={handleWishlistDraftChange} placeholder="Notes" />
              <button type="submit" className="verify-btn compact" disabled={managementSaving}>{managementSaving ? 'Saving...' : 'Add'}</button>
            </form>

            {wishlistItems.length ? (
              <div className="record-grid">
                {wishlistItems.map((item) => (
                  <article className="record-card" key={item.id}>
                    <div>
                      <div className="record-kicker">Wishlist / {item.priority}</div>
                      <h2>{item.title || 'Untitled target'}</h2>
                      <p>{item.artist || 'Unknown artist'}</p>
                    </div>
                    {item.notes && <p className="record-notes">{item.notes}</p>}
                    <div className="record-actions">
                      <button type="button" className="verify-btn compact" onClick={() => addWishlistToCuration(item)} disabled={managementSaving}>Curate</button>
                      <button type="button" className="scan-btn compact" onClick={() => startCreateFromItem(item)}>Create COA</button>
                      <button type="button" className="ghost-btn compact" onClick={() => removeWishlistItem(item.id)} disabled={managementSaving}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : !managementLoading && (
              <p className="empty-state">No wishlist records stored yet.</p>
            )}
          </div>
        ) : mode === 'create' ? (
          <div className="create-section">
            <h1>Create COA</h1>
            <p className="subtitle">Enter the work details once, then issue the public COA, printable certificate, ScoreDetect timestamp, and Polygon NFT together.</p>

            <section className="issuance-overview" aria-label="COA issuance outputs">
              <div>
                <span className="field-label">Issuance package</span>
                <strong>One artwork record. Four handoffs.</strong>
                <p>ScoreDetect and Polygon are selected by default. Uncheck either only when you intentionally want a registry-only COA.</p>
              </div>
              <div className="issuance-stamps" aria-label="Outputs created from this form">
                <span>01&nbsp; TrueCOA</span>
                <span>02&nbsp; PDF</span>
                <span>03&nbsp; ScoreDetect</span>
                <span>04&nbsp; OpenSea</span>
              </div>
            </section>

            <form className="create-form" onSubmit={handleCreateSubmit}>
              <div className="form-grid">
                <div className="template-panel full-width">
                  <div className="template-header">
                    <label>
                      COA Type
                      <select value={createForm.coaType} onChange={(event) => handleCoaTypeChange(event.target.value)}>
                        {COA_TYPE_TEMPLATES.map((template) => (
                          <option value={template.id} key={template.id}>{template.label}</option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="field-label">Template</span>
                      <p>{selectedCoaTemplate.helper}</p>
                    </div>
                  </div>
                  {isSportsTemplate && (
                    <div className="sports-template-grid">
                      <label>
                        Player / Signer
                        <input name="sportsPlayer" value={createForm.sportsPlayer} onChange={handleCreateChange} placeholder="Patrick Mahomes" />
                      </label>
                      <label>
                        Team
                        <input name="sportsTeam" value={createForm.sportsTeam} onChange={handleCreateChange} placeholder="Kansas City Chiefs" />
                      </label>
                      <label>
                        League
                        <select name="sportsLeague" value={createForm.sportsLeague} onChange={handleCreateChange}>
                          {SPORTS_LEAGUE_OPTIONS.map((option) => (
                            <option value={option} key={option || 'blank'}>{option || 'Select league'}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Item Type
                        <select name="sportsItemType" value={createForm.sportsItemType} onChange={handleCreateChange}>
                          {SPORTS_ITEM_TYPE_OPTIONS.map((option) => (
                            <option value={option} key={option || 'blank'}>{option || 'Select item'}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Signature Notes
                        <input name="sportsSignature" value={createForm.sportsSignature} onChange={handleCreateChange} placeholder="Signed in black marker on front panel" />
                      </label>
                      <label>
                        Authenticator
                        <select name="sportsAuthenticator" value={createForm.sportsAuthenticator} onChange={handleCreateChange}>
                          {SPORTS_AUTHENTICATOR_OPTIONS.map((option) => (
                            <option value={option} key={option || 'blank'}>{option || 'Select authenticator'}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Cert Number
                        <input name="sportsCertNumber" value={createForm.sportsCertNumber} onChange={handleCreateChange} placeholder="PSA/JSA/Beckett number" />
                      </label>
                      <label>
                        Source
                        <input name="sportsSource" value={createForm.sportsSource} onChange={handleCreateChange} placeholder="Dealer, platform, invoice, or collection" />
                      </label>
                    </div>
                  )}
                  <button type="button" className="scan-btn compact" onClick={applyTemplateCopy}>
                    Apply Template Copy
                  </button>
                </div>
                <label>
                  COA Code
                  <input name="coaCode" value={createForm.coaCode} onChange={handleCreateChange} placeholder="Auto-generated if blank" />
                </label>
                <label>
                  Artist / Signer *
                  <input name="signer" value={createForm.signer} onChange={handleCreateChange} required />
                </label>
                <label>
                  Issuer
                  <input
                    name="assignor"
                    value={createForm.assignor}
                    onChange={handleCreateChange}
                    placeholder="TrueCOA"
                  />
                  <span className="field-hint">Printed on the certificate and recorded with the NFT metadata.</span>
                </label>
                <label className="full-width">
                  Title *
                  <input name="title" value={createForm.title} onChange={handleCreateChange} required />
                </label>
                <div className="builder-panel">
                  <span className="field-label">Year</span>
                  <div className="compact-grid">
                    <select value={createForm.dateMode} onChange={(event) => handleDateBuilderChange('dateMode', event.target.value)} aria-label="Year type">
                      {DATE_MODE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {showDateYearSelect && (
                      <select value={createForm.dateYear} onChange={(event) => handleDateBuilderChange('dateYear', event.target.value)} aria-label="Artwork year">
                        <option value="">Select year</option>
                        {YEAR_OPTIONS.map((year) => (
                          <option value={year} key={year}>{year}</option>
                        ))}
                      </select>
                    )}
                    {showDateRangeSelects && (
                      <>
                        <select value={createForm.dateRangeStart} onChange={(event) => handleDateBuilderChange('dateRangeStart', event.target.value)} aria-label="Start year">
                          <option value="">Start</option>
                          {YEAR_OPTIONS.map((year) => (
                            <option value={year} key={year}>{year}</option>
                          ))}
                        </select>
                        <select value={createForm.dateRangeEnd} onChange={(event) => handleDateBuilderChange('dateRangeEnd', event.target.value)} aria-label="End year">
                          <option value="">End</option>
                          {YEAR_OPTIONS.map((year) => (
                            <option value={year} key={year}>{year}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  <span className="field-hint">Prints as: {createForm.date || 'not set'}</span>
                </div>
                <label>
                  Medium
                  <input name="medium" value={createForm.medium} onChange={handleCreateChange} placeholder="Screenprint on paper" />
                </label>
                <label>
                  Dimensions
                  <input name="dimensions" value={createForm.dimensions} onChange={handleCreateChange} placeholder='24" x 18"' />
                </label>
                <label>
                  Edition
                  <input name="edition" value={createForm.edition} onChange={handleCreateChange} placeholder="12 of 300" />
                </label>
                <div className="builder-panel">
                  <span className="field-title-row">
                    <span>Condition</span>
                    <span className={`char-chip ${printCopyStats[0].status}`}>{printCopyStats[0].count}/{printCopyStats[0].target}</span>
                  </span>
                  <select value={createForm.conditionGrade} onChange={(event) => handleConditionGradeChange(event.target.value)} aria-label="Condition grade">
                    <option value="">Select condition</option>
                    {hasCustomConditionValue && <option value={createForm.condition}>Custom: {createForm.condition}</option>}
                    {CONDITION_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className="chip-row" aria-label="Condition details">
                    {CONDITION_DETAIL_OPTIONS.map((option) => (
                      <button
                        type="button"
                        className={selectedConditionDetails.includes(option.value) ? 'active' : ''}
                        onClick={() => toggleConditionDetail(option.value)}
                        key={option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="field-hint">Gallery-style grade: A+ Mint, A Excellent, B Very Good, C Good, D Fair, F Poor.</span>
                </div>
                <label>
                  SKU
                  <input name="sku" value={createForm.sku} onChange={handleCreateChange} />
                </label>
                <div className="image-input-field full-width">
                  <span className="field-label">Artwork Image</span>
                  <div
                    className={`image-drop-zone${imageDragActive ? ' drag-active' : ''}${imageUploading ? ' uploading' : ''}`}
                    onDragEnter={(event) => {
                      event.preventDefault()
                      setImageDragActive(true)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setImageDragActive(true)
                    }}
                    onDragLeave={() => setImageDragActive(false)}
                    onDrop={handleImageDrop}
                    onPaste={handleImagePaste}
                  >
                    <input name="imageUrl" type="url" value={createForm.imageUrl} onChange={handleCreateImageUrlChange} placeholder="https://..." />
                    <button type="button" className="image-picker-button" onClick={() => imageFileInputRef.current?.click()} disabled={imageUploading}>
                      Choose image
                    </button>
                    <input ref={imageFileInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageFileSelect} />
                  </div>
                  {imageUpload.message && (
                    <span className={`image-upload-status ${imageUpload.status}`}>{imageUpload.message}</span>
                  )}
                  {createImagePreviewUrl && (
                    <div className="image-preview-row">
                      <img
                        src={createImagePreviewUrl}
                        alt=""
                        onLoad={() => setImagePreviewStatus('loaded')}
                        onError={() => setImagePreviewStatus('error')}
                      />
                      <span>{displayLinkText(createImagePreviewUrl, 'Artwork image')}</span>
                    </div>
                  )}
                </div>
                <div className="coa-helper-panel full-width">
                  <div className="coa-helper-header">
                    <div>
                      <span className="field-label">COA Helper</span>
                      <p>Paste source text, ask a question, or use the artwork image above.</p>
                    </div>
                    {coaAssistantResult?.provider && (
                      <span className="helper-badge">{coaAssistantResult.provider === 'openai' ? 'LLM' : 'Local'}</span>
                    )}
                  </div>
                  <div className="coa-helper-form">
                    <textarea
                      value={coaAssistantPrompt}
                      onChange={(event) => setCoaAssistantPrompt(event.target.value)}
                      rows="4"
                      placeholder="Paste listing notes, invoice text, label text, provenance, or ask what fields are missing..."
                    />
                    <div className="coa-helper-actions">
                      <button type="button" className="scan-btn compact" onClick={handleCoaAssistantSubmit} disabled={coaAssistantLoading || imageUploading}>
                        {coaAssistantLoading ? 'Reading...' : 'Ask Helper'}
                      </button>
                      {visibleCoaAssistantSuggestions.length > 0 && (
                        <button type="button" className="verify-btn compact" onClick={applyCoaAssistantSuggestions}>
                          Apply Suggestions
                        </button>
                      )}
                    </div>
                  </div>
                  {coaAssistantError && <div className="helper-error">{coaAssistantError}</div>}
                  {coaAssistantResult && (
                    <div className="coa-helper-result">
                      {coaAssistantResult.warning && <div className="helper-warning">{coaAssistantResult.warning}</div>}
                      {coaAssistantResult.summary && <p>{coaAssistantResult.summary}</p>}
                      <div className="helper-meta">
                        <span>Confidence: {coaAssistantResult.confidence || 'low'}</span>
                        <span>{coaAssistantResult.imageUsed ? 'Image used' : 'Text only'}</span>
                      </div>
                      {visibleCoaAssistantSuggestions.length > 0 && (
                        <div className="helper-suggestions">
                          {visibleCoaAssistantSuggestions.map((item) => (
                            <div className="helper-suggestion" key={item.field}>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      {coaAssistantResult.questions?.length > 0 && (
                        <div className="helper-questions">
                          <span>Questions</span>
                          {coaAssistantResult.questions.map((question) => (
                            <p key={question}>{question}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={`print-copy-guide full-width ${printCopyStatus}`}>
                  <div className="print-copy-header">
                    <span className="field-label">Print copy fit</span>
                    <strong>{printCopyTotal}/{PRINT_COPY_TOTAL_TARGET}</strong>
                  </div>
                  <p>Soft targets: Condition 42, Description/Summary 348, Provenance 232. A field can run a bit long if the others are shorter.</p>
                  <div className="print-copy-meter" aria-hidden="true">
                    <span style={{ width: printCopyMeterWidth }} />
                  </div>
                  <div className="print-copy-breakdown">
                    {printCopyStats.map((item) => (
                      <span className={item.status} key={item.field}>
                        {item.label}: {item.count}/{item.target} <em>{item.note}</em>
                      </span>
                    ))}
                  </div>
                  <p className="print-copy-message">{printCopyMessage}</p>
                </div>
                <label className="full-width">
                  <span className="field-title-row">
                    <span>Description</span>
                    <span className={`char-chip ${printCopyStats[1].status}`}>{printCopyStats[1].count}/{printCopyStats[1].target}</span>
                  </span>
                  <textarea name="description" value={createForm.description} onChange={handleCreateChange} rows="3" />
                  <span className="field-hint">Use this as the short printed summary. It can go over if provenance is shorter.</span>
                </label>
                <label className="full-width">
                  <span className="field-title-row">
                    <span>Provenance</span>
                    <span className={`char-chip ${printCopyStats[2].status}`}>{printCopyStats[2].count}/{printCopyStats[2].target}</span>
                  </span>
                  <div className="compact-grid">
                    <select value={createForm.provenanceSource} onChange={(event) => handleProvenanceSourceChange(event.target.value)} aria-label="Provenance source">
                      {PROVENANCE_SOURCE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <select name="evidenceDocuments" value={createForm.evidenceDocuments} onChange={handleCreateChange} aria-label="Source documents">
                      {EVIDENCE_DOCUMENT_OPTIONS.map((option) => (
                        <option value={option} key={option || 'blank'}>{option || 'Source docs'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="chip-row" aria-label="Provenance presets">
                    {PROVENANCE_PRESETS.map((preset) => (
                      <button
                        type="button"
                        className={selectedProvenancePreset?.id === preset.id ? 'active' : ''}
                        onClick={() => applyProvenancePreset(preset)}
                        key={preset.label}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <textarea name="provenance" value={createForm.provenance} onChange={handleCreateChange} rows="3" />
                  <span className="field-hint">Keep chain-of-custody language concise. It can go over if description is shorter.</span>
                </label>
                <div className="evidence-panel full-width">
                  <span className="field-label">Evidence</span>
                  <div className="evidence-grid">
                    <label>
                      Source / Seller
                      <input name="evidenceSeller" value={createForm.evidenceSeller} onChange={handleCreateChange} placeholder="Dealer, gallery, artist, collector" />
                    </label>
                    <label>
                      Platform
                      <select name="evidencePlatform" value={createForm.evidencePlatform} onChange={handleCreateChange}>
                        {EVIDENCE_PLATFORM_OPTIONS.map((option) => (
                          <option value={option} key={option || 'blank'}>{option || 'Select platform'}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Invoice / Order / Lot
                      <input name="evidenceReference" value={createForm.evidenceReference} onChange={handleCreateChange} placeholder="Order #, invoice #, lot #" />
                    </label>
                    <label>
                      Internal note
                      <input name="evidenceNotes" value={createForm.evidenceNotes} onChange={handleCreateChange} placeholder="Private ops note, not printed" />
                    </label>
                  </div>
                  {evidenceSummary && <span className="field-hint">Logged: {evidenceSummary}</span>}
                </div>
                <div className="integration-health-panel full-width">
                  <div className="integration-health-header">
                    <div>
                      <span className="field-label">Integration Health</span>
                      <p>Check OpenAI, ScoreDetect, Polygon, and the artwork image before creating the COA.</p>
                    </div>
                    <button type="button" className="scan-btn compact" onClick={runIntegrationHealthCheck} disabled={integrationHealthLoading}>
                      {integrationHealthLoading ? 'Checking...' : 'Run Health Check'}
                    </button>
                  </div>
                  {integrationHealthError && <div className="helper-error">{integrationHealthError}</div>}
                  {integrationChecks.length > 0 && (
                    <>
                      <div className="integration-health-summary">
                        <strong>{integrationReadyCount}/{integrationChecks.length} ready</strong>
                        {integrationHealth.checkedAt && <span>{formatDisplayDate(integrationHealth.checkedAt)}</span>}
                      </div>
                      <div className="preflight-list">
                        {integrationChecks.map((check) => (
                          <div className={`preflight-check ${check.status}`} key={check.key}>
                            <span>{check.label}</span>
                            <strong>{check.status === 'good' ? 'Ready' : check.status === 'error' ? 'Fix' : 'Check'}</strong>
                            <p>{check.detail}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="create-preview-panel full-width">
                  <div className="preflight-panel">
                    <div className="preflight-header">
                      <span className="field-label">Preflight</span>
                      <strong className={preflightErrorCount ? 'error' : ''}>{preflightReadyCount}/{preflightChecks.length} ready</strong>
                    </div>
                    <div className="preflight-list">
                      {preflightChecks.map((check) => (
                        <div className={`preflight-check ${check.status}`} key={check.key}>
                          <span>{check.label}</span>
                          <strong>{check.status === 'good' ? 'Ready' : check.status === 'error' ? 'Fix' : 'Check'}</strong>
                          <p>{check.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mini-coa-preview" aria-label="Live COA print preview">
                    <div className="mini-coa-title">Certificate of Authenticity</div>
                    <div className="mini-coa-strip" />
                    <div className="mini-coa-body">
                      <div className="mini-coa-art">
                        {createPreviewImageUrl ? (
                          <img
                            src={createPreviewImageUrl}
                            alt=""
                            onLoad={() => setImagePreviewStatus('loaded')}
                            onError={() => setImagePreviewStatus('error')}
                          />
                        ) : (
                          <span>Artwork</span>
                        )}
                      </div>
                      <div className="mini-coa-copy">
                        <div className="mini-row"><span>Artist</span><strong>{createForm.signer || 'Artist / Signer'}</strong></div>
                        <div className="mini-row"><span>Title</span><strong>{createForm.title || 'Untitled'}</strong></div>
                        <div className="mini-row"><span>Year</span><strong>{createForm.date || 'Not set'}</strong></div>
                        <div className="mini-row"><span>Medium</span><strong>{createForm.medium || 'Not set'}</strong></div>
                        <div className="mini-row"><span>Size</span><strong>{createForm.dimensions || 'Not set'}</strong></div>
                        <div className="mini-row"><span>Edition</span><strong>{createForm.edition || 'Not set'}</strong></div>
                        <div className="mini-row"><span>Condition</span><strong>{createForm.condition || 'Not set'}</strong></div>
                        <div className="mini-section">
                          <span>Description</span>
                          <p>{createForm.description || 'Short printed description.'}</p>
                        </div>
                        <div className="mini-section">
                          <span>Provenance</span>
                          <p>{createForm.provenance || 'Recorded in the TrueCOA registry.'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mini-coa-footer">
                      <span>{createPreviewCode}</span>
                      <span>TrueCOA</span>
                      <span>ScoreDetect</span>
                      <span>Polygon</span>
                    </div>
                  </div>
                </div>
                <div className="issuance-settings full-width">
                  <div className="issuance-settings-copy">
                    <span className="field-label">Issue proof links</span>
                    <p>Leave both selected to finish with direct ScoreDetect and OpenSea links.</p>
                  </div>
                  <div className="issuance-settings-options">
                    <label className="checkbox-row">
                      <input name="createScoreDetect" type="checkbox" checked={createForm.createScoreDetect} onChange={handleCreateChange} />
                      Timestamp this artwork with ScoreDetect
                    </label>
                    <label className="checkbox-row">
                      <input name="mintPolygon" type="checkbox" checked={createForm.mintPolygon} onChange={handleCreateChange} />
                      Mint Polygon NFT now
                    </label>
                  </div>
                  {createForm.createScoreDetect && (
                    <span className="field-hint">ScoreDetect hashes the exact uploaded artwork and records that checksum on its blockchain; it does not keep a copy of the image.</span>
                  )}
                  {createForm.mintPolygon && (
                    <label className="recipient-field">
                      Recipient Wallet <span>(optional)</span>
                      <input name="recipient" value={createForm.recipient} onChange={handleCreateChange} placeholder="Defaults to the TrueCOA minting wallet" />
                    </label>
                  )}
                </div>
              </div>

              <button className="verify-btn create-submit" type="submit" disabled={creating || imageUploading}>
                {buildCreateButtonLabel(createForm, creating)}
              </button>
            </form>

            {createError && <div className="error-message">{createError}</div>}

            {createResult && (
              <div className="create-result">
                <div className="created-result-heading">
                  <div>
                    <span className="result-label">COA issued</span>
                    <strong>{createResult.coa.coaCode}</strong>
                  </div>
                  <span className={`issue-count ${issuedProofCount === 3 ? 'complete' : ''}`}>{issuedProofCount}/3 proofs ready</span>
                </div>
                <p className="created-result-intro">Use the permanent links below to view, save, share, and verify this certificate.</p>
                {createResult.warning && (
                  <p className="warning-message">
                    {createResult.warning}{createResult.sheetError ? `: ${createResult.sheetError}` : ''}
                  </p>
                )}
                {createResult.operationErrors?.length > 0 && (
                  <ul className="warning-list">
                    {createResult.operationErrors.map((operationError) => (
                      <li key={`${operationError.service}-${operationError.message}`}>
                        {operationError.service}: {operationError.message}
                      </li>
                    ))}
                  </ul>
                )}
                {retryableServices.length > 0 && (
                  <div className="retry-panel">
                    <span className="result-label">Retry failed services</span>
                    <div className="retry-actions">
                      {retryableServices.map((service) => (
                        <button
                          type="button"
                          className="scan-btn compact"
                          onClick={() => retryAuthenticationService(service)}
                          disabled={Boolean(authRetrying)}
                          key={service}
                        >
                          {authRetrying === service ? `Retrying ${service}...` : `Retry ${service}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {authRetryError && <div className="helper-error">{authRetryError}</div>}
                <div className="verified-actions created-primary-actions">
                  <a className="action-btn action-btn--primary" href={createdVerificationUrl} target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    View COA
                  </a>
                  <button className="action-btn action-btn--secondary" onClick={downloadCreatedCOA} title="Opens your browser's Save as PDF / print dialog">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    Download PDF
                  </button>
                  {createdScoreDetectUrl ? (
                    <a className="action-btn action-btn--secondary" href={createdScoreDetectUrl} target="_blank" rel="noopener noreferrer" title="Open this COA's ScoreDetect certificate">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      {createdScoreDetectState.label}
                    </a>
                  ) : (
                    <span className={`action-btn action-btn--pending ${createdScoreDetectState.status}`} title={createdScoreDetectState.detail} aria-disabled="true">
                      {createdScoreDetectState.label}
                    </span>
                  )}
                  {createdNftUrl ? (
                    <a className="action-btn action-btn--secondary" href={createdNftUrl} target="_blank" rel="noopener noreferrer" title="Open this COA's Polygon NFT on OpenSea">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2z"/></svg>
                      {createdOpenSeaState.label}
                    </a>
                  ) : (
                    <span className={`action-btn action-btn--pending ${createdOpenSeaState.status}`} title={createdOpenSeaState.detail} aria-disabled="true">
                      {createdOpenSeaState.label}
                    </span>
                  )}
                </div>
                {createResult.scoreDetect?.certId && (
                  <p className="created-scoredetect-code">ScoreDetect code: {createResult.scoreDetect.certId}</p>
                )}
                {createdSecondaryLinks.length > 0 && (
                  <details className="created-more-links">
                    <summary>More links &amp; records</summary>
                    <div className="result-links">
                      {createdSecondaryLinks.map((link) => (
                        <a href={link.url} target="_blank" rel="noopener noreferrer" key={`${link.label}-${link.url}`}>{link.label}</a>
                      ))}
                    </div>
                  </details>
                )}
                <button className="back-link created-verify-again" onClick={verifyCreatedCOA}>Re-verify this COA from the registry</button>
              </div>
            )}
          </div>
        ) : !result ? (
          <div className="verify-section">
            <h1>Certificate of Authenticity</h1>
            <br />
            <p className="subtitle">Provenance matters. This certificate is cryptographically secured on the Polygon blockchain and linked to a unique NFT, creating an unalterable chain of custody. Transparent Authenticity.</p>

            <div className="input-group">
              <input
                type="text"
                placeholder="Enter COA Code (e.g., 290745)"
                value={coaCode}
                onChange={(e) => setCoaCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                disabled={loading}
              />
              <button
                className="verify-btn"
                onClick={() => handleVerify()}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            {!showScanner ? (
              <button className="scan-btn" onClick={startScanner}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M4 4h4V2H2v6h2V4zm0 12H2v6h6v-2H4v-4zm16 4h-4v2h6v-6h-2v4zM16 2v2h4v4h2V2h-6z"/>
                  <path d="M5 5h6v6H5zm1 1v4h4V6H6zm7-1h6v6h-6zm1 1v4h4V6h-4zM5 13h6v6H5zm1 1v4h4v-4H6zm8 0h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm-4 2h1v1h-1zm4 0h1v1h-1zm-2 2h1v1h-1zm2 0h1v1h-1z"/>
                </svg>
                Scan QR Code
              </button>
            ) : (
              <div className="scanner-container">
                <div id="qr-reader" ref={scannerRef}></div>
                <button className="cancel-btn" onClick={stopScanner}>Cancel</button>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>
        ) : result && !showCert ? (
          <div className="verified-landing">
            <div className="verified-badge">&#10003;</div>
            <h1>Certificate Verified</h1>
            <p className="verified-intro">
              <strong>"{result.coa.title}"</strong> by <strong>{result.coa.artist}</strong> has been authenticated and cryptographically secured on the Polygon blockchain.
            </p>
            <div className="verified-actions">
              <button className="action-btn action-btn--primary" onClick={() => setShowCert(true)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                View COA
              </button>
              <button className="action-btn action-btn--secondary" onClick={printCertificate}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Download PDF of COA
              </button>
              <a
                className="action-btn action-btn--secondary"
                href={scoreDetectLink}
                target="_blank"
                rel="noopener noreferrer"
                title={scoreDetectUrl ? 'Open this COA\'s ScoreDetect record' : 'This COA has no ScoreDetect record yet; open ScoreDetect'}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                {scoreDetectUrl ? 'View on ScoreDetect' : 'Open ScoreDetect'}
              </a>
              <a
                className="action-btn action-btn--secondary"
                href={openSeaLink}
                target="_blank"
                rel="noopener noreferrer"
                title={nftUrl ? 'Open this COA\'s NFT on OpenSea' : 'This COA has no minted NFT yet; open the TrueCOA collection on OpenSea'}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2z"/></svg>
                {nftUrl ? 'View NFT on OpenSea' : 'View TrueCOA collection'}
              </a>
            </div>
            {hasPolygonRecord && (
              <aside className="polygon-record-note" aria-labelledby="polygon-record-title">
                <span className="polygon-record-note__eyebrow">PUBLIC BLOCKCHAIN RECORD</span>
                <h2 id="polygon-record-title">
                  Polygon NFT{polygonTokenId ? <> <span>Token #{polygonTokenId}</span></> : ''}
                </h2>
                <p>
                  This NFT is the public blockchain record linked to this COA. It supports independent verification of the certificate; it is not a separate artwork or a transfer of rights in the underlying artwork.
                </p>
                {nftUrl && (
                  <a className="polygon-record-note__link" href={nftUrl} target="_blank" rel="noopener noreferrer">
                    {polygonTokenId ? `Open Token #${polygonTokenId} on OpenSea` : 'Open this NFT on OpenSea'}
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </aside>
            )}
            <button className="back-link" onClick={resetForm}>Verify a different certificate</button>
          </div>
        ) : (
          <div className="result-section">
            <div
              className={`coa-certificate coa-certificate--${certificateArtOrientation}`}
              style={certificateImageUrl ? { '--coa-bg-image': `url("${certificateImageUrl}")` } : undefined}
            >
              {certificateImageUrl && (
                <img className="cert-print-background" src={certificateImageUrl} alt="" aria-hidden="true" />
              )}

              {/* ===== TITLE BAR (above metallic strip) ===== */}
              <div className="cert-title-bar">
                <h2>Certificate of Authenticity</h2>
                <div className="cert-qr">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`}
                    alt="QR Code"
                  />
                  <span>{result.coa.code}</span>
                </div>
              </div>

              {/* ===== METALLIC STRIP GAP ===== */}
              <div className="cert-strip-gap"></div>

              {/* ===== MAIN CERTIFICATE (below metallic strip) ===== */}
              <div className="cert-main">
                {/* Two-column body: image left, content right */}
                <div className="cert-body">
                  <div className="cert-left">
                    {result.coa.imageUrl && (
                      <img
                        src={certificateImageUrl}
                        alt={result.coa.title}
                        className="cert-artwork"
                        onLoad={(event) => {
                          const image = event.currentTarget
                          setCertificateArtOrientation(image.naturalHeight > image.naturalWidth ? 'portrait' : 'landscape')
                        }}
                        onError={(event) => {
                          setCertificateArtOrientation(inferArtworkOrientationFromDimensions(result.coa.size) || 'landscape')
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    {!result.coa.imageUrl && (
                      <div className="cert-artwork-placeholder">
                        <span>Artwork image unavailable</span>
                      </div>
                    )}
                  </div>

                  <div className="cert-right">
                    <div className="cert-section">
                      <h3>Details:</h3>
                      <div className="cert-detail"><span>Artist</span><span>{result.coa.artist}</span></div>
                      <div className="cert-detail"><span>Title</span><span>{result.coa.title}</span></div>
                      {result.coa.date && <div className="cert-detail"><span>Date</span><span>{result.coa.date}</span></div>}
                      {result.coa.medium && <div className="cert-detail"><span>Medium</span><span>{result.coa.medium}</span></div>}
                      {result.coa.size && <div className="cert-detail"><span>Dimensions</span><span>{result.coa.size}</span></div>}
                      {result.coa.edition && <div className="cert-detail"><span>Edition</span><span>{result.coa.edition}</span></div>}
                      {result.coa.condition && <div className="cert-detail"><span>Condition</span><span>{result.coa.condition}</span></div>}
                    </div>

                    {result.coa.description && (
                      <div className="cert-section">
                        <h3>Description:</h3>
                        <p className="cert-text">{result.coa.description}</p>
                      </div>
                    )}

                    {result.coa.provenance && (
                      <div className="cert-section">
                        <h3>Provenance:</h3>
                        <p className="cert-text">{result.coa.provenance}</p>
                      </div>
                    )}

                    <div className="cert-section">
                      <h3>Digital Authentication:</h3>
                      {result.coa.completionDate && (
                        <div className="cert-detail">
                          <span>Date</span>
                          <span>{formatDisplayDate(result.coa.completionDate)}</span>
                        </div>
                      )}
                      <div className="cert-detail">
                        <span>Blockchain</span>
                        <span>{displayLinkText(blockchainUrl || scoreDetectUrl || verificationUrl, 'TrueCOA registry')}</span>
                      </div>
                      <div className="cert-detail">
                        <span>Certificate</span>
                        <span>{result.coa.code}</span>
                      </div>
                      <div className="cert-detail">
                        <span>Issuer</span>
                        <span>{result.coa.assignor || 'TrueCOA'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer logos */}
                <div className="cert-footer">
                  <div className="cert-footer-logos">
                    <span>POWERED BY:</span>
                    <a href={verificationUrl || 'https://truecoa.com'} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/logo.png" alt="TrueCOA" /><span>TrueCOA</span>
                    </a>
                    <a href={scoreDetectUrl || 'https://scoredetect.com'} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/scoredetect.png" alt="ScoreDetect" /><span>ScoreDetect</span>
                    </a>
                    <a href={footerBlockchainUrl} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/polygon.png" alt="Polygon" /><span>Polygon</span>
                    </a>
                  </div>
                  <div className="cert-footer-text">
                    CREATED: {result.coa.completionDate ? formatDisplayDate(result.coa.completionDate) : 'Not dated'}
                  </div>
                </div>
              </div>
            </div>

            <button className="back-btn" onClick={resetForm}>
              Verify Another Certificate
            </button>
          </div>
        )}
      </main>

      <section className="about-section">
        <h2>About TrueCOA</h2>
        <p>TrueCOA provides blockchain-verified Certificates of Authenticity for art, collectibles, and unique items. Every certificate is cryptographically secured on the Polygon blockchain and linked to a unique NFT, creating an unalterable chain of custody.</p>
        <p>Transparent Authenticity — that's our promise.</p>
      </section>

      <footer>
        <p>&copy; {new Date().getFullYear()} TrueCOA. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
