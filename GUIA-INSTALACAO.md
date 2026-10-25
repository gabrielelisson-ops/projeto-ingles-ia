# Guia de instalação — Inglês com IA

Passo a passo para usar o curso:
- **no celular Android** (app instalado, com o arquivo APK);
- **no computador** (versão web, no navegador Chrome ou Edge) — veja a **Parte W**;
- **no iPhone** dá para abrir a versão web pelo Safari, com uma limitação na voz (Parte W4).

Não precisa saber programar. Tudo é **gratuito**: nenhum passo pede cartão de crédito.

Resumo do caminho:

1. **Parte A** — Gabriel, no computador, uma vez: gera o arquivo do app (APK) nos servidores da Expo. Leva uns 30 minutos, a maior parte esperando.
2. **Parte B** — Cada um, no seu celular: instala o APK.
3. **Parte C** — Cada um: cria a sua chave grátis da IA e cola no app.
4. **Parte D** — Primeiro uso: perfil, nivelamento, voz e lembrete.

Para o computador, siga a **Parte W** (depois da Parte A, porque usa a mesma conta da Expo).

Se algo der errado, veja a **Parte F (problemas comuns)**.

---

## Parte A — Gerar o APK (computador com Windows, uma vez)

**Por que é preciso gerar o APK?** O app usa o reconhecimento de voz do Android. Esse recurso não funciona no app de testes "Expo Go", então montamos um app de verdade. A montagem acontece nos computadores da Expo, de graça, sem precisar instalar o Android Studio.

### A1. Instalar o Node.js (uma vez)
1. Abra https://nodejs.org
2. Baixe a versão marcada **LTS** e instale clicando em "Avançar" até o fim (deixe tudo como vem marcado).

### A2. Criar a conta grátis na Expo (uma vez)
1. Abra https://expo.dev/signup
2. Crie a conta com seu e-mail e uma senha. Anote o **nome de usuário**.
3. O plano **Free** já vem ativo. **Não** escolha nenhum plano pago.

### A3. Baixar o código do app
1. Entre no GitHub com sua conta e abra o repositório **projeto-ingles-ia**.
2. Clique no botão verde **Code › Download ZIP**.
3. Clique com o botão direito no ZIP baixado › **Extrair tudo…** Vai aparecer uma pasta, por exemplo `projeto-ingles-ia-main`.

### A4. Abrir o PowerShell dentro da pasta
1. Abra a pasta extraída (a que tem os arquivos `package.json`, `app.json`, `README.md`…).
2. Clique na barra de endereço do Explorador de Arquivos, apague o que estiver escrito, digite `powershell` e aperte **Enter**. Abre uma janela azul ou preta já dentro da pasta.

### A5. Montar o APK
Na janela do PowerShell, rode os comandos **um de cada vez**: cole, aperte Enter e espere terminar.

```
npm install
```
(Leva de 2 a 5 minutos. Avisos em amarelo são normais.)

```
npx eas-cli@latest login
```
Digite o usuário e a senha da Expo.

A Expo só aceita montar o app a partir de uma pasta controlada pelo **Git** (o programa que guarda versões de código). A pasta do ZIP não vem com isso. Rode estes três comandos, um de cada vez:

```
git init
git add -A
git commit -m "versao para montar o app"
```

- Se aparecer "git não é reconhecido como comando", instale o Git em https://git-scm.com (botão **Download for Windows**, aceite tudo como vem). Depois feche e abra o PowerShell de novo.
- Se o Git pedir seu nome e e-mail ("Please tell me who you are"), rode `git config --global user.name "Gabriel"` e `git config --global user.email "seu-email"`. Depois repita o `git commit`.

Agora monte o APK:

```
npx eas-cli@latest build -p android --profile preview
```

O projeto na Expo já existe e está gravado no `app.json` (conta `gabrielelisson`, projeto `projeto-ingles-ia`). A assinatura digital também já existe. Por isso o programa normalmente não pergunta nada. Se perguntar:

| Pergunta (em inglês) | O que quer dizer | Responda |
|---|---|---|
| *Generate a new Android Keystore?* | "Criar uma nova assinatura do Android?" | **Y** e Enter (só aparece se a assinatura ainda não existir) |
| Qualquer pergunta sobre **iOS** ou **Apple** | — | Não deve aparecer. Se aparecer, aperte **Ctrl+C** e confira se digitou `-p android`. |
| Erro *EAS requires you to use a git repository* | "A Expo exige uma pasta com Git" | Faltou o passo do `git init` acima. |

> **O que é a Keystore?** É a "assinatura digital" do app. A Expo guarda essa assinatura na sua conta. Ela garante que as próximas versões possam ser instaladas **por cima**, sem perder o progresso. Não apague o projeto na Expo.

Depois disso, o código sobe para a Expo e a montagem começa. Ela leva de **10 a 30 minutos**, conforme a fila do plano grátis. Pode deixar a janela aberta e ir fazer outra coisa.

No final aparecem:
- um **link** (começa com `https://expo.dev/accounts/…/builds/…`);
- um **QR code**.

