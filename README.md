<a  href="https://nestjs.com/"  target="blank"><img  src="https://nestjs.com/img/logo-small.svg"  width="50"  alt="Nest Logo"  /></a>
<a  href="https://www.typescriptlang.org/"  target="blank"><img  src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg"  width="50"  alt="Nest Logo"  /></a>
<a  href="https://www.postgresql.org/"  target="blank"><img  src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Postgresql_elephant.svg/1200px-Postgresql_elephant.svg.png"  width="50"  alt="Nest Logo"  /></a>

## Description

### Dependency

<ul>
<li><a href="https://ffmpeg.org/">FFmpeg</a></li>
</ul>

### Optional dependency

<ul>
<li><a href="https://fukuchi.org/works/qrencode/index.html.en">qrencode</a></li>
</ul>

## Installation

```bash
# Generate JWT Private file
$ ssh-keygen -t rsa -m PEM -b 4096 -Z chacha20-poly1305@openssh.com -f jwt.pem -q -N ""
# Create public key in PEM format
$ openssl rsa -in jwt.pem -pubout -out jwt.pem.pub

# Install node modules
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start:dev

# production
$ yarn run build
$ yarn run start:prod
```
