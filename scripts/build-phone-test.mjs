import { build } from 'esbuild';
await build({ entryPoints: ['lib/phone-test-ui.jsx'], bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' }, outfile: 'public/phone-test.js' });
console.log('Built two-phone client.');
