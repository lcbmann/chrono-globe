import type { HistoricalStory } from '../types'

export const historicalStories: HistoricalStory[] = [
  {
    id: 'alexander', title: 'Alexander and the successor world', subtitle: 'Conquest, collapse, and Hellenistic kingdoms', color: '#e3bd55',
    steps: [
      { year: -331, title: 'Achaemenid power breaks', description: 'Alexander’s victory at Gaugamela opened the imperial heartlands of the Achaemenid Empire.', entity: 'Empire of Alexander', eventId: 'gaugamela' },
      { year: -323, title: 'An empire without its founder', description: 'Alexander died in Babylon before establishing a durable succession.', entity: 'Empire of Alexander', eventId: 'alexander-death' },
      { year: -300, title: 'The successor kingdoms', description: 'The Seleucid and Ptolemaic kingdoms became two of the largest states formed from the conquests.', entity: 'Seleucid Kingdom' },
    ],
  },
  {
    id: 'rome', title: 'The Roman Mediterranean', subtitle: 'Republic, empire, and transformation', color: '#c74e47',
    steps: [
      { year: -44, title: 'Republic in crisis', description: 'Caesar’s assassination intensified the political conflicts that ended republican government.', entity: 'Roman Republic', eventId: 'caesar' },
      { year: 100, title: 'A Mediterranean empire', description: 'Roman provincial government, cities, roads, and armies connected lands around the Mediterranean.', entity: 'Roman Empire' },
      { year: 313, title: 'A changing religious order', description: 'Constantine and Licinius agreed to tolerate Christian worship within the empire.', entity: 'Roman Empire', eventId: 'milan' },
      { year: 476, title: 'The western imperial office ends', description: 'Odoacer removed Romulus Augustulus while Roman government continued in the east.', entity: 'Western Roman Empire', eventId: 'rome-476' },
    ],
  },
  {
    id: 'silk-roads', title: 'Worlds of the Silk Roads', subtitle: 'Oases, empires, and exchange across Eurasia', color: '#4fb3a5',
    steps: [
      { year: -138, title: 'Han missions turn west', description: 'Zhang Qian’s missions widened Han knowledge of Central Asian states and routes.', entity: 'Han', eventId: 'zhang-qian' },
      { year: 762, title: 'Baghdad on the network', description: 'The new Abbasid capital became a major destination for trade, scholarship, and translation.', entity: 'Abbasid Caliphate', eventId: 'baghdad-founded' },
      { year: 1206, title: 'Mongol unification', description: 'Chinggis Khan’s empire eventually brought much of the overland network under related rulers.', entity: 'Mongol Empire', eventId: 'chinggis-khan' },
      { year: 1405, title: 'Ming fleets enter the Indian Ocean', description: 'Zheng He’s expeditions joined maritime routes from China to Arabia and East Africa.', entity: 'Ming Chinese Empire', eventId: 'zheng-he' },
    ],
  },
  {
    id: 'caliphates', title: 'The early caliphates', subtitle: 'New political centers across three continents', color: '#58a966',
    steps: [
      { year: 622, title: 'The Hijra', description: 'The migration to Medina marked a decisive new phase for the early Muslim community.', eventId: 'hijra' },
      { year: 691, title: 'Umayyad monument in Jerusalem', description: 'The Dome of the Rock expressed the confidence and reach of the early caliphate.', entity: 'Umayyad Caliphate', eventId: 'umayyad-dome' },
      { year: 800, title: 'Abbasid-centered world', description: 'Baghdad stood near the center of a wealthy but increasingly regionally diverse caliphate.', entity: 'Abbasid Caliphate' },
      { year: 1000, title: 'Several competing centers', description: 'Abbasid, Fatimid, Andalusi, and regional dynasties shared and contested political legitimacy.', entity: 'Fatimid Caliphate' },
    ],
  },
  {
    id: 'mongols', title: 'The Mongol century', subtitle: 'Expansion and connected successor states', color: '#4aa17a',
    steps: [
      { year: 1206, title: 'A new confederation', description: 'Temüjin was proclaimed Chinggis Khan after uniting major steppe groups.', entity: 'Mongol Empire', eventId: 'chinggis-khan' },
      { year: 1279, title: 'Largest mapped reach', description: 'Related Mongol khanates stretched across most of Eurasia, though political unity was weakening.', entity: 'Mongol Empire' },
      { year: 1300, title: 'Successor khanates', description: 'The Yuan, Ilkhanate, Chagatai Khanate, and Golden Horde pursued distinct regional interests.', entity: 'Ilkhanate' },
      { year: 1400, title: 'A transformed political landscape', description: 'Mongol successor traditions persisted even as new dynasties such as the Timurids rose.', entity: 'Timurid Empire' },
    ],
  },
  {
    id: 'colonialism', title: 'Oceanic empires and decolonization', subtitle: 'Conquest, forced movement, resistance, and independence', color: '#5d96cf',
    steps: [
      { year: 1492, title: 'Sustained Atlantic contact', description: 'The Castilian-sponsored voyage began a colonial transformation catastrophic for Indigenous societies.', eventId: 'atlantic-1492' },
      { year: 1498, title: 'A sea route to India', description: 'Portuguese fleets entered established Indian Ocean networks and imposed new forms of armed competition.', entity: 'Portugal', eventId: 'da-gama' },
      { year: 1884, title: 'Partition without African representation', description: 'The Berlin Conference helped formalize European rules for colonial claims in Africa.', eventId: 'berlin-conference' },
      { year: 1947, title: 'Independence and partition', description: 'British rule in South Asia ended amid the creation of India and Pakistan and mass displacement.', entity: 'India', eventId: 'india-independence' },
      { year: 1957, title: 'Ghanaian independence', description: 'Ghana’s independence became a landmark in postwar African decolonization.', entity: 'Ghana', eventId: 'ghana-independence' },
    ],
  },
  {
    id: 'revolutions', title: 'Atlantic revolutions', subtitle: 'Competing claims about rights, empire, and freedom', color: '#cc79a7',
    steps: [
      { year: 1776, title: 'Thirteen colonies declare independence', description: 'The declaration framed a new republic while slavery and Indigenous dispossession continued.', entity: 'United States of America', eventId: 'declaration' },
      { year: 1789, title: 'Revolution in France', description: 'The fall of the Bastille became a symbol of a much wider struggle over sovereignty and social order.', entity: 'France', eventId: 'bastille' },
      { year: 1804, title: 'The Haitian Revolution succeeds', description: 'Formerly enslaved people defeated French colonial rule and established an independent state.', eventId: 'haiti-independence' },
    ],
  },
  {
    id: 'modern-world', title: 'A century of world-system change', subtitle: 'War, independence, the Cold War, and its end', color: '#8b82d8',
    steps: [
      { year: 1914, title: 'A regional crisis becomes world war', description: 'The Sarajevo assassination triggered a diplomatic chain that escalated into the First World War.', eventId: 'sarajevo' },
      { year: 1945, title: 'A reordered world', description: 'The Second World War ended with devastated societies, new international institutions, and two emerging superpowers.', entity: 'USSR' },
      { year: 1949, title: 'The People’s Republic of China', description: 'Communist victory on the mainland established a new government in Beijing.', entity: 'China', eventId: 'prc-founded' },
      { year: 1989, title: 'The Berlin Wall falls', description: 'Popular pressure and political change opened the border through Berlin.', eventId: 'berlin-wall' },
      { year: 1991, title: 'The Soviet Union dissolves', description: 'The union’s republics became independent states and the Cold War political order ended.', entity: 'USSR', eventId: 'ussr-dissolves' },
    ],
  },
]

export const getStory = (id: string | null) => historicalStories.find((story) => story.id === id)
