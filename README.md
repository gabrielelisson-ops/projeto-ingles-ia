# Inglês com IA

Curso pessoal de inglês, do A1 ao C1, com **professor de IA por voz**. É um app Android de uso pessoal (Gabriel e esposa): não vai para a Play Store e não tem assinatura.

## O que já funciona

### Fase 4
- **Curso completo do A1 ao C1**: 5 níveis × 8 unidades = 200 aulas + 40 provas de unidade + 5 provas finais com entrevista oral. Todo o conteúdo é original e foi escrito e revisado à mão (sem custo de IA), validado pelos testes automáticos.
- **Inglês de indústria em todos os níveis**: turnos, segurança e EPI (A2), processos e voz passiva, problemas de produção (B1), reuniões de produção, negociação com fornecedores, relatórios e melhoria contínua — PDCA, kaizen, 5S (B2), inglês corporativo, KPIs, supply chain, planejamento de produção, S&OP e MRP (C1).
- **Teste de nivelamento**: perguntas de A1 a C1 + uma resposta falada avaliada pela IA. O app sugere por onde começar; os níveis anteriores ficam marcados como dispensados (dá para refazer o nivelamento em Configurações).
- **Estudar juntos**: os dois perfis no mesmo celular, numa cena com o professor (mercado, viagem, jantar…). Cada um fala na sua vez; as correções e os erros vão para o perfil de quem falou. O nível da conversa é o do perfil mais iniciante.

### Fase 3
- **Revisão diária** (repetição espaçada, SM-2): palavras das aulas, frases erradas e erros corrigidos pelo professor voltam nos dias certos. O botão "Revisão" na tela inicial mostra quantos cartões há para hoje.
- **Pronúncia**: leia uma frase em voz alta; o app compara com o que o reconhecimento de voz entendeu e destaca em vermelho as palavras não reconhecidas. A nota é aproximada.
- **Conversa livre** sobre qualquer assunto, ajustada ao seu nível atual.
- **8 roleplays**: entrevista de emprego, reunião de trabalho, restaurante, aeroporto, hotel, médico, ligação telefônica e negociação com fornecedor (editáveis em `conteudo/roleplays.json`).
- **Pontos fracos** em "Meu progresso": média de cada habilidade nas provas (leitura, escuta, escrita, fala), temas de gramática com dificuldade e erros que mais se repetem.
- **Backup**: em Configurações, "Exportar backup" gera um arquivo JSON com o progresso de todos os perfis (sem a chave da IA); "Importar backup" valida o arquivo antes e só troca os dados se estiver tudo certo.
- **Lembrete diário**: notificação no horário que você escolher (Configurações).

### Fase 2
- **Nível A1 completo**: 8 unidades (40 aulas + 8 provas), conteúdo original, com bastante situação de trabalho na indústria.
- **Prova final do A1**: 40 questões (leitura, escuta, escrita e fala) + **entrevista oral de 5 minutos** com o professor de IA (vale metade da nota de fala). Aprovação com 70 libera o próximo nível.
- **Certificado em PDF** com nome, nível, nota e data (no fim da prova final e em "Meu progresso"), pronto para salvar ou mandar por WhatsApp.
- **Gerador de conteúdo com IA** (`npm run gerar`) para criar os próximos níveis, com validação automática.

### Fase 1

- **Perfis** "Gabriel" e "Esposa" (nomes editáveis), sem login, cada um com seu progresso.
- **Trilha do curso**: a próxima aula só abre quando a anterior é concluída.
- **Unidade 1 do A1 completa**: 5 aulas + prova da unidade, com conteúdo original.
- **Aula em 8 etapas**: aquecimento por voz → vocabulário com emoji e áudio → gramática com tabela → escuta (diálogo com transcrição) → prática guiada → conversa com o professor → teste rápido (4 de 5 para passar) → resumo.
- **Prova da unidade** com 20 questões: leitura, escuta, escrita e fala (as duas últimas corrigidas pela IA). Aprova com 70; se reprovar, mostra o que revisar e libera nova tentativa em 24h.
- **Professor de voz**: segure para falar, transcrição na tela, erros destacados com a forma correta, botões "Repetir mais devagar", "Não entendi" e "Me dá uma dica". Ele lembra os erros frequentes de cada perfil.
- **Teste rápido do dia** com perguntas das aulas já feitas.
- **Painel**: nível, % do nível, dias seguidos, minutos falados, palavras aprendidas, notas das provas e pontos fracos.
- Tudo é salvo no celular (SQLite). A chave da IA fica no cofre criptografado do Android.

## Como o projeto está organizado