Esse link é o seu app. Ele também fica guardado em https://expo.dev, no menu **Projects › projeto-ingles-ia › Builds**.

---

## Parte B — Instalar no celular (cada um no seu)

1. **Mande o link do APK** para os dois celulares (por WhatsApp, por exemplo) ou leia o QR code com a câmera.
2. Abra o link no celular e toque em **Install** / **Download**. Baixa um arquivo `.apk` de uns 60–90 MB. Use Wi-Fi.
3. Toque no arquivo baixado. O Android vai avisar que não permite instalar apps desta fonte:
   - toque em **Configurações**;
   - ative **Permitir desta fonte** (para o Chrome ou para o WhatsApp, conforme onde abriu);
   - volte e toque em **Instalar**.
4. Se o Google Play Protect mostrar um aviso de "app desconhecido", toque em **Mais detalhes › Instalar mesmo assim**. É esperado: o app não está na Play Store porque é de uso pessoal.
5. Abra o **Inglês com IA**. O ícone é um balão azul escrito **EN**.

> Depois de instalar, pode desativar de novo a permissão "Permitir desta fonte" (é mais seguro).

---

## Parte C — Chave da IA (cada um cria a sua)

A chave é o que permite ao app conversar com o professor (Google Gemini, plano grátis).

1. No celular ou no computador, abra https://aistudio.google.com/apikey e entre com **sua** conta Google.
2. Se pedir, aceite os termos.
3. Toque em **Create API key** (Criar chave). Se perguntar o projeto, escolha o que aparecer ou deixe criar um novo.
4. Copie a chave. É um texto longo que começa com `AIza…`.
5. No app: **⚙️ Configurações › Chave da IA** › cole › **Salvar chave** › **Testar chave**. Deve aparecer uma mensagem de que a chave funciona.

Cuidados:
- **Cada um usa a própria chave**, criada com a própria conta Google. O limite grátis é por conta, então duas chaves dão o dobro de uso.
- **Não mande a chave por mensagem e não tire print dela.** Quem tiver a chave usa o seu limite. Se vazar, apague-a no mesmo site e crie outra.
- **Não ative cobrança (billing)** no Google AI Studio. Sem cobrança ativa, o máximo que acontece é o limite do dia acabar.

---

## Parte D — Primeiro uso

1. **Perfil**: na tela "Quem vai estudar agora?", toque no seu perfil. No celular da esposa, use o perfil **Esposa** e troque o nome em **Configurações › Perfis**.
2. **Nivelamento**: se já sabe um pouco de inglês, toque em **📏 Já sei um pouco: teste de nivelamento**. O app sugere por onde começar. Se preferir começar do zero, é só abrir a primeira aula.
3. **Microfone**: na primeira vez que segurar o botão de falar, toque em **Permitir**.
4. **Voz do professor**: em **Configurações › Voz do professor**, escolha o sotaque e a velocidade e toque em testar. Se a voz soar estranha, instale a voz em inglês do Google:
   Configurações do Android › Sistema › Idiomas › **Saída de texto para fala** › Google › **Instalar dados de voz** › English (United States) e English (United Kingdom). O caminho pode mudar um pouco conforme a marca do celular.
5. **Lembrete diário**: em **Configurações › Lembrete**, escolha o horário. Na primeira vez, permita as notificações.
6. **Estudar juntos**: num celular só, toque em **Praticar › Estudar juntos**. Os dois falam em turnos com o professor, e cada erro vai para o perfil de quem falou. Para isso, o celular precisa ter os dois perfis com os nomes certos.

---

## Parte E — Atualizar o app e guardar o progresso

### Atualizar para uma versão nova
1. Baixe o código novo (Parte A3) e repita a **Parte A5**, inclusive os três comandos do Git (a pasta nova também precisa deles). O `login` não precisa repetir, e a Keystore já existe.
2. Instale o APK novo **por cima** do antigo (Parte B). **Não desinstale antes**: desinstalar apaga o progresso.

### Backup (recomendado uma vez por semana)
- **Configurações › Exportar backup** gera um arquivo com o progresso de todos os perfis do celular. A chave da IA não vai junto, por segurança.
- Guarde o arquivo no Google Drive ou mande para você mesmo.
- Se trocar de celular ou precisar reinstalar: instale o app, vá em **Configurações › Importar backup** e escolha o arquivo.

---

## Parte W — Versão web (computador e, se quiser, iPhone)

A versão web é o mesmo curso, aberto pelo navegador. Ela fica no endereço **https://projeto-ingles-ia.expo.app**, hospedado de graça na mesma conta da Expo da Parte A.

**Importante:** cada navegador guarda o seu próprio progresso. O que você faz no computador não aparece no celular, e vice-versa. Para levar o progresso de um para o outro, use o **backup** (Parte E).

### W1. Publicar o site (Gabriel, no computador, depois da Parte A)
Na mesma janela do PowerShell, dentro da pasta do projeto:

```
npm run web:exportar
npx eas-cli@latest deploy --prod
```

