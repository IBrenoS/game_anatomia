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
    options: [
      { id: 'q1_a', label: 'Região do ventre' },
      { id: 'q1_b', label: 'Região do dorso' },
      { id: 'q1_c', label: 'Região dos membros' },
      { id: 'q1_d', label: 'Região da cabeça' }
    ],
    correctOptionId: 'q1_b'
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
    options: [
      { id: 'q2_a', label: 'Trapézio' },
      { id: 'q2_b', label: 'Latíssimo do dorso' },
      { id: 'q2_c', label: 'Serrátil ventral' },
      { id: 'q2_d', label: 'Reto abdominal' }
    ],
    correctOptionId: 'q2_d'
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
    options: [
      { id: 'q3_a', label: 'Trapézio' },
      { id: 'q3_b', label: 'Reto abdominal' },
      { id: 'q3_c', label: 'Peitoral superficial' },
      { id: 'q3_d', label: 'Oblíquo externo' }
    ],
    correctOptionId: 'q3_a'
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
    options: [
      { id: 'q4_a', label: 'Realizar a digestão' },
      { id: 'q4_b', label: 'Controlar a respiração exclusivamente' },
      { id: 'q4_c', label: 'Auxiliar na sustentação e movimentação do dorso' },
      { id: 'q4_d', label: 'Flexionar os membros anteriores' }
    ],
    correctOptionId: 'q4_c'
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
    options: [
      { id: 'q5_a', label: 'Trapézio' },
      { id: 'q5_b', label: 'Peitoral superficial' },
      { id: 'q5_c', label: 'Latíssimo do dorso' },
      { id: 'q5_d', label: 'Romboide' }
    ],
    correctOptionId: 'q5_b'
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
    options: [
      { id: 'q6_a', label: 'Dorso superior' },
      { id: 'q6_b', label: 'Região escapular' },
      { id: 'q6_c', label: 'Abdômen ventral' },
      { id: 'q6_d', label: 'Região lombar dorsal' }
    ],
    correctOptionId: 'q6_c'
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
    options: [
      { id: 'q7_a', label: 'Abdômen e pelve' },
      { id: 'q7_b', label: 'Pescoço e tórax ventral' },
      { id: 'q7_c', label: 'Membros posteriores' },
      { id: 'q7_d', label: 'Dorso e escápula' }
    ],
    correctOptionId: 'q7_d'
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
    options: [
      { id: 'q8_a', label: 'Equino' },
      { id: 'q8_b', label: 'Suíno' },
      { id: 'q8_c', label: 'Canino' },
      { id: 'q8_d', label: 'Caprino' }
    ],
    correctOptionId: 'q8_a'
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
    options: [
      { id: 'q9_a', label: 'Trapézio e latíssimo do dorso' },
      { id: 'q9_b', label: 'Trapézio e reto abdominal' },
      { id: 'q9_c', label: 'Romboide e peitoral superficial' },
      { id: 'q9_d', label: 'Reto abdominal e peitoral superficial' }
    ],
    correctOptionId: 'q9_d'
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
    options: [
      { id: 'q10_a', label: 'Para compreender postura, locomoção e movimentos' },
      { id: 'q10_b', label: 'Apenas para identificar cortes de carne' },
      { id: 'q10_c', label: 'Exclusivamente para cirurgias' },
      { id: 'q10_d', label: 'Somente para fins estéticos' }
    ],
    correctOptionId: 'q10_a'
  }
];
