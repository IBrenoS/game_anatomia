import { describe, expect, it } from 'vitest';
import { questions } from '../questions';

const expectedQuestions = [
  ['q1', 'Qual é a principal função do músculo longuíssimo do dorso?', 'Estender e estabilizar a coluna vertebral, além de auxiliar na flexão lateral unilateral'],
  ['q2', 'Onde fica localizado o músculo reto do abdômen de um equino?', 'Na parede abdominal ventral, na parte inferior do abdômen'],
  ['q3', 'Qual é a função do músculo reto do abdômen?', 'Flexionar o tronco, auxiliar na expiração e sustentar as vísceras abdominais'],
  ['q4', 'Durante a avaliação anatômica do dorso de um equino, observa-se um músculo epaxial próximo à linha média da coluna, cuja contração bilateral promove a extensão da coluna. Qual é esse músculo e sua principal função?', 'Espinal — extensão e estabilização da coluna'],
  ['q5', 'No bovino leiteiro, a fraqueza dos músculos ventrais do abdômen (oblíquo externo, interno e reto) pode causar:', 'Hérnia ventral e ptose abdominal após várias gestações'],
  ['q6', 'Qual músculo dorsal é responsável por estender e sustentar a coluna em bovinos e equinos?', 'Longuíssimo do dorso'],
  ['q7', 'Qual músculo epaxial participa de movimentos de rotação e estabilização da coluna?', 'Rotadores'],
  ['q9', 'Os multífidos têm como uma de suas principais funções:', 'Estabilizar a coluna vertebral'],
  ['q10', 'Qual músculo atua diretamente na flexão da articulação do quadril do bovino?', 'Ilíaco'],
  ['q17', 'No bovino, o psoas maior está relacionado principalmente com:', 'Movimentação do membro pélvico e flexão da coluna lombar'],
  ['q13', 'Qual dos músculos abaixo pertence ao grupo dos epaxiais do bovino e do equino?', 'Iliocostal'],
  ['q16', 'Qual músculo faz parte dos hipaxiais?', 'Psoas maior'],
  ['q19', 'O escaleno, presente na região cervical do bovino e equino, também auxilia:', 'Na inspiração'],
  ['q21', 'O quadrado lombar pertence ao grupo:', 'Hipaxial'],
  ['q23', 'O músculo reto do abdômen, encontrado na parede abdominal ventral do equino, auxilia principalmente:', 'Na flexão do tronco e sustentação das vísceras'],
] as const;

describe('catálogo do quiz de músculos bovinos e equinos', () => {
  it('usa as 15 questões selecionadas do PDF, com seus enunciados e gabaritos', () => {
    expect(questions).toHaveLength(15);

    expect(
      questions.map((question) => [
        question.id,
        question.prompt,
        question.options.find((option) => option.id === question.correctOptionId)?.label,
      ])
    ).toEqual(expectedQuestions);
  });

  it('não associa imagens e configura cada questão para 20 segundos, preservando o bônus nos primeiros 10', () => {
    for (const question of questions) {
      expect(question.media).toBeUndefined();
      expect(question.durationMs).toBe(20_000);
      expect(question.speedBonusWindowMs).toBe(10_000);
    }
  });

  it('distribui o gabarito entre A, B, C e D sem repetir o padrão original', () => {
    const correctPositions = questions.map((question) =>
      question.options.findIndex((option) => option.id === question.correctOptionId)
    );

    expect(correctPositions).toEqual([2, 0, 3, 1, 0, 2, 1, 3, 2, 0, 1, 3, 2, 0, 3]);
    expect(new Set(correctPositions)).toEqual(new Set([0, 1, 2, 3]));
  });
});