| Pasta | O que tem |
|---|---|
| `conteudo/` | **O curso em si**: `curriculo.json` (as 40 unidades) e as aulas e provas em JSON (`a1/u01/aula1.json`…). Edite aqui sem mexer no código. |
| `src/conteudo/schema.ts` | O "formato oficial" dos JSONs. Arquivo errado → o app mostra o erro em Configurações, sem travar. |
| `src/logica/` | Regras puras e testadas: desbloqueio, notas, correção de respostas, revisão espaçada (SM-2). |
| `src/ia/` | Ligação com o Gemini, prompts do professor e do avaliador. |
| `src/voz/` | O celular falando (voz do aparelho) e ouvindo (reconhecimento de voz do Android). |
| `src/dados/` | Banco de dados local (SQLite). |
| `src/app/` | As telas. |
| `testes/` | Testes automáticos. |

### Editar ou adicionar conteúdo

1. Edite os arquivos em `conteudo/`. O formato está documentado em `src/conteudo/schema.ts`.
2. Se criou uma unidade nova (pasta `conteudo/a1/u02/` com `unidade.json`, `aula1.json`…`aula5.json` e `prova.json`), rode `npm run conteudo:indice`.
3. Rode `npm test`: o teste `conteudo.test.ts` aponta qualquer erro de formato e confere se toda resposta registrada é aceita pela correção.

### Gerar uma unidade nova com IA (no computador)

Os 5 níveis já estão prontos; o gerador serve para criar uma versão alternativa de alguma unidade (por exemplo, para variar os exercícios depois de fazer o curso uma vez). Ele cria as 5 aulas e a prova de uma unidade a partir do `curriculo.json`. Tudo passa pelo formato oficial; se a IA errar, ela recebe a lista de erros e corrige sozinha (até 3 vezes).

No PowerShell, dentro da pasta do projeto:

```
$env:GEMINI_API_KEY = "cole-sua-chave-aqui"
npm run gerar -- A2 1
```

- A chave fica só naquela janela do PowerShell; não é salva em arquivo.
- O resultado vai para `conteudo-gerado/a2/u01/`, uma pasta que não vai para o GitHub.
- **Revise os textos** (diálogos, respostas, traduções). Quando estiver bom, mova a pasta para `conteudo/a2/u01/` e rode `npm run conteudo:indice` e `npm test`.
- Cada unidade usa cerca de 7 a 15 pedidos à IA. Se o limite grátis do dia acabar, continue no dia seguinte.

## Testes

```
npm install
npm run verificar      # gera o índice do conteúdo, confere os tipos e roda todos os testes
```

## Gerar o APK e instalar no celular

O app usa reconhecimento de voz, que **não funciona no app "Expo Go"**: é preciso gerar o APK. O APK é montado gratuitamente nos servidores da Expo (EAS Build, plano grátis).

**Uma vez só, no computador (Windows):**

1. Instale o **Node.js LTS**: https://nodejs.org (botão "LTS", avançar até o fim).
2. Crie uma conta grátis na Expo: https://expo.dev/signup
3. Baixe o código: na página do repositório no GitHub, botão verde **Code › Download ZIP**, e extraia a pasta. Se você usa Git, pode clonar.
4. Abra o PowerShell **dentro da pasta extraída** e rode, um de cada vez:
   ```
   npm install
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```
   - Se perguntar *"Would you like to automatically create an EAS project?"* → **Y**.
   - Se perguntar *"Generate a new Android Keystore?"* → **Y**. A Expo guarda essa "assinatura" do app. É ela que permite instalar atualizações sem perder o progresso.
5. Espere de 10 a 20 minutos. No fim aparece um **link** e um **QR code**.

**No celular (cada um no seu):**

1. Abra o link (ou leia o QR code com a câmera) e baixe o APK. Dá para mandar o link por WhatsApp.
2. Ao abrir o arquivo, o Android pede para permitir "instalar apps desta fonte": permita para o navegador ou o WhatsApp.
3. Instale e abra o **Inglês com IA**. Na primeira vez que segurar o botão de falar, permita o microfone.

**Atualizações:** gere o APK de novo (passo 4) e instale por cima. O progresso continua, porque a assinatura é a mesma.

## Chave da IA (Google AI Studio)

1. Entre em https://aistudio.google.com/apikey com sua conta Google.
2. Clique em **Create API key** e copie a chave.
3. No app: **Configurações › Chave da IA** › cole › **Salvar chave** › **Testar chave**.

Recomendação: **cada um cria a própria chave** com a própria conta Google. O limite grátis é por projeto do Google, então duas chaves dão o dobro de uso. Nunca coloque a chave no código, em prints ou em mensagens.

Custo: o app usa o plano grátis do Gemini. Se o limite do dia acabar, o app avisa e tenta o outro modelo. O limite volta no dia seguinte, por volta das 4h–5h da manhã no horário de Brasília.

## Privacidade

- Progresso, notas e erros ficam só no celular.
- Para a IA vão apenas o nome do perfil, o nível, o tema da aula, o que você fala e escreve nas conversas e provas, e seus erros frequentes.
- No plano grátis, o Google pode usar essas conversas para melhorar os produtos dele. Evite falar de assuntos pessoais sensíveis.
