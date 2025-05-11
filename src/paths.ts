/**
 * src/paths.ts
 * TypeScript path alias çözümlemesi için yardımcı modül
 */
import * as path from 'path';
import * as moduleAlias from 'module-alias';

// Proje kök dizini
const rootDir = path.resolve(__dirname, '..');

// Path alias tanımlamaları
moduleAlias.addAliases({
  '@': path.join(rootDir, 'src'),
  '@modules': path.join(rootDir, 'src/modules'),
  '@models': path.join(rootDir, 'src/models'),
  '@config': path.join(rootDir, 'src/config'),
  '@utils': path.join(rootDir, 'src/utils'),
  '@middleware': path.join(rootDir, 'src/middleware'),
  '@routes': path.join(rootDir, 'src/routes'),
  '@socket': path.join(rootDir, 'src/socket'),
  '@types': path.join(rootDir, 'src/types'),
});

export default moduleAlias;
