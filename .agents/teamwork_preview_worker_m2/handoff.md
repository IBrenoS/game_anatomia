# Handoff Report — Milestone 2: Pedagogical Content & Visual Assets (P1.5, P1.6)

## 1. Observation
- **Pre-existing Defects in Pedagogical Content (`packages/content/src/questions.ts`)**:
  - `Q8` (order 7, type `species`): Prompt was `'Qual animal está sendo comparado no jogo com o bovino?'` with options `Canino`, `Felino`, `Equino`, `Suíno`. It tested game metadata trivia rather than anatomical/miological differences between bovine and equine.
  - `Q9` (order 8, type `boolean`): Prompt was `'Qual alternativa apresenta apenas músculos ventrais?'` with 4 multiple-choice options (`q9_a` through `q9_d`) instead of a binary proposition (`Verdadeiro` / `Falso`).
  - `Q10` (order 9, type `final`): Prompt was `'Por que estudar os músculos de bovinos e equinos é importante?'` with general motivational options (`Para compreender postura...`, `Apenas para cortes de carne...`), failing the PRD requirement (p. 8, 14, 29) of being an advanced comparative miology challenge between bovine and equine musculature.
- **Pre-existing Defects in Validator (`packages/content/src/validate.ts`)**:
  - Only checked `TOTAL_QUESTIONS = 10`, `order`, and `lastQuestion.type === 'final'`.
  - Did NOT validate representation of all 6 mechanics (`identify`, `region`, `species`, `function`, `boolean`, `final`).
  - Did NOT validate that `boolean` questions must have exactly 2 options (`Verdadeiro` / `Falso`).
  - Did NOT validate that the `final` question has `basePoints === 300`.
- **Pre-existing Defects in Test Suite (`packages/content/src/__tests__/validate.test.ts`)**:
  - Only constructed dummy questions and never imported or tested the real exported `questions` array.
- **Pre-existing Defects in Visual Assets (`apps/web/public/questions/q1.svg` through `q10.svg`)**:
  - All 10 SVGs contained explicit text elements delivering the answers directly to students on screen:
    - `q1.svg`: Subtitle `"Dorso (Coluna/Cima) - Ventre (Abdômen/Baixo)"` and central card `"ESTRUTURA EM DESTAQUE: Região Dorsal"`.
    - `q2.svg`: Subtitle `"M. Reto Abdominal e M. Oblíquo Externo"` and card `"M. Reto Abdominal"`.
    - `q3.svg`: Subtitle `"M. Trapézio (Partes Cervical e Torácica)"` and card `"M. Trapézio"`.
    - `q4.svg`: Subtitle `"Sustentação e Movimentação da Coluna Vertebral"` (verbatim option A).
    - `q5.svg`: Subtitle `"M. Peitoral Superficial e M. Peitoral Profundo"` and card `"M. Peitoral Superficial"`.
    - `q6.svg`: Subtitle `"Assoalho Ventral da Cavidade Abdominal"` and card `"Abdômen Ventral"`.
    - `q7.svg`: Subtitle `"Inserção na Espinha da Escápula e Região Dorsal"` and card `"Dorso e Escápula"`.
    - `q8.svg`: Subtitle `"Anatomia Comparada: Bovino e Equino"` and card `"Bovino vs Equino"`.
    - `q9.svg`: Subtitle `"Músculos Ventrais: Reto Abdominal e Peitoral Superficial"` (verbatim correct option).
    - `q10.svg`: Subtitle `"Fundamento para Compreensão de Postura e Locomoção"` and card `"Postura e Locomoção"`.

## 2. Logic Chain
1. **P1.5 Content Remediation**:
   - `Q1` was enhanced to state: `"Na anatomia veterinária de grandes animais, qual região muscular está situada no aspecto superior do tronco, acompanhando a coluna vertebral?"` with options `Região ventral`, `Região dorsal`, `Região cranial`, `Região caudal` (correct: `q1_b`).
   - `Q8` was rewritten as a genuine miological comparative species challenge: `"Na miologia comparada de grandes animais, em qual espécie ocorre a fusão do músculo glúteo superficial com o bíceps femoral, formando o músculo gluteobíceps?"` with options `Bovino` (correct: `q8_a`), `Equino`, `Ambas as espécies`, `Nenhuma das espécies`.
   - `Q9` was transformed into a genuine binary boolean proposition: `"O músculo reto abdominal e o músculo peitoral superficial são classificados como músculos ventrais do tronco em grandes animais."` with exactly 2 options: `q9_a`: `'Verdadeiro'` (correct) and `q9_b`: `'Falso'`.
   - `Q10` was crafted as an advanced 300-point comparative miology challenge: `"Na miologia funcional e comparada entre grandes animais, qual especialização muscular e tendínea do membro pélvico é exclusiva do equino para o mecanismo de estação passiva (aparelho recíproco)?"` with options contrasting the equine tendinous *fibularis tertius* / superficial flexor reciprocal coupling with the bovine fleshy belly (correct: `q10_a`, basePoints: 300).
2. **Validator Enhancement**:
   - In `packages/content/src/validate.ts`, added `REQUIRED_MECHANICS` set checking that all 6 mechanics (`identify`, `region`, `species`, `function`, `boolean`, `final`) are present.
   - Added validation that `type === 'boolean'` enforces `q.options.length === 2` with normalized labels `'Verdadeiro'` and `'Falso'`.
   - Added validation that `type === 'final'` enforces `basePoints === 300`.
