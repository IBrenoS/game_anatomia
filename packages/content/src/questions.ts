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
    prompt: 'O que significa dizer que um músculo está localizado na região dorsal?',
    media: {
      src: '/questions/q1.svg',
      alt: 'Esquema anatômico comparativo indicando os eixos dorsal e ventral em grandes animais',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q1_a', label: 'Região do ventre' },
      { id: 'q1_b', label: 'Região do dorso' },
      { id: 'q1_c', label: 'Região dos membros' },
      { id: 'q1_d', label: 'Região da cabeça' }
    ],
    correctOptionId: 'q1_b',
    explanation: 'Na anatomia veterinária, a região dorsal refere-se à porção superior do corpo do animal, correspondente ao dorso e coluna vertebral.'
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
    explanation: 'O músculo reto abdominal estende-se paralelamente à linha alba no assoalho ventral da cavidade abdominal em bovinos e equinos.'
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
    prompt: 'Qual animal está sendo comparado no jogo com o bovino?',
    media: {
      src: '/questions/q8.svg',
      alt: 'Esquema comparativo entre anatomia de grandes animais',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q8_a', label: 'Canino' },
      { id: 'q8_b', label: 'Felino' },
      { id: 'q8_c', label: 'Equino' },
      { id: 'q8_d', label: 'Suíno' }
    ],
    correctOptionId: 'q8_c',
    explanation: 'O escopo pedagógico da Batalha Anatômica compara especificamente as conformações miológicas entre bovinos e equinos.'
  },
  {
    id: 'q9',
    type: 'boolean',
    order: 8,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Qual alternativa apresenta apenas músculos ventrais?',
    media: {
      src: '/questions/q9.svg',
      alt: 'Agrupamento comparativo entre músculos do eixo ventral',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q9_a', label: 'Trapézio e latíssimo do dorso' },
      { id: 'q9_b', label: 'Trapézio e reto abdominal' },
      { id: 'q9_c', label: 'Romboide e peitoral superficial' },
      { id: 'q9_d', label: 'Reto abdominal e peitoral superficial' }
    ],
    correctOptionId: 'q9_d',
    explanation: 'Tanto o músculo reto abdominal quanto o músculo peitoral superficial situam-se no aspecto ventral (tórax e abdômen).'
  },
  {
    id: 'q10',
    type: 'final',
    order: 9,
    basePoints: 300,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Por que estudar os músculos de bovinos e equinos é importante?',
    media: {
      src: '/questions/q10.svg',
      alt: 'Síntese funcional da miologia aplicada à postura e locomoção veterinária',
      width: 800,
      height: 600,
    },
    options: [
      { id: 'q10_a', label: 'Para compreender postura, locomoção e movimentos' },
      { id: 'q10_b', label: 'Apenas para identificar cortes de carne' },
      { id: 'q10_c', label: 'Exclusivamente para cirurgias' },
      { id: 'q10_d', label: 'Somente para fins estéticos' }
    ],
    correctOptionId: 'q10_a',
    explanation: 'A miologia comparada de grandes animais fundamenta a compreensão clínica, biomecânica e funcional da postura e locomoção em medicina veterinária.'
  }
];
