import type { Question } from '@batalha/protocol';

export const questions: Question[] = [
  {
    id: 'q1', type: 'function', order: 0, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual é a principal função do músculo longuíssimo do dorso?',
    options: [
      { id: 'q1_a', label: 'Apenas flexionar a coluna' },
      { id: 'q1_b', label: 'Flexionar o quadril' },
      { id: 'q1_c', label: 'Estender e estabilizar a coluna vertebral, além de auxiliar na flexão lateral unilateral' },
      { id: 'q1_d', label: 'Movimentar a mandíbula' },
    ],
    correctOptionId: 'q1_c',
  },
  {
    id: 'q2', type: 'region', order: 1, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Onde fica localizado o músculo reto do abdômen de um equino?',
    options: [
      { id: 'q2_a', label: 'Na parede abdominal ventral, na parte inferior do abdômen' },
      { id: 'q2_b', label: 'Na região dorsal do pescoço' },
      { id: 'q2_c', label: 'No membro pélvico' },
      { id: 'q2_d', label: 'Sobre a coluna vertebral' },
    ],
    correctOptionId: 'q2_a',
  },
  {
    id: 'q3', type: 'function', order: 2, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual é a função do músculo reto do abdômen?',
    options: [
      { id: 'q3_a', label: 'Estender a coluna' },
      { id: 'q3_b', label: 'Estender o pescoço' },
      { id: 'q3_c', label: 'Flexionar o quadril' },
      { id: 'q3_d', label: 'Flexionar o tronco, auxiliar na expiração e sustentar as vísceras abdominais' },
    ],
    correctOptionId: 'q3_d',
  },
  {
    id: 'q4', type: 'identify', order: 3, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Durante a avaliação anatômica do dorso de um equino, observa-se um músculo epaxial próximo à linha média da coluna, cuja contração bilateral promove a extensão da coluna. Qual é esse músculo e sua principal função?',
    options: [
      { id: 'q4_a', label: 'Ilíaco — flexão do quadril' },
      { id: 'q4_b', label: 'Espinal — extensão e estabilização da coluna' },
      { id: 'q4_c', label: 'Reto abdominal — flexão do tronco' },
      { id: 'q4_d', label: 'Escaleno — inspiração' },
    ],
    correctOptionId: 'q4_b',
  },
  {
    id: 'q5', type: 'function', order: 4, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'No bovino leiteiro, a fraqueza dos músculos ventrais do abdômen (oblíquo externo, interno e reto) pode causar:',
    options: [
      { id: 'q5_a', label: 'Hérnia ventral e ptose abdominal após várias gestações' },
      { id: 'q5_b', label: 'Aumento da produção de leite' },
      { id: 'q5_c', label: 'Crescimento do casco' },
      { id: 'q5_d', label: 'Cegueira' },
    ],
    correctOptionId: 'q5_a',
  },
  {
    id: 'q6', type: 'identify', order: 5, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual músculo dorsal é responsável por estender e sustentar a coluna em bovinos e equinos?',
    options: [
      { id: 'q6_a', label: 'Reto abdominal' },
      { id: 'q6_b', label: 'Peitoral superficial' },
      { id: 'q6_c', label: 'Longuíssimo do dorso' },
      { id: 'q6_d', label: 'Oblíquo externo' },
    ],
    correctOptionId: 'q6_c',
  },
  {
    id: 'q7', type: 'function', order: 6, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual músculo epaxial participa de movimentos de rotação e estabilização da coluna?',
    options: [
      { id: 'q7_a', label: 'Reto abdominal' },
      { id: 'q7_b', label: 'Rotadores' },
      { id: 'q7_c', label: 'Transverso do abdômen' },
      { id: 'q7_d', label: 'Peitoral superficial' },
    ],
    correctOptionId: 'q7_b',
  },
  {
    id: 'q9', type: 'function', order: 7, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Os multífidos têm como uma de suas principais funções:',
    options: [
      { id: 'q9_a', label: 'Produzir leite' },
      { id: 'q9_b', label: 'Flexionar o casco' },
      { id: 'q9_c', label: 'Movimentar a mandíbula' },
      { id: 'q9_d', label: 'Estabilizar a coluna vertebral' },
    ],
    correctOptionId: 'q9_d',
  },
  {
    id: 'q10', type: 'identify', order: 8, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual músculo atua diretamente na flexão da articulação do quadril do bovino?',
    options: [
      { id: 'q10_a', label: 'Escaleno' },
      { id: 'q10_b', label: 'Quadrado lombar' },
      { id: 'q10_c', label: 'Ilíaco' },
      { id: 'q10_d', label: 'Intertransversários' },
    ],
    correctOptionId: 'q10_c',
  },
  {
    id: 'q17', type: 'function', order: 9, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'No bovino, o psoas maior está relacionado principalmente com:',
    options: [
      { id: 'q17_a', label: 'Movimentação do membro pélvico e flexão da coluna lombar' },
      { id: 'q17_b', label: 'Extensão da coluna cervical' },
      { id: 'q17_c', label: 'Movimento da mandíbula' },
      { id: 'q17_d', label: 'Extensão do membro torácico' },
    ],
    correctOptionId: 'q17_a',
  },
  {
    id: 'q13', type: 'identify', order: 10, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual dos músculos abaixo pertence ao grupo dos epaxiais do bovino e do equino?',
    options: [
      { id: 'q13_a', label: 'Psoas maior' },
      { id: 'q13_b', label: 'Iliocostal' },
      { id: 'q13_c', label: 'Ilíaco' },
      { id: 'q13_d', label: 'Reto abdominal' },
    ],
    correctOptionId: 'q13_b',
  },
  {
    id: 'q16', type: 'identify', order: 11, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'Qual músculo faz parte dos hipaxiais?',
    options: [
      { id: 'q16_a', label: 'Espinal' },
      { id: 'q16_b', label: 'Longuíssimo' },
      { id: 'q16_c', label: 'Multífidos' },
      { id: 'q16_d', label: 'Psoas maior' },
    ],
    correctOptionId: 'q16_d',
  },
  {
    id: 'q19', type: 'function', order: 12, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'O escaleno, presente na região cervical do bovino e equino, também auxilia:',
    options: [
      { id: 'q19_a', label: 'Na mastigação' },
      { id: 'q19_b', label: 'Na digestão' },
      { id: 'q19_c', label: 'Na inspiração' },
      { id: 'q19_d', label: 'Na produção de leite' },
    ],
    correctOptionId: 'q19_c',
  },
  {
    id: 'q21', type: 'identify', order: 13, basePoints: 100, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'O quadrado lombar pertence ao grupo:',
    options: [
      { id: 'q21_a', label: 'Hipaxial' },
      { id: 'q21_b', label: 'Epaxial' },
      { id: 'q21_c', label: 'Peitoral' },
      { id: 'q21_d', label: 'Abdominal superficial' },
    ],
    correctOptionId: 'q21_a',
  },
  {
    id: 'q23', type: 'final', order: 14, basePoints: 300, durationMs: 20_000, speedBonusWindowMs: 10_000, speedBonusMultiplier: 1.25,
    prompt: 'O músculo reto do abdômen, encontrado na parede abdominal ventral do equino, auxilia principalmente:',
    options: [
      { id: 'q23_a', label: 'Na extensão da coluna' },
      { id: 'q23_b', label: 'Na extensão do pescoço' },
      { id: 'q23_c', label: 'Na rotação da coluna exclusivamente' },
      { id: 'q23_d', label: 'Na flexão do tronco e sustentação das vísceras' },
    ],
    correctOptionId: 'q23_d',
  },
];
