import type { CivilizationMedia, FreeMediaAsset } from '../types'

const licenses = {
  pd: ['Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/'],
  cc0: ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  by2: ['CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'],
  bySa3: ['CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'],
  bySa4: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
} as const

const image = (
  file: string, alt: string, caption: string, credit: string, license: keyof typeof licenses,
): FreeMediaAsset => ({ file, alt, caption, credit, license: licenses[license][0], licenseUrl: licenses[license][1] })

export const civilizationMedia: CivilizationMedia[] = [
  {
    names: ['Empire of Alexander'],
    image: image('Alexander the Great mosaic.jpg', 'Detail of Alexander the Great in the Alexander Mosaic', 'Alexander in the Battle of Issus mosaic from Pompeii.', 'Unknown ancient artist', 'pd'),
  },
  {
    names: ['Roman Republic'],
    image: image('Capitoline Brutus Musei Capitolini MC1183 04.jpg', 'Bronze head traditionally called the Capitoline Brutus', 'The Capitoline Brutus, traditionally associated with Rome’s early republic.', 'Jastrow', 'pd'),
  },
  {
    names: ['Roman Empire', 'Western Roman Empire'],
    image: image('Cross Colosseum Rome Italy.jpg', 'Interior arches of the Colosseum in Rome', 'The Colosseum, begun under Vespasian and opened under Titus.', 'Jebulon', 'cc0'),
  },
  {
    names: ['Eastern Roman Empire', 'Byzantine Empire'],
    image: image('Hagia Sophia Mars 2013.jpg', 'Hagia Sophia in Istanbul', 'Hagia Sophia, the great church built under Justinian and later adapted as a mosque.', 'Arild Vågen', 'bySa3'),
    symbol: {
      ...image('Byzantine imperial flag, 14th century.svg', 'Fourteenth-century Byzantine imperial naval ensign', 'Palaiologan imperial ensign', 'Cplakidas', 'bySa3'),
      kind: 'ensign', context: 'Attested for imperial vessels and late Byzantine imagery in the 14th century; it does not represent every Byzantine period.',
    },
  },
  {
    names: ['Persia', 'Persi', 'Achaemenid Empire'],
    image: image('Persépolis, Irán, 2016-09-24, DD 53.jpg', 'Stone columns and ruins at Persepolis', 'Persepolis, one of the Achaemenid royal centers.', 'Diego Delso', 'bySa4'),
  },
  {
    names: ['Carthage', 'Carthaginian Empire'],
    image: image('01996 01434 Ruins of Antonine Baths at Carthage.jpg', 'Ruins of the Antonine Baths at Carthage', 'The Antonine Baths within the later Roman city of Carthage.', 'Silar', 'bySa4'),
  },
  {
    names: ['Egypt'],
    image: image('Spelterini Pyramids.jpg', 'Historic aerial photograph of the pyramids at Giza', 'The Giza pyramid complex photographed from the air in 1904.', 'Eduard Spelterini', 'pd'),
  },
  {
    names: ['Han Empire', 'Han'],
    image: image('Eastern Han Bronze Galloping Horse (10094802964).jpg', 'Eastern Han bronze galloping horse sculpture', 'The Eastern Han bronze often called the Galloping Horse of Gansu.', 'Gary Todd', 'cc0'),
  },
  {
    names: ['Mauryan Empire'],
    image: image('Lion Capital of Ashoka 3.jpg', 'Lion Capital erected by the Mauryan emperor Ashoka', 'The Lion Capital from Ashoka’s pillar at Sarnath.', 'Apurv013', 'cc0'),
  },
  {
    names: ['Mongol Empire', 'Mongols'],
    image: image('YuanEmperorAlbumGenghisPortrait.jpg', 'Posthumous portrait traditionally identified as Chinggis Khan', 'A Yuan-era album portrait traditionally identified as Chinggis Khan.', 'Unknown Yuan court artist', 'pd'),
  },
  {
    names: ['Ottoman Empire', 'Ottoman Sultanate'],
    image: image('Süleymaniye Mosque, Istanbul.jpg', 'Historic photochrom of Süleymaniye Mosque in Istanbul', 'The Süleymaniye Mosque complex in the 1890s.', 'Library of Congress Photochrom Collection', 'pd'),
    symbol: {
      ...image('Flag of the Ottoman Empire (1844–1922).svg', 'Late Ottoman red flag with a white crescent and star', 'Late Ottoman flag', 'Historical design; Commons vector contributors', 'pd'),
      kind: 'flag', context: 'Documented for the late Ottoman state from 1844 to 1922, not for the empire’s entire history.',
    },
  },
  {
    names: ['Mughal Empire'],
    image: image('Taj mahal Agra.jpg', 'Taj Mahal at Agra', 'The Taj Mahal, commissioned by the Mughal emperor Shah Jahan.', 'Suresh rangi', 'cc0'),
    symbol: {
      ...image('Alam of the Mughal Empire.svg', 'Green Mughal ceremonial standard with a golden lion and sun', 'Mughal ceremonial alam', 'TRAJAN 117, after a Mughal procession painting', 'bySa3'),
      kind: 'standard', context: 'A modern vector reconstruction based on an illustrated Mughal ceremonial procession, rather than a standardized national flag.',
    },
  },
  {
    names: ['Aztec Empire'],
    image: image('Piedra del Sol (Aztec Sun Stone) - México.jpg', 'The Mexica Sun Stone', 'The late Mexica sculpture commonly known as the Aztec Sun Stone.', 'Juan Carlos Fonseca Mata', 'bySa4'),
  },
  {
    names: ['Inca Empire'],
    image: image('Machu Picchu, Perú.jpg', 'Stone terraces and buildings at Machu Picchu', 'Machu Picchu, an Inca royal estate in the Andes.', 'Rodolfo Pimentel', 'bySa4'),
  },
  {
    names: ['Assyria'],
    image: image('Lammasu.jpg', 'Neo-Assyrian human-headed winged bull', 'A monumental lamassu from the palace of Sargon II at Dur-Sharrukin.', 'Trjames', 'bySa3'),
  },
  {
    names: ['Babylonia'],
    image: image('Ishtar or Babylon Gate.jpg', 'Blue glazed reconstruction of the Ishtar Gate', 'A reconstruction of Babylon’s Ishtar Gate; surviving original material is held in several collections.', 'Narjes01', 'bySa4'),
  },
  {
    names: ['Tibetan Empire'],
    image: image('Lhasa Potala.jpg', 'Potala Palace above Lhasa', 'The Potala Palace, a much later landmark of Tibetan government and culture.', 'René Heise', 'cc0'),
  },
  {
    names: ['Khmer Empire'],
    image: image('Angkor Wat (9709601352).jpg', 'Angkor Wat temple complex in Cambodia', 'Angkor Wat, built in the Khmer imperial capital region.', 'Gary Todd', 'cc0'),
  },
  {
    names: ['Chola', 'Chola state', 'Cholas'],
    image: image('Brihadeeswara Temple main shrine.jpg', 'Main shrine of the Brihadisvara Temple at Thanjavur', 'The Brihadisvara Temple, commissioned by the Chola ruler Rajaraja I.', 'Sajeev0101', 'bySa4'),
  },
  {
    names: ['Sultanate of Delhi'],
    image: image('Qutub Minar img 1.jpg', 'Illuminated Qutb Minar in Delhi', 'The Qutb Minar complex, begun under the early Delhi sultans.', 'RahulRajak027', 'cc0'),
  },
  {
    names: ['Great Zimbabwe'],
    image: image('Great-Zimbabwe.jpg', 'Stone wall of the Great Enclosure at Great Zimbabwe', 'The Great Enclosure at Great Zimbabwe.', 'Jan Derk', 'pd'),
  },
  {
    names: ['Maya city-states', 'Maya states', 'Maya chiefdoms and states', 'Mayas'],
    image: image('Tikal, Temple I (15773012637).jpg', 'Temple I rising above the forest at Tikal', 'Temple I at Tikal, one of many independent Maya cities.', 'Arian Zwegers', 'by2'),
  },
  {
    names: ['Holy Roman Empire'],
    symbol: {
      ...image('Banner of the Holy Roman Emperor with haloes (1430-1806).svg', 'Golden imperial banner with a black double-headed eagle', 'Banner of the Holy Roman Emperor', 'David Liuzzo; eagle by N3MO', 'bySa3'),
      kind: 'standard', context: 'A reconstruction of the imperial banner used from the later Middle Ages; the decentralized empire had no modern national flag.',
    },
  },
  {
    names: ['Japan', 'Imperial Japan', 'Empire of Japan', 'Shogun Japan (Kamakura)', 'Imperial Japan (Fujiwara)', 'Japan (Warring States)'],
    symbol: {
      ...image('Flag of Japan (1870–1999).svg', 'Historic Japanese national flag with a red sun disc', 'Japanese national flag, 1870–1999 proportions', 'Historical design; Commons vector contributors', 'pd'),
      kind: 'flag', context: 'Adopted nationally in 1870. It should not be read back into ancient or medieval Japanese periods.',
    },
  },
  {
    names: ['USSR'],
    symbol: {
      ...image('Flag of the Soviet Union.svg', 'Red Soviet flag with hammer, sickle, and star', 'Flag of the Soviet Union', 'USSR; Commons vector contributors', 'pd'),
      kind: 'flag', context: 'This file represents the late Soviet specification; earlier versions differed in construction details.',
    },
  },
  {
    names: ['United States', 'United States of America', 'USA'],
    symbol: {
      ...image('Flag of the United States.svg', 'United States flag with fifty stars and thirteen stripes', 'United States flag', 'United States Government; Commons vector contributors', 'pd'),
      kind: 'flag', context: 'The fifty-star design dates from 1960. Earlier maps should be understood as having period-appropriate star counts.',
    },
  },
  {
    names: ['Russian Empire'],
    symbol: {
      ...image('Flag of Russia (1858–1896).svg', 'Black, gold, and white flag of the Russian Empire', 'Russian imperial flag, 1858–1896', 'Bernhard Karl von Koehne; Commons vector contributors', 'pd'),
      kind: 'flag', context: 'The black-gold-white flag had official and limited use from 1858 to 1896; other Russian flags coexisted during the imperial period.',
    },
  },
]

const mediaByName = new Map(civilizationMedia.flatMap((record) => record.names.map((name) => [name.toLocaleLowerCase(), record] as const)))

const encodedFile = (file: string) => encodeURIComponent(file.replaceAll(' ', '_'))

export const getCivilizationMedia = (key: string) => mediaByName.get(key.toLocaleLowerCase())
export const commonsFileUrl = (asset: FreeMediaAsset) => `https://commons.wikimedia.org/wiki/File:${encodedFile(asset.file)}`
export const commonsImageUrl = (asset: FreeMediaAsset, width = 960) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodedFile(asset.file)}?width=${width}`
export const commonsSearchUrl = (name: string) => `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(name)}&title=Special:MediaSearch&type=image`
