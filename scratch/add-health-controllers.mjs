import fs from 'node:fs';
import path from 'node:path';

const services = [
  'auth-service',
  'product-service',
  'order-service',
  'inventory-service',
  'customer-service',
  'content-service',
];

for (const svc of services) {
  const healthDir = path.resolve('services', svc, 'src', 'health');
  fs.mkdirSync(healthDir, { recursive: true });

  const controllerCode = `import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  checkHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: '${svc}',
      timestamp: new Date().toISOString(),
    };
  }
}
`;

  fs.writeFileSync(path.join(healthDir, 'health.controller.ts'), controllerCode, 'utf8');

  // Update app.module.ts
  const appModulePath = path.resolve('services', svc, 'src', 'app.module.ts');
  let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

  if (!appModuleContent.includes('HealthController')) {
    // Add import
    appModuleContent = `import { HealthController } from './health/health.controller.js';\n` + appModuleContent;
    // Add controllers: [HealthController] to @Module
    appModuleContent = appModuleContent.replace(
      /@Module\({\s*([\s\S]*?)\s*}\)/,
      (match, p1) => {
        if (p1.includes('controllers:')) {
          return match.replace(/controllers:\s*\[/, 'controllers: [HealthController, ');
        } else {
          return `@Module({\n  controllers: [HealthController],\n  ${p1.trim()}\n})`;
        }
      }
    );
    fs.writeFileSync(appModulePath, appModuleContent, 'utf8');
  }

  console.log(`Added HealthController to ${svc}`);
}
