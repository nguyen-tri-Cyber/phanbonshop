import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Production Hardening & SSL Verification Tests (TASK-P6-01 / AUD-P1-002)', () => {
  const nginxConfPath = path.resolve(rootDir, 'docker/nginx/conf.d/default.conf');
  const localNginxConfPath = path.resolve(rootDir, 'docker/nginx/conf.d.local/default.conf');
  const certsDir = path.resolve(rootDir, 'docker/nginx/certs');
  const scriptsDir = path.resolve(rootDir, 'scripts');

  test('Nginx default.conf must configure port 80 redirect and port 443 SSL', () => {
    assert.ok(fs.existsSync(nginxConfPath), 'default.conf must exist');
    const conf = fs.readFileSync(nginxConfPath, 'utf8');

    // 1. Port 80 checks
    assert.ok(conf.includes('listen 80;'), 'Must listen on port 80');
    assert.ok(conf.includes('location /healthz'), 'Must provide unredirected /healthz probe');
    assert.ok(conf.includes('return 301 https://'), 'Must redirect HTTP to HTTPS');

    // 2. Port 443 SSL checks
    assert.ok(conf.includes('listen 443 ssl;'), 'Must listen on port 443 ssl');
    assert.ok(conf.includes('ssl_certificate /etc/nginx/certs/fullchain.pem;'), 'Must reference fullchain.pem');
    assert.ok(conf.includes('ssl_certificate_key /etc/nginx/certs/privkey.pem;'), 'Must reference privkey.pem');
    assert.ok(conf.includes('TLSv1.2 TLSv1.3;'), 'Must restrict to TLSv1.2 and TLSv1.3');
    assert.ok(conf.includes('Strict-Transport-Security'), 'Must include HSTS header');
  });

  test('local compose serves plain HTTP without redirecting or emitting HSTS', () => {
    const compose = fs.readFileSync(path.resolve(rootDir, 'docker-compose.yml'), 'utf8');
    const conf = fs.readFileSync(localNginxConfPath, 'utf8');
    const gatewayMain = fs.readFileSync(
      path.resolve(rootDir, 'apps/api-gateway/src/main.ts'),
      'utf8',
    );

    assert.ok(compose.includes('./docker/nginx/conf.d.local:/etc/nginx/conf.d:ro'));
    assert.match(compose, /-\s*"?80:80"?/);
    assert.ok(!compose.includes('443:443'));
    assert.ok(conf.includes('listen 80;'));
    assert.ok(!conf.includes('return 301 https://'));
    assert.ok(!conf.includes('Strict-Transport-Security'));
    assert.ok(
      gatewayMain.includes(
        "strictTransportSecurity: process.env.NODE_ENV === 'production'",
      ),
      'API Gateway must emit HSTS only in production',
    );
  });

  test('TLS key material is generated at runtime and never tracked in the repository', () => {
    const fullchain = path.join(certsDir, 'fullchain.pem');
    const privkey = path.join(certsDir, 'privkey.pem');
    const trackedCerts = execFileSync(
      'git',
      ['ls-files', '--', 'docker/nginx/certs/*.pem', 'docker/nginx/certs/*.key'],
      { cwd: rootDir, encoding: 'utf8' },
    ).trim().split(/\r?\n/).filter(Boolean);

    assert.deepEqual(
      trackedCerts.filter((relativePath) => fs.existsSync(path.resolve(rootDir, relativePath))),
      [],
      'No tracked TLS key/certificate material may remain in the working tree',
    );

    const gitignore = fs.readFileSync(path.resolve(rootDir, '.gitignore'), 'utf8');
    assert.match(gitignore, /docker\/nginx\/certs\/\*\.pem/);
    assert.match(gitignore, /docker\/nginx\/certs\/\*\.key/);

    if (fs.existsSync(fullchain) || fs.existsSync(privkey)) {
      assert.equal(
        execFileSync('git', ['check-ignore', 'docker/nginx/certs/fullchain.pem'], {
          cwd: rootDir,
          encoding: 'utf8',
        }).trim(),
        'docker/nginx/certs/fullchain.pem',
      );
      assert.equal(
        execFileSync('git', ['check-ignore', 'docker/nginx/certs/privkey.pem'], {
          cwd: rootDir,
          encoding: 'utf8',
        }).trim(),
        'docker/nginx/certs/privkey.pem',
      );
    }
  });

  test('SSL provisioning scripts exist with correct entrypoints', () => {
    const letsencryptSh = path.join(scriptsDir, 'init-letsencrypt.sh');
    const selfSignedSh = path.join(scriptsDir, 'generate-self-signed-ssl.sh');
    const selfSignedPs1 = path.join(scriptsDir, 'generate-self-signed-ssl.ps1');

    assert.ok(fs.existsSync(letsencryptSh), 'init-letsencrypt.sh must exist');
    assert.ok(fs.existsSync(selfSignedSh), 'generate-self-signed-ssl.sh must exist');
    assert.ok(fs.existsSync(selfSignedPs1), 'generate-self-signed-ssl.ps1 must exist');

    const letsencryptContent = fs.readFileSync(letsencryptSh, 'utf8');
    assert.ok(letsencryptContent.includes('certbot'));
    assert.ok(letsencryptContent.includes('phanbonshop.vn'));
    assert.ok(
      !letsencryptContent.includes('./docker/nginx/certs'),
      'Production certificate setup must not copy private keys into the repository',
    );

    const compose = fs.readFileSync(path.resolve(rootDir, 'docker-compose.prod.yml'), 'utf8');
    assert.match(compose, /\$\{TLS_CERTS_DIR:\?/);
    assert.ok(!compose.includes('./docker/nginx/certs:/etc/nginx/certs:ro'));
  });

  test('.env.production.example exists and contains security warnings', () => {
    const prodEnvFile = path.resolve(rootDir, '.env.production.example');
    assert.ok(fs.existsSync(prodEnvFile), '.env.production.example must exist');

    const content = fs.readFileSync(prodEnvFile, 'utf8');
    assert.ok(content.includes('NODE_ENV=production'));
    assert.ok(content.includes('CHANGE_ME'));
    assert.ok(content.includes('openssl rand'));
  });
});