- O primeiro comando monta o site na pasta `dist` (leva 1–2 minutos).
- O segundo envia para a Expo. O endereço é sempre **https://projeto-ingles-ia.expo.app**. Guarde nos favoritos do navegador.
- **Não** cadastre cartão de crédito se a Expo pedir. A hospedagem desse tamanho cabe no plano grátis.

Para atualizar o site depois de uma versão nova do curso, rode os dois comandos de novo. O progresso continua, porque fica no navegador e não no site.

### W2. Usar no computador
1. Abra o endereço no **Google Chrome** ou no **Microsoft Edge**. Eles reconhecem a fala; o Firefox não.
2. Escolha o perfil e vá em **⚙️ Configurações › Chave da IA**: cole a sua chave (Parte C) › **Salvar** › **Testar**.
3. Na primeira vez que segurar **🎤 Segure para falar**, o navegador pergunta sobre o microfone: clique em **Permitir**.
   - Dá para segurar o botão com o mouse enquanto fala e soltar no fim.
   - Use um fone com microfone, se tiver: o reconhecimento melhora muito.
4. **Voz do professor:** o Edge tem as vozes em inglês mais naturais. Escolha o sotaque e a velocidade em Configurações.

### W3. Diferenças em relação ao app do celular
- **Lembrete diário:** não existe no navegador. Use um alarme ou a agenda.
- **Certificado:** abre a janela de impressão. Escolha **Salvar como PDF** como impressora.
- **Backup:** "Exportar backup" baixa um arquivo `.json`; "Importar backup" pede para escolher o arquivo.
- **A chave da IA** fica guardada só neste navegador. Não use num computador compartilhado com outras pessoas.
- **Janela anônima** não guarda nada: use sempre uma janela normal.

### W4. iPhone (opcional)
No iPhone, o Safari em geral **não reconhece a fala dentro de sites**. Por isso, o app mostra um campo de texto: toque no **🎤 do teclado** (ditado do iPhone), fale em inglês e envie. O professor continua falando com você normalmente.
1. Abra o endereço do site no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta) › **Adicionar à Tela de Início**. Vira um ícone como de app.
3. Se o ditado não aparecer no teclado, ative em Ajustes › Geral › Teclado › **Ativar Ditado**.
4. Faça backup com frequência (Parte E). O iPhone pode apagar dados de sites que ficam muitas semanas sem uso.

---

## Parte F — Problemas comuns

| Problema | O que fazer |
|---|---|
| `npm` não é reconhecido no PowerShell | Feche e abra o PowerShell de novo depois de instalar o Node.js. Se continuar, reinicie o computador. |
| O build falhou na Expo | Abra o link do build e veja a mensagem em vermelho. Rode o mesmo comando de novo: às vezes é instabilidade da fila. Se repetir, copie a mensagem de erro e me mande. |
| "App não instalado" ao instalar por cima | O APK foi assinado com outra Keystore (por exemplo, um projeto novo na Expo). Faça **backup**, desinstale, instale o novo e **importe o backup**. |
| O botão de falar não funciona | Confira a permissão de microfone (Configurações do Android › Apps › Inglês com IA › Permissões). Confira também se o app **Google** está instalado e atualizado: ele faz o reconhecimento de voz. |
| Reconhece a fala em português | Fale perto do celular e em inglês desde a primeira palavra. Nas configurações do app Google, adicione **English** em "Idiomas da voz". |
| "O limite grátis de hoje da IA acabou" | O limite grátis do dia acabou. As aulas, a revisão e os exercícios continuam funcionando; só a conversa com o professor e a correção de redações ficam para o dia seguinte. |
| "A chave da IA não foi aceita" | Confira se colou a chave inteira (começa com `AIza`). Se não resolver, crie uma chave nova no AI Studio. |
| "Sem conexão com a IA" | A conversa com o professor precisa de internet. O resto do app funciona offline. |
| (web) "Não consegui abrir os dados do curso neste navegador" | Saia da janela anônima. Se continuar, atualize o navegador ou use o Chrome/Edge. |
| (web) O microfone não funciona no computador | Clique no cadeado ao lado do endereço do site › Microfone › **Permitir**, e recarregue a página. Confira se está no Chrome ou no Edge. |
| "A IA do Google está sobrecarregada" / "O modelo da IA não foi encontrado" | Espere um minuto e tente de novo. Se a mensagem de modelo continuar, vá em **Configurações › Modelos › Restaurar padrão**. |
| O lembrete não aparece | Permita notificações para o app e tire o app da "otimização de bateria" (Configurações do Android › Bateria). |

---

## Quanto custa

- **Expo (montar o APK e hospedar o site):** plano Free, sem cartão. O plano grátis tem um número limitado de builds por mês, bem mais do que precisamos, e a fila pode demorar um pouco mais.
- **Gemini (professor de IA):** plano grátis do Google AI Studio, sem cartão, com limite diário de uso.
- **App:** sem anúncios, sem assinatura e sem coleta de dados por nós. O progresso fica no celular. Veja a seção **Privacidade** no `README.md`.
