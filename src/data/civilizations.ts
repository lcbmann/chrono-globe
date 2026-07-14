import type { CivilizationProfile } from '../types'

export const civilizationProfiles: CivilizationProfile[] = [
  {
    names: ['Empire of Alexander'], displayName: "Alexander's Empire", period: '336–323 BCE', capital: 'Pella / Babylon',
    overview: 'Alexander III of Macedon overthrew the Achaemenid Empire and linked Greece, Egypt, Persia, and parts of Central and South Asia in a short-lived realm.',
    legacy: 'Its political unity fractured quickly, but the successor kingdoms carried Greek language and institutions across the Hellenistic world.',
    facts: ['Alexander was about 32 when he died in Babylon.', 'The empire was divided among competing successors known as the Diadochi.'],
    importance: 1, color: '#e3bd55', source: { title: 'Encyclopaedia Britannica: Alexander the Great', url: 'https://www.britannica.com/biography/Alexander-the-Great' },
  },
  {
    names: ['Roman Republic'], displayName: 'Roman Republic', period: 'traditionally 509–27 BCE', capital: 'Rome',
    overview: 'Rome expanded from a central Italian city-state into the dominant power of the Mediterranean under a republican system of elected magistrates and assemblies.',
    legacy: 'Roman law, civic vocabulary, and republican political ideals continued to shape later European and Atlantic institutions.',
    facts: ['Two consuls normally shared the highest annual civil authority.', 'The Punic Wars made Rome the leading power in the western Mediterranean.'],
    importance: .94, color: '#bc594e', source: { title: 'Encyclopaedia Britannica: Roman Republic', url: 'https://www.britannica.com/place/Roman-Republic' },
  },
  {
    names: ['Roman Empire', 'Western Roman Empire'], displayName: 'Roman Empire', period: '27 BCE–476 CE in the West', capital: 'Rome; later several imperial courts',
    overview: 'The Roman imperial state governed a vast, diverse population around the Mediterranean through cities, roads, taxation, provincial administration, and military power.',
    legacy: 'Its law, languages, urban networks, Christianity, engineering, and ideas of empire deeply shaped Europe, North Africa, and western Asia.',
    facts: ['At its greatest extent under Trajan, Roman rule stretched from Britain to Mesopotamia.', 'Citizenship was extended to most free inhabitants of the empire in 212 CE.'],
    importance: 1, color: '#c74e47', source: { title: 'Encyclopaedia Britannica: Roman Empire', url: 'https://www.britannica.com/place/Roman-Empire' },
  },
  {
    names: ['Eastern Roman Empire', 'Byzantine Empire'], displayName: 'Byzantine Empire', period: '330–1453 CE', capital: 'Constantinople',
    overview: 'The eastern continuation of the Roman Empire combined Roman government and law with a predominantly Greek-speaking and Christian culture.',
    legacy: 'It preserved and transformed classical learning, codified Roman law under Justinian, and shaped Orthodox Christianity and eastern Europe.',
    facts: ['Its inhabitants generally called themselves Romans.', 'Constantinople stood at the center of major Black Sea and Mediterranean trade routes.'],
    importance: .92, color: '#9b5fc6', source: { title: 'Encyclopaedia Britannica: Byzantine Empire', url: 'https://www.britannica.com/place/Byzantine-Empire' },
  },
  {
    names: ['Persia', 'Persi'], displayName: 'Persian Empire', period: 'major imperial phases from c. 550 BCE', capital: 'Persepolis, Susa, and other royal centers',
    overview: 'Successive Iranian dynasties built empires connecting Mesopotamia, Central Asia, the Caucasus, Egypt, and the Indus frontier.',
    legacy: 'Persian court culture, administration, roads, art, and religious traditions influenced states across Eurasia for millennia.',
    facts: ['Achaemenid rulers governed through provinces commonly called satrapies.', 'The Royal Road helped connect the imperial heartland with western Anatolia.'],
    importance: .94, color: '#d88b43', source: { title: 'Encyclopaedia Britannica: Achaemenian Dynasty', url: 'https://www.britannica.com/topic/Achaemenian-dynasty' },
  },
  {
    names: ['Carthage', 'Carthaginian Empire'], displayName: 'Carthage', period: 'c. 9th century–146 BCE', capital: 'Carthage',
    overview: 'A Phoenician-founded city in North Africa that became the center of a maritime commercial power in the western Mediterranean.',
    legacy: 'Its rivalry with Rome produced the Punic Wars and one of antiquity’s most famous commanders, Hannibal.',
    facts: ['Carthage controlled networks of ports rather than a single uniform land empire.', 'Hannibal crossed the Alps during the Second Punic War.'],
    importance: .82, color: '#2ea6a0', source: { title: 'Encyclopaedia Britannica: Carthage', url: 'https://www.britannica.com/place/Carthage-ancient-city-Tunisia' },
  },
  {
    names: ['Egypt'], displayName: 'Ancient Egypt', period: 'c. 3100–30 BCE', capital: 'varied: Memphis, Thebes, and others',
    overview: 'A long sequence of kingdoms and dynasties developed around the Nile, supported by agricultural cycles, monumental building, and a literate state.',
    legacy: 'Egyptian religion, art, writing, architecture, and statecraft fascinated and influenced neighboring societies and later scholarship.',
    facts: ['Hieroglyphs were one of several Egyptian writing systems.', 'The Nile’s flood cycle underpinned much of the ancient economy.'],
    importance: .96, color: '#d5aa3f', source: { title: 'Encyclopaedia Britannica: Ancient Egypt', url: 'https://www.britannica.com/place/ancient-Egypt' },
  },
  {
    names: ['Han Empire', 'Han'], displayName: 'Han Empire', period: '206 BCE–220 CE', capital: "Chang'an; later Luoyang",
    overview: 'The Han dynasty consolidated a large imperial state in East Asia, combining centralized institutions with regional administration.',
    legacy: 'It shaped Chinese political culture, historiography, technology, and long-distance exchange; “Han” remains a major cultural identifier.',
    facts: ['Imperial missions helped open routes later grouped under the name Silk Road.', 'Paper-making was significantly developed during the Han period.'],
    importance: 1, color: '#e16645', source: { title: 'Encyclopaedia Britannica: Han dynasty', url: 'https://www.britannica.com/topic/Han-dynasty' },
  },
  {
    names: ['Mauryan Empire'], displayName: 'Mauryan Empire', period: 'c. 321–185 BCE', capital: 'Pataliputra',
    overview: 'The Mauryan state united most of the Indian subcontinent under a centralized imperial administration.',
    legacy: 'Ashoka’s inscriptions and support for Buddhism left an enduring political, ethical, and religious legacy across Asia.',
    facts: ['Ashoka issued edicts on rocks and pillars across his realm.', 'The empire maintained diplomatic links with Hellenistic kingdoms.'],
    importance: .91, color: '#df7c3b', source: { title: 'Encyclopaedia Britannica: Mauryan Empire', url: 'https://www.britannica.com/place/Mauryan-Empire' },
  },
  {
    names: ['Mongol Empire', 'Mongols'], displayName: 'Mongol Empire', period: '1206–1368 CE', capital: 'Karakorum (imperial center)',
    overview: 'Founded by Chinggis Khan, the Mongol Empire became the largest contiguous land empire in history and joined much of Eurasia under related khanates.',
    legacy: 'It intensified movement of merchants, envoys, technologies, and diseases across Eurasian routes while also causing immense destruction.',
    facts: ['Mounted relay stations supported rapid imperial communication.', 'After unity weakened, major successor states included the Yuan, Ilkhanate, Chagatai Khanate, and Golden Horde.'],
    importance: 1, color: '#4aa17a', source: { title: 'Encyclopaedia Britannica: Mongol Empire', url: 'https://www.britannica.com/place/Mongol-empire' },
  },
  {
    names: ['Ottoman Empire', 'Ottoman Sultanate'], displayName: 'Ottoman Empire', period: 'c. 1300–1922 CE', capital: 'Bursa, Edirne, then Constantinople',
    overview: 'An Anatolian dynasty grew into a multiethnic empire spanning southeastern Europe, western Asia, and North Africa.',
    legacy: 'Ottoman institutions, architecture, law, cuisine, and borders continue to influence the Balkans, Middle East, and Mediterranean.',
    facts: ['Constantinople became the imperial capital after its conquest in 1453.', 'The empire lasted for more than six centuries.'],
    importance: .98, color: '#43a66a', source: { title: 'Encyclopaedia Britannica: Ottoman Empire', url: 'https://www.britannica.com/place/Ottoman-Empire' },
  },
  {
    names: ['Mughal Empire'], displayName: 'Mughal Empire', period: '1526–1857 CE', capital: 'Agra, Delhi, and Lahore at different times',
    overview: 'A dynasty of Central Asian origin ruled much of the Indian subcontinent through a wealthy, multilingual imperial state.',
    legacy: 'Mughal art, architecture, administration, gardens, and Indo-Persian culture left a profound South Asian inheritance.',
    facts: ['Akbar expanded the empire and developed an inclusive imperial court.', 'The Taj Mahal was commissioned by Shah Jahan.'],
    importance: .94, color: '#cb6f9d', source: { title: 'Encyclopaedia Britannica: Mughal dynasty', url: 'https://www.britannica.com/topic/Mughal-dynasty' },
  },
  {
    names: ['Aztec Empire'], displayName: 'Aztec Empire', period: '1428–1521 CE', capital: 'Tenochtitlan',
    overview: 'The Mexica-led Triple Alliance collected tribute from many city-states across central Mexico from its island capital.',
    legacy: 'Nahua language, foodways, art, and historical traditions remain central to the cultural history of Mexico.',
    facts: ['Tenochtitlan was built on islands in Lake Texcoco.', 'The empire was a tribute network, not a uniform modern territorial state.'],
    importance: .88, color: '#58a85b', source: { title: 'Encyclopaedia Britannica: Aztec', url: 'https://www.britannica.com/topic/Aztec' },
  },
  {
    names: ['Inca Empire'], displayName: 'Inca Empire', period: 'c. 1438–1533 CE', capital: 'Cusco',
    overview: 'Known as Tawantinsuyu, the Inca state connected much of the Andes through roads, provincial administration, labor obligations, and storehouses.',
    legacy: 'Andean communities preserve Quechua languages, agricultural knowledge, textile traditions, and cultural links to the Inca past.',
    facts: ['The road system crossed some of the world’s most difficult mountain terrain.', 'Knotted cords called khipu recorded administrative information.'],
    importance: .9, color: '#d68b35', source: { title: 'Encyclopaedia Britannica: Inca', url: 'https://www.britannica.com/topic/Inca' },
  },
]

export const getCivilizationProfile = (key: string) =>
  civilizationProfiles.find((profile) => profile.names.some((name) => name.toLowerCase() === key.toLowerCase()))

