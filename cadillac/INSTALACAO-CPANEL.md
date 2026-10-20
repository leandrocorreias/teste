# Publicar o portal no cPanel

O site é estático: HTML, CSS, JavaScript e imagens. Não precisa de PHP, de banco
de dados, de Node nem de nenhuma etapa de build no servidor. É subir e funcionar.

Dois arquivos acompanham este guia:

| Arquivo | O que é | Para onde vai |
|---|---|---|
| `cadillac-site.zip` | O site público: 81 páginas, 131 arquivos, 8,1 MB | `public_html/` |
| `cadillac-reservado.zip` | A página `/reservado/`, com os valores de captação | **só depois de proteger com senha** |

---

## 1. Subir o site

1. cPanel → **Gerenciador de Arquivos** → entre em `public_html`.
2. **Upload** → envie o `.zip`.
3. Botão direito no arquivo enviado → **Extract** → extraia na mesma pasta. Havendo
   versão anterior, os arquivos de mesmo nome são sobrescritos — inclusive o
   `.htaccess`, que é o que você quer.
4. Apague o `.zip` do servidor depois de extrair.

Sobrescrever resolve o caso normal. O que a extração **não** faz é apagar arquivo que
existia antes e não existe mais no pacote novo: ele fica lá, órfão, ainda servindo pela
URL antiga. Se em algum momento a estrutura de pastas mudar, apague a pasta inteira e
extraia de novo, em vez de sobrepor.

Pronto. `https://cadillacproducoes.com.br` já responde.

### Conferir se o `.htaccess` subiu

O pacote traz um `.htaccess`, e arquivos que começam com ponto ficam **invisíveis**
no Gerenciador de Arquivos até você ligar a opção:

> Gerenciador de Arquivos → **Configurações** (canto superior direito) →
> marcar **Mostrar arquivos ocultos (dotfiles)** → Salvar

Se ele não estiver lá, a extração pulou os ocultos. Suba o `.htaccess` à mão.

O que esse arquivo faz, e por que importa:

- **Força HTTPS e remove o `www`.** Os endereços canônicos do site não têm `www`.
  Deixar as duas versões no ar faz o Google tratar como conteúdo duplicado e divide
  a autoridade do domínio entre dois endereços.
- **Liga a página de erro própria** (`404.html`) em vez da tela padrão do Apache.
- **Bloqueia arquivos de trabalho** (`.md`, `.json`, `.py`) caso algum vá parar lá.
- **Comprime** HTML, CSS e JS.
- **Cache de um ano** para imagens, CSS e JS; **zero** para HTML — assim, quando você
  republicar, a página nova aparece na hora e ninguém vê conteúdo velho.
- **Cabeçalhos de segurança**: `nosniff`, `Referrer-Policy`, `X-Frame-Options`.

---

## 2. Certificado SSL

cPanel → **SSL/TLS Status** → marque o domínio e o `www` → **Run AutoSSL**.

O `.htaccess` manda tudo para HTTPS. Se o certificado não estiver emitido, o
visitante bate num aviso de site inseguro. Emita o certificado **antes** de divulgar
o endereço.

---

## 3. A página reservada — leia antes de subir

`/reservado/` reúne os valores de captação e as pendências internas. Ela sai da pasta
pública de propósito: **não está no `cadillac-site.zip`**.

A página traz `noindex`, que pede ao Google para não catalogar — mas isso **não é
controle de acesso**. Qualquer pessoa que descubra o endereço abre o conteúdo.

Para hospedá-la com segurança:

1. Gerenciador de Arquivos → crie a pasta `public_html/reservado`.
2. cPanel → **Privacidade de Diretório** (*Directory Privacy*) → entre em `public_html`
   → clique em **reservado** → marque *Proteger este diretório por senha* → crie um
   usuário e uma senha → **Salvar**.
3. Só então extraia o `cadillac-reservado.zip` dentro dela.

Fazendo nessa ordem, o conteúdo nunca fica exposto, nem por alguns minutos.

Se preferir não hospedar: o conteúdo é um arquivo HTML só, que abre com duplo clique
no seu computador, sem servidor nenhum.

---

## 4. Depois de publicar

**Google Search Console** — adicione a propriedade do domínio e envie o sitemap:

```
https://cadillacproducoes.com.br/sitemap.xml
```

São 79 endereços catalogados, cada um com data de atualização.

**Confira estes cinco pontos** com o site no ar:

- [ ] `https://cadillacproducoes.com.br` abre e o cadeado aparece
- [ ] `http://www.cadillacproducoes.com.br` redireciona para o endereço sem `www`, em HTTPS
- [ ] um endereço inventado, como `/pagina-que-nao-existe`, cai na página 404 da Cadillac
- [ ] o menu abre no celular e os submenus funcionam
- [ ] `https://cadillacproducoes.com.br/reservado/` pede usuário e senha — **ou** dá 404

---

## 5. Publicar uma atualização depois

O site é gerado a partir de um arquivo só, o `content-model.json`:

```bash
python3 build.py
```

O gerador reescreve as 81 páginas, o `sitemap.xml` e o `robots.txt`. Para publicar,
suba de novo os arquivos alterados. Como o HTML não fica em cache, a mudança aparece
imediatamente.

---

## 6. Se o domínio for outro

Os endereços canônicos, o `sitemap.xml`, o `robots.txt` e as imagens de
compartilhamento estão gravados com `https://cadillacproducoes.com.br`.

Publicar em outro domínio **sem corrigir isso** faz cada página apontar o Google para
um endereço que não é o dela. Na prática, o site não ranqueia.

A correção é uma linha no `content-model.json`, no campo `site.url`, e rodar o gerador
de novo.
