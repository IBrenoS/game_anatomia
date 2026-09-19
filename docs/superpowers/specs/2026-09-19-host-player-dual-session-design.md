# Host + Player — desenho de sessões duplas

## Objetivo

Permitir que o criador escolha entre atuar somente como apresentador ou acumular, no mesmo navegador, uma sessão administrativa Host e uma sessão competitiva Player. As identidades continuam independentes e o papel público `screen` permanece opcional.

## Restrições preservadas

- A autenticação Host continua exclusivamente no cookie HttpOnly existente.
- A identidade Player continua sendo composta por `playerId` e `reconnectToken` próprios.
- O criador Player entra pelo fluxo existente `JOIN_ROOM` e retorna por `RESUME_SESSION`.
- Não será criado o papel `host_player`.
- Scoring, ranking, pódio, game loop, scheduler, perguntas, duração, presença e limite de 50 jogadores não mudam.
- Não haverá troca de modo durante a partida.

## Fluxo de criação

`HostEntryPage` passa a solicitar a forma de participação:

1. **Também vou jogar**: exige apelido válido, cria a sala, abre uma conexão Player e envia `JOIN_ROOM`. A navegação para `/host/:pin` ocorre somente depois de `SESSION_ACCEPTED`, quando `playerId` e `reconnectToken` já estiverem persistidos. Em seguida, a página da sala abre também a conexão Host autenticada pelo cookie.
2. **Só vou apresentar**: cria a sala e navega diretamente para `/host/:pin`, mantendo o comportamento atual e sem criar Player.

A escolha explícita de participação será persistida por PIN no armazenamento local. Ela não será inferida apenas pela existência eventual de um token Player, evitando transformar automaticamente um Host em Player.

Se a criação da sala funcionar, mas o ingresso Player falhar, a tela de criação permanecerá no estado de erro com opção de nova tentativa do ingresso na mesma sala. Não será criada outra sala silenciosamente.

## Registry de conexões

O singleton global será substituído por managers independentes obtidos por papel:

- `host`: cookie HttpOnly, comandos administrativos e versão autoritativa usada pelos comandos;
- `player`: token, `JOIN_ROOM`, `RESUME_SESSION`, respostas e estado competitivo;
- `screen`: comportamento atual do telão.

Cada manager manterá socket, heartbeat, tentativas de reconnect, deduplicação, `roomVersion`, handlers e lifecycle próprios. Reconectar ou desconectar um papel não fechará nem substituirá outro.

Os helpers de ação serão roteados explicitamente:

- `sendHostCommand` usa o manager Host;
- `submitAnswer`, `joinRoom` e `resumeSession` usam o manager Player;
- snapshot e reconnect permanecem locais ao manager correspondente.

## Sincronização do estado

`useGameSocket` receberá o papel e a política de sincronização da conexão. O estado de conexão será observado por manager, em vez de representar todas as conexões por um único valor global.

No modo Presenter, a conexão Host continua alimentando o `gameStore` e a interface atual.

No modo Host + Player:

- somente eventos recebidos pela conexão Player alimentam o estado renderizado da partida;
- a conexão Host mantém autenticação, reconnect e `roomVersion`, mas seu snapshot não é aplicado ao store competitivo;
- portanto, durante `QUESTION_ACTIVE`, distribuição e outros dados exclusivos do snapshot Host não alcançam a superfície principal;
- broadcasts comuns recebidos pelo Player mantêm roster, presença, progresso e estado da sala atualizados.

Essa separação também impede que snapshots Host e Player concorram para sobrescrever identidade, resposta selecionada ou resultado pessoal.

## Experiência combinada

`HostPage` detectará o modo persistido para o PIN e restaurará as duas conexões.

No modo combinado:

