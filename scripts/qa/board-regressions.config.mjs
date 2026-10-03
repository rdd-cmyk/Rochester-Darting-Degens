import config from './board.config.mjs';

const regressionConfig = { ...config, testMatch: 'board-regressions.spec.mjs', outputDir: '../../test-results/board-regressions' };
export default regressionConfig;
