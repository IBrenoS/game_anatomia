import type { Question } from '@batalha/protocol';

export const questions: Question[] = [
  {
    id: 'q1',
    type: 'region',
    order: 0,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Na anatomia veterinária de grandes animais, qual região muscular está situada no aspecto superior do tronco, acompanhando a coluna vertebral?',
    media: {
      src: '/questions/q1.svg',
      alt: 'Esquema anatômico comparativo indicando eixos e regiões corporais em grandes animais',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q1_a', label: 'Região ventral' },
      { id: 'q1_b', label: 'Região dorsal' },
      { id: 'q1_c', label: 'Região cranial' },
      { id: 'q1_d', label: 'Região caudal' }
    ],
    correctOptionId: 'q1_b',
    explanation: 'Na anatomia veterinária, a região dorsal compreende o aspecto superior do tronco ao longo da coluna vertebral, em oposição à região ventral (ventre).'
  },
  {
    id: 'q2',
    type: 'identify',
    order: 1,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Qual músculo está relacionado à região ventral do abdômen?',
    media: {
      src: '/questions/q2.svg',
      alt: 'Disposição esquemática da parede abdominal ventral',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q2_a', label: 'Trapézio' },
      { id: 'q2_b', label: 'Latíssimo do dorso' },
      { id: 'q2_c', label: 'Serrátil ventral' },
      { id: 'q2_d', label: 'Reto abdominal' }
    ],
    correctOptionId: 'q2_d',
    explanation: 'O músculo reto abdominal estende-se paralelamente à linha alba no assoalho ventral da cavidade abdominal em grandes animais.'
  },
  {
    id: 'q3',
    type: 'region',
    order: 2,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Qual dos músculos abaixo é considerado dorsal?',
    media: {
      src: '/questions/q3.svg',
      alt: 'Diagrama dos músculos superficiais do tronco e cíngulo torácico',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q3_a', label: 'Trapézio' },
      { id: 'q3_b', label: 'Reto abdominal' },
      { id: 'q3_c', label: 'Peitoral superficial' },
      { id: 'q3_d', label: 'Oblíquo externo' }
    ],
    correctOptionId: 'q3_a',
    explanation: 'O músculo trapézio é um músculo extrínseco do membro torácico situado na superfície dorsal do pescoço e tórax.'
  },
  {
    id: 'q4',
    type: 'function',
    order: 3,
    basePoints: 200,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Qual é uma das principais funções dos músculos dorsais?',
    media: {
      src: '/questions/q4.svg',
      alt: 'Ilustração biomecânica da musculatura epaxial e suporte da coluna vertebral',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q4_a', label: 'Auxiliar na sustentação e movimentação do dorso' },
      { id: 'q4_b', label: 'Apenas sustentação de órgãos internos' },
      { id: 'q4_c', label: 'Exclusivamente flexão dos membros' },
      { id: 'q4_d', label: 'Movimentação exclusiva dos olhos' }
    ],
    correctOptionId: 'q4_a',
    explanation: 'Os músculos do grupo dorsal atuam de forma essencial na extensão, sustentação e estabilização da coluna vertebral durante a locomoção.'
  },
  {
    id: 'q5',
    type: 'identify',
    order: 4,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Qual músculo está localizado na região peitoral e é considerado ventral?',
    media: {
      src: '/questions/q5.svg',
      alt: 'Topografia dos músculos peitorais na face ventral do tórax',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q5_a', label: 'Romboide' },
      { id: 'q5_b', label: 'Peitoral superficial' },
      { id: 'q5_c', label: 'Latíssimo do dorso' },
      { id: 'q5_d', label: 'Trapézio' }
    ],
    correctOptionId: 'q5_b',
    explanation: 'O músculo peitoral superficial conecta o esterno ao úmero pela face ventral do tórax, promovendo adução do membro torácico.'
  },
  {
    id: 'q6',
    type: 'region',
    order: 5,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'O músculo reto abdominal está localizado principalmente em qual região?',
    media: {
      src: '/questions/q6.svg',
      alt: 'Identificação topográfica do músculo reto abdominal',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q6_a', label: 'Abdômen ventral' },
      { id: 'q6_b', label: 'Região cervical dorsal' },
      { id: 'q6_c', label: 'Dorso torácico' },
      { id: 'q6_d', label: 'Membro pélvico distal' }
    ],
    correctOptionId: 'q6_a',
    explanation: 'O reto abdominal compõe o assoalho da parede abdominal ventral, originando-se nas cartilagens costais e inserindo-se no púbis.'
  },
  {
    id: 'q7',
    type: 'region',
    order: 6,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'O músculo trapézio está relacionado principalmente a qual região?',
    media: {
      src: '/questions/q7.svg',
      alt: 'Mapeamento muscular do cíngulo escapular e dorso',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q7_a', label: 'Abdômen e pelve' },
      { id: 'q7_b', label: 'Dorso e escápula' },
      { id: 'q7_c', label: 'Ventre e esterno' },
      { id: 'q7_d', label: 'Região caudal' }
    ],
    correctOptionId: 'q7_b',
    explanation: 'O músculo trapézio possui porções cervical e torácica que se convergem para a espinha da escápula na região dorsal do animal.'
  },
  {
    id: 'q8',
    type: 'species',
    order: 7,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Na miologia comparada de grandes animais, em qual espécie ocorre a fusão do músculo glúteo superficial com o bíceps femoral, formando o músculo gluteobíceps?',
    media: {
      src: '/questions/q8.svg',
      alt: 'Morfologia comparada dos músculos glúteos e femorais em grandes animais',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q8_a', label: 'Bovino' },
      { id: 'q8_b', label: 'Equino' },
      { id: 'q8_c', label: 'Ambas as espécies' },
      { id: 'q8_d', label: 'Nenhuma das espécies' }
    ],
    correctOptionId: 'q8_a',
    explanation: 'No bovino, o músculo glúteo superficial funde-se com o bíceps femoral, constituindo o músculo gluteobíceps. No equino, esses dois músculos permanecem anatomicamente separados e distintos.'
  },
  {
    id: 'q9',
    type: 'boolean',
    order: 8,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'O músculo reto abdominal e o músculo peitoral superficial são classificados como músculos ventrais do tronco em grandes animais.',
    media: {
      src: '/questions/q9.svg',
      alt: 'Agrupamento anatômico dos músculos do aspecto ventral do tronco',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q9_a', label: 'Verdadeiro' },
      { id: 'q9_b', label: 'Falso' }
    ],
    correctOptionId: 'q9_a',
    explanation: 'Verdadeiro. Tanto o músculo peitoral superficial (na parede torácica ventral) quanto o músculo reto abdominal (no assoalho abdominal) integram o grupo ventral do tronco.'
  },
  {
    id: 'q10',
    type: 'final',
    order: 9,
    basePoints: 300,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Na miologia funcional e comparada entre grandes animais, qual especialização muscular e tendínea do membro pélvico é exclusiva do equino para o mecanismo de estação passiva (aparelho recíproco)?',
    media: {
      src: '/questions/q10.svg',
      alt: 'Biomecânica comparada do aparelho recíproco e sustentação passiva no membro pélvico',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q10_a', label: 'Músculo fibular terceiro predominantemente tendíneo acoplado ao flexor digital superficial' },
      { id: 'q10_b', label: 'Músculo gluteobíceps amplamente fundido com o músculo grácil' },
      { id: 'q10_c', label: 'Músculo reto abdominal com quatro ventres tendíneos independentes' },
      { id: 'q10_d', label: 'Músculo peitoral profundo inteiramente cartilaginoso e vestigial' }
    ],
    correctOptionId: 'q10_a',
    explanation: 'No equino, o músculo fibular terceiro é inteiramente tendíneo e funciona em conjunto com o flexor digital superficial como uma corda recíproca, sincronizando a flexão/extensão do joelho e jarrete para suportar o peso com baixo custo energético. No bovino, o fibular terceiro é predominantemente carnoso.'
  }
];
