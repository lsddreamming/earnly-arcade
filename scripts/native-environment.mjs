import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const production = {project:'zdwziebtbpuolusztede', key:'sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ'};
const sandbox = {project:'wphqfogbnpdsfkquvdsu', key:'sb_publishable_kyez8nhpp8htaPAdh7Hmfw_5NCyK6RI'};
export function nativeEnvironment(value = 'production') {
  if (!['production','sandbox'].includes(value)) throw new Error('Unknown EARNLY_BACKEND_ENVIRONMENT');
  return {name:value, ...(value === 'sandbox' ? sandbox : production)};
}

// Transform the copied bundle only. Never rewrite the website's production source.
export async function configureNativeEnvironment(directory, value) {
  const config = nativeEnvironment(value);
  const files = (await readdir(directory)).filter(name => /\.(js|html|json|webmanifest)$/.test(name));
  for (const name of files) {
    const file = path.join(directory,name);
    let source = await readFile(file,'utf8');
    if (config.name === 'sandbox') {
      source = source.replaceAll(production.project,sandbox.project).replaceAll(production.key,sandbox.key);
      if (name.endsWith('.html')) source = source.replace(/<body([^>]*)>/i,
        '<body$1><div role="status" style="position:relative;z-index:2147483647;padding:8px;text-align:center;background:#642779;color:white;font:600 12px system-ui">SANDBOX · Test account and test coins only</div>');
      if (source.includes(production.project) || source.includes(production.key)) throw new Error('Production backend in sandbox bundle: '+name);
    }
    await writeFile(file,source);
  }
  await writeFile(path.join(directory,'native-build-environment.json'),JSON.stringify({environment:config.name,project:config.project,purchaseEnvironment:config.name==='sandbox'?'Sandbox':'Production'},null,2)+'\n');
  return config;
}