- `LOBBY`: mostra o criador no roster como Player normal e conserva os controles Host;
- `COUNTDOWN`: usa a experiência Player;
- `QUESTION_ACTIVE` e `PAUSED`: renderiza `PlayerQuestion`, sem distribuição, alternativa correta ou informação pedagógica privilegiada;
- `QUESTION_REVEAL`: usa o resultado pessoal Player;
- rankings, pódio e encerramento: usam a perspectiva Player;
- comandos administrativos ficam numa região secundária e discreta, sempre enviados pela conexão Host;
- o link para abrir `screen` continua manual e opcional.

No modo Presenter, `HostPage` mantém os componentes Host existentes sem alteração comportamental.

## Reload e reconnect

Em reload de Host + Player:

1. a marca de participação por PIN identifica o modo combinado;
2. a conexão Host é reaberta usando o cookie HttpOnly;
3. a conexão Player é reaberta com o token persistido;
4. `RESUME_SESSION` restaura o mesmo `playerId`, score, respostas e presença;
5. cada manager solicita ou recebe seu próprio snapshot.

O ingresso inicial aguarda `SESSION_ACCEPTED` antes da navegação para eliminar a janela normal em que o servidor já criou o Player, mas o browser ainda não persistiu o token. Depois disso, reload nunca envia novo `JOIN_ROOM`.

Falha ou reconnect de um papel altera somente o estado de conexão daquele manager. A sessão Player permanece competitiva se o Host cair; os controles voltam quando a conexão Host for restaurada. A sessão Host permanece válida se o Player cair; o Player usa o reconnect existente.

## Backend e protocolo

O backend já suporta múltiplos WebSockets por papel no mesmo PIN e associa identidade Player apenas após `JOIN_ROOM` ou `RESUME_SESSION`. Não é prevista alteração em `game-room.ts`, banco ou protocolo.

Uma mudança backend só será feita se um teste de integração demonstrar impedimento real à coexistência. Nesse caso, ficará limitada à correção necessária para manter as duas sessões independentes, sem mudar contratos competitivos.

## Tratamento de erros

- Apelido inválido: validação local equivalente ao fluxo Join atual.
- Apelido ocupado, sala cheia ou sala bloqueada: exibir o erro protocolar e não navegar.
- Falha de conexão durante o ingresso inicial: manter dados da sala e permitir nova tentativa Player.
- Host não autenticado após reload: informar indisponibilidade dos controles sem apagar a sessão Player.
- Token Player inválido ou revogado: não criar Player automaticamente; informar que a sessão competitiva não pôde ser restaurada.

## Testes

O desenvolvimento seguirá TDD, com testes falhando antes da implementação.

### Unitários e componentes

- registry mantém managers Host e Player distintos e simultâneos;
- lifecycle, disconnect e reconnect são isolados por papel;
- comandos Host e respostas Player usam os managers corretos;
- criação Presenter não envia `JOIN_ROOM`;
- criação combinada valida nome, aguarda `SESSION_ACCEPTED` e persiste o modo;
- snapshots Host não atualizam o store competitivo combinado;
- `QUESTION_ACTIVE` combinado renderiza `PlayerQuestion` sem distribuição ou resposta correta.

### Integração

- Host e Player conectam simultaneamente ao mesmo Durable Object;
- Player criado pelo Host ocupa uma das 50 vagas, aparece uma única vez e conta em todos os totais;
- resposta, `answeredCount`, score, ranking e pódio tratam o criador como qualquer Player;
- `RESUME_SESSION` mantém `playerId`, resposta e score sem duplicação;
- desconexões Host e Player são independentes.

### E2E e regressão

- T1–T12 serão mapeados nominalmente em testes automatizados quando o comportamento for observável pelo navegador;
- cenários de lifecycle existentes serão mantidos;
- fluxo Presenter + Players + Screen será reexecutado;
- verificações finais: testes direcionados, integração, E2E pertinente, typecheck, lint e build.

## Critérios de conclusão

A implementação só será considerada concluída se os dois modos de criação funcionarem, as identidades e conexões permanecerem independentes, a experiência competitiva não exibir dados privilegiados durante a resposta, o criador pontuar normalmente, reload/reconnect não duplicarem Player e os cenários T1–T12 tiverem evidência registrada.
