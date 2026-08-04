# OpenSubtitles PT-BR para IINA

Plugin do [IINA](https://iina.io) que pesquisa e baixa legendas em **português do Brasil** usando a API REST oficial do [OpenSubtitles.com](https://www.opensubtitles.com).

## Recursos

- integração com **Legendas → Buscar legendas online** do IINA;
- filtro fixo `pt-br`;
- reconhecimento de título, ano e episódios `SxxEyy` pelo nome do vídeo;
- lista e seleção nativas do IINA;
- download temporário e carregamento automático da legenda;
- credenciais e JWT armazenados no **Chaves do macOS**;
- sem scraping de `opensubtitles.org`.

## Requisitos

- macOS com IINA 1.4 ou posterior;
- Node.js 18 ou posterior para desenvolver/construir;
- conta no OpenSubtitles.com;
- uma chave própria de **API Consumer**.

## Criar a chave da API

1. Entre em [opensubtitles.com](https://www.opensubtitles.com).
2. Abra seu perfil e a seção **API Consumers**.
3. Crie um consumidor para este plugin e copie a chave.

A chave não é incluída no código nem nos artefatos construídos. Como este é um projeto pessoal/source-first, cada instalação usa a chave criada pela própria pessoa responsável pela aplicação. Respeite os [termos e limites da API do OpenSubtitles](https://opensubtitles.stoplight.io/docs/opensubtitles-api/).

## Desenvolvimento e instalação

```bash
npm install
npm run check
/Applications/IINA.app/Contents/MacOS/iina-plugin link .
```

Reinicie o IINA se o plugin não aparecer imediatamente. Para remover o link de desenvolvimento:

```bash
/Applications/IINA.app/Contents/MacOS/iina-plugin unlink .
```

Para gerar o pacote distribuível:

```bash
npm run build
/Applications/IINA.app/Contents/MacOS/iina-plugin pack .
```

O diretório `dist/` deve acompanhar o plugin distribuído. O IINA instala o conteúdo pronto e não executa o build por conta própria.

## Configuração

1. No IINA, abra **Plugin → OpenSubtitles PT-BR → Configurar OpenSubtitles…** (o nome exato do submenu pode variar por versão).
2. Informe a chave do API Consumer, seu usuário e sua senha do OpenSubtitles.com.
3. Clique em **Salvar e testar**.

Os três valores e o token de sessão ficam no Chaves do macOS. As preferências normais do IINA guardam somente o endereço da API e a expiração do token. Campos vazios na janela mantêm o valor já salvo.

## Uso

1. Abra um filme ou episódio no IINA.
2. Selecione **Legendas → Buscar legendas online → OpenSubtitles PT-BR**.
3. Escolha um resultado.
4. O IINA baixa a legenda para o diretório temporário do plugin e a carrega como faixa externa.

A API possui cotas diárias de download que dependem do tipo de conta. Pesquisa sem resultado não consome download, mas selecionar uma legenda consome a cota informada pelo OpenSubtitles.

## Segurança e rede

O manifesto permite somente `opensubtitles.com` e seus subdomínios. A busca usa apenas `api.opensubtitles.com` ou `vip-api.opensubtitles.com`; o endpoint de download devolve links temporários cujo host pode variar dentro desse domínio. O código também valida que o link final usa HTTPS e pertence a `opensubtitles.com` antes de baixá-lo.

O plugin:

- não grava credenciais em `Info.json`, `dist/`, `.env` ou preferências comuns;
- não registra headers, senha, chave ou JWT no console;
- aceita `base_url` somente nos hosts oficiais da API;
- sanitiza o nome do arquivo baixado e usa somente `@tmp/`;
- não escreve legendas ao lado do arquivo de vídeo.

## Comandos

```bash
npm test             # testes unitários
npm run build        # gera dist/
npm run check        # testes + build
npm run pack:plugin  # gera release/*.iinaplgz
```

## Publicação

As versões do `package.json`, `package-lock.json` e `Info.json`, o `ghVersion`, a tag Git e o GitHub Release são gerenciados pelo [release-it](https://github.com/release-it/release-it). Para publicar a próxima versão, com a branch `main` limpa e sincronizada:

```bash
npm run release -- patch
```

O processo executa os testes, recompila `dist/`, cria o pacote `.iinaplgz`, faz commit e tag e publica o artefato no GitHub Release. O projeto é privado no npm (`private: true`) e não é publicado no registro.

## Limitações da versão 0.1

- somente PT-BR;
- requer login e uma chave de API própria;
- pesquisa por título/metadados, sem cálculo do movie hash do OpenSubtitles;
- não salva permanentemente a legenda junto ao vídeo;
- a validação final dentro do IINA precisa ser executada em um Mac com o aplicativo instalado.

## Licença

Distribuído sob a licença MIT. Consulte [`LICENSE`](LICENSE).

## Referências

- [Template oficial de plugins do IINA](https://github.com/iina/iina-plugin-template)
- [Documentação da API de plugins do IINA](https://docs.iina.io)
- [API REST do OpenSubtitles](https://opensubtitles.stoplight.io/docs/opensubtitles-api/)
