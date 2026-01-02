import { AssetResourceManagerR3F } from './assetManager';
import { threeLoaders } from './threeLoaders';

export const assets = new AssetResourceManagerR3F({
  loaders: threeLoaders,
  memoryLimitMB: 512,
  maxConcurrentLoads: 4,
});
