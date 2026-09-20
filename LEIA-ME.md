# Marmoraria Kairós

Site estático com cinco áreas independentes: Início, Materiais, Projetos, Estúdio 3D e A Kairós/Contato. O menu troca o conteúdo da tela, com links diretos por hash e suporte ao histórico do navegador. Não há framework, etapa de build ou instalação de dependências para servir o site.

## Conteúdo

- `index.html`: estrutura, textos, contatos e metadados.
- `site.css`: apresentação responsiva.
- `site.js`: navegação, filtros, busca, paginação e ampliação das imagens.
- `catalogo-data.js`: 36 materiais e 13 referências de ambientes.
- `images/catalogo/`: logotipo e imagens extraídos do catálogo fornecido, com fotos em WebP.
- `catalogo/catalogo-kairos.pdf`: PDF original para download.

O catálogo exibe seis materiais por página no computador e quatro no celular. A galeria mostra quatro ambientes por página. A busca ignora acentos. Informações adicionais da empresa ficam em um bloco expansível.

## Imagens e dados

As categorias e nomes seguem o PDF fornecido. Quartzos reproduz a classificação comercial do catálogo, sem afirmar especificações técnicas de cada produto. Tons, veios, disponibilidade e aplicação devem ser confirmados no atendimento.

Algumas imagens do PDF identificam outro perfil de Instagram. Por isso são apresentadas como referências da seleção do catálogo, sem declarar autoria de execução. As capturas de nichos foram recortadas para mostrar a fotografia. A qualidade das fotos é limitada pela fonte original.

Os botões gerais usam o link de WhatsApp do catálogo. Os detalhes mantêm o telefone do site anterior, 5519997968365, para incluir o nome da referência na mensagem. Endereço e e-mail seguem o PDF. Notas e contagens de avaliações sem comprovação foram removidas, inclusive dos dados estruturados.

## Visualizar localmente

Sirva esta pasta com um servidor estático, por exemplo:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Abra http://127.0.0.1:8080. Os caminhos dos recursos são relativos, permitindo servir o projeto também em uma subpasta.

## Publicação

Não houve publicação nesta atualização. Publique apenas index.html, site.css, site.js, studio-ui.js, studio-3d.js, catalogo-data.js, 404.html, robots.txt, sitemap.xml, _headers, images/catalogo/, assets/ibl/estudio_dia.png e catalogo/. Não inclua tmp/ nem arquivos .bak.

Ao publicar em outro domínio, atualize og:image, robots.txt e sitemap.xml.

## Verificações

Testado em navegador Chromium/Edge sem interface, em larguras de 1440, 390 e 320 pixels: navegação, links diretos, histórico, filtros, busca com e sem resultados, paginação, carregamento das 36 amostras, detalhes, Escape, PDF e ausência de transbordamento horizontal. Os testes verificam os destinos de contato; não enviam mensagens.

O HTML anterior à atualização foi preservado em tmp/backup-antes-catalogo.html. Scripts de extração e verificação ficam em tmp/ e não são necessários para executar o site.

## Estúdio 3D

A rota #estudio recupera o motor WebGL2, os shaders de pedra e as geometrias da versão anterior, preservada em tmp/backup-antes-catalogo.html. studio-ui.js carrega studio-3d.js apenas no primeiro acesso. Não usa bibliotecas externas. O ambiente de iluminação usa assets/ibl/estudio_dia.png, já existente no projeto.

Seis cenas: chapa, bancada, ilha, lavabo, escada e corte. Há cinco aparências ilustrativas, três acabamentos, zoom, corte manual, rotação por arraste ou teclado e movimento opcional. As aparências procedurais não são uma reprodução das 36 amostras reais do catálogo.

A renderização é sob demanda e para ao sair da área ou ocultar a aba. O movimento automático começa desligado e respeita movimento reduzido. Sem WebGL ou em caso de perda de contexto, aparece uma fotografia com acesso ao catálogo. O parâmetro ?nogl=1 permite verificar essa alternativa.

Validação adicional: seis cenas renderizadas, filtros de aparência/acabamento, controle de corte, zoom pelo teclado, larguras de 390 e 320 pixels, suspensão ao mudar de área e alternativa sem WebGL. No teste isolado, Google Fonts foi bloqueado deliberadamente para validar também as fontes de reserva.

## Página inicial e identidade visual

A página inicial agora tem rolagem com apresentação da empresa, três materiais em destaque que abrem os detalhes, referências de ambientes, acesso ao Estúdio 3D e contato/orçamento. A identidade utiliza marrom, bege e dourado, com a textura de mármore extraída do catálogo. O botão Conheça a Kairós leva ao conteúdo institucional dentro da página inicial; o menu continua alternando as cinco áreas.

A atualização foi conferida nas larguras de 1440, 390 e 320 pixels, além de teste dos atalhos de rolagem, abertura dos materiais em destaque e carregamento das imagens.

## WhatsApp e destaques

Botão flutuante disponível em todas as áreas, com o link de atendimento do PDF e abertura em nova aba. Ao ampliar uma imagem, o botão flutuante fica oculto para priorizar o contato específico do diálogo. O rodapé reserva espaço para o botão no celular.

Orçamento, atendimento personalizado, 36 opções do catálogo, projetos residenciais/comerciais e localização receberam destaque. O destino do link, a visibilidade nas rotas e o comportamento nos diálogos foram testados localmente, sem envio de mensagens.

## Animação de abertura

intro.js recupera a entrada com letras animadas, monograma K, feixe de luz e slogan da versão antiga. Aparece ao carregar a página, fecha automaticamente em 4,8 segundos e pode ser dispensada pelo botão Pular abertura, Conheça a Kairós ou Escape. A navegação interna não repete a abertura. Com movimento reduzido, mostra uma versão estática por 1,2 segundo. Sem JavaScript, a abertura permanece oculta. Inclua intro.js na publicação.

Verificado: fechamento automático, botões, Escape, preservação da rota inicial, movimento reduzido e ausência de erros de JavaScript.


## GitHub Pages

A hospedagem GitHub Pages usa main /docs, com caminhos relativos e docs/.nojekyll. A publicação ocorre automaticamente a cada envio que atualize docs. A pasta docs contém apenas os arquivos públicos. Endereço: https://ayslanvictor-web.github.io/marmoraria-kairos/. A prévia solicita que buscadores não a indexem. Ao alterar o código raiz, atualize também os arquivos correspondentes em docs antes de enviar. A abertura atual dura 10 segundos, com letras separadas por 240 ms.