3. **Test Suite Modernization**:
   - In `packages/content/src/__tests__/validate.test.ts`, added test suites verifying the real exported `questions` array passes with 0 errors and validates all specific required attributes.
   - Added 13 edge cases checking all error branches (missing mechanics, invalid boolean options, invalid boolean labels, wrong question count, non-sequential order, missing alt text, non-positive duration, non-300 final points).
4. **P1.6 Visual Asset Hygiene**:
   - Redesigned and sanitized all 10 SVGs in `apps/web/public/questions/` (`q1.svg` to `q10.svg`).
   - Completely eliminated all spoiler text, answer names, central cards (`ESTRUTURA EM DESTAQUE`), and subtitle leaks.
   - Replaced them with professional, dark-themed vector diagrams featuring neutral callout pins (`Área sob Análise`, `Estrutura Indicada (A)`, `Padrão Morfológico I/II`, `Acoplamento Recíproco`), orientation axes, and kinematic schemas.

## 3. Caveats
- No changes were made outside the exclusively owned files (`packages/content/src/questions.ts`, `packages/content/src/validate.ts`, `packages/content/src/__tests__/validate.test.ts`, `apps/web/public/questions/q1.svg`–`q10.svg`).
- Monorepo full build `pnpm build` flagged a pre-existing TypeScript unused variable in `packages/game/src/__tests__/state-machine.test.ts(8,3)` owned by M1/peer worker; however, `@batalha/content` and `@batalha/web` both build with code 0 (`tsc -b` and `vite build`).

## 4. Conclusion
Milestone 2 (P1.5, P1.6) is 100% implemented, verified, and genuine:
- All 10 questions represent genuine veterinary miological challenges covering all 6 mechanics.
- Q8 provides a genuine species miology distinction (bovine gluteobíceps fusion vs equine).
- Q9 provides a binary boolean question with exactly 2 options (`Verdadeiro` / `Falso`).
- Q10 is an advanced comparative challenge worth 300 base points.
- Content validation is strictly enforced in `validate.ts`.
- 19 of 19 tests in `validate.test.ts` pass, and all 77 unit tests in the repository pass.
- All 10 SVG visual assets are sanitized, well-formed, and completely spoiler-free.

## 5. Verification Method
1. Run content validation script:
   ```pwsh
   pnpm --filter @batalha/content validate
   ```
   *Expected output: `All questions validated successfully.` with exit code 0.*
2. Run content unit tests:
   ```pwsh
   pnpm vitest run packages/content/src/__tests__/validate.test.ts
   ```
   *Expected output: 19 passed (19).*
3. Run monorepo unit test suite:
   ```pwsh
   pnpm test
   ```
   *Expected output: 6 passed (6 test files), 77 passed (77 tests).*
4. Run `@batalha/content` compilation:
   ```pwsh
   pnpm --filter @batalha/content build
   ```
   *Expected output: `tsc -b` exits with code 0.*
5. Run `@batalha/web` build (verifying public assets):
   ```pwsh
   pnpm --filter @batalha/web build
   ```
   *Expected output: `vite build` transforms modules and builds client and worker bundles with exit code 0.*
6. Run programmatic SVG spoiler detection check:
   ```pwsh
   node -e "const fs = require('fs'); const checks = [ { file: 'q1.svg', forbidden: ['região dorsal', 'região ventral', 'dorso (coluna', 'ventre (abdômen'] }, { file: 'q2.svg', forbidden: ['reto abdominal', 'oblíquo externo'] }, { file: 'q3.svg', forbidden: ['trapézio', 'musculatura dorsal'] }, { file: 'q4.svg', forbidden: ['sustentação e movimentação da coluna vertebral', 'sustentação e movimentação do dorso'] }, { file: 'q5.svg', forbidden: ['peitoral superficial', 'peitoral profundo'] }, { file: 'q6.svg', forbidden: ['abdômen ventral', 'assoalho ventral'] }, { file: 'q7.svg', forbidden: ['dorso e escápula', 'm. trapézio'] }, { file: 'q8.svg', forbidden: ['bovino vs equino', 'bovino e equino', 'qual animal'] }, { file: 'q9.svg', forbidden: ['reto abdominal e peitoral superficial', 'músculos ventrais:'] }, { file: 'q10.svg', forbidden: ['postura e locomoção', 'fibular terceiro', 'flexor digital'] } ]; for (const c of checks) { const content = fs.readFileSync('apps/web/public/questions/' + c.file, 'utf8').toLowerCase(); for (const f of c.forbidden) { if (content.includes(f)) throw new Error('Found spoiler in ' + c.file + ': ' + f); } } console.log('Zero spoilers found across all 10 SVGs!');"
   ```
   *Expected output: `Zero spoilers found across all 10 SVGs!`*

### Invalidation Conditions
- Any question SVG containing the anatomical answer or specific structure label in `<text>` tags.
- Any question set missing any of the 6 mechanics (`identify`, `region`, `species`, `function`, `boolean`, `final`).
- Any boolean question with !== 2 options or with labels other than `Verdadeiro` and `Falso`.
- Any final question with `basePoints !== 300` or not in the 10th position (`order: 9`).
